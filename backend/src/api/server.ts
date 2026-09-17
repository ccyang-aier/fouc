/**
 * HTTP/WS API 层：REST + WebSocket 事件流。
 *
 * 安全基线：仅绑定 127.0.0.1；所有路由要求 Bearer token
 * （Tauri 壳生成、经 command 交给前端）；WS 首帧认证。
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AgentEvent, WsEnvelope } from '@shared/index';
import type { AgentRegistry } from '../agents/registry';
import type { SessionSupervisor } from '../agents/supervisor';
import type { ConnectorService } from '../connectors/service';
import { normalizeError } from '../connectors/service';
import type { CookieHandoff } from '../connectors/dts/provider';
import type { DtsTicketListInput } from '@shared/index';

export type ServerContext = {
  registry: AgentRegistry;
  supervisor: SessionSupervisor;
  connectors: ConnectorService;
  token: string;
  internalToken: string;
  devNoAuth?: boolean;
};

// ─── WS 广播通道（Bun.serve websocket 回调注入） ───────────────────

/**
 * 传输最小接口。Bun 的 ServerWebSocket 不是浏览器 WebSocket（没有
 * addEventListener），连接状态由 hub 内的 Map 承载，message/close 经
 * Bun.serve 回调送入。
 */
interface WsLike {
  send(frame: string): void;
}

type WsClient = { authenticated: boolean };

class BroadcastHub {
  private readonly clients = new Map<WsLike, WsClient>();

  constructor(
    private readonly expectedToken: string,
    /** 开发模式（无 token）下放行所有连接 */
    private readonly allowAll = false
  ) {}

  attach(ws: WsLike): void {
    this.clients.set(ws, { authenticated: this.allowAll });
  }

  onMessage(ws: WsLike, data: string | Buffer): void {
    const client = this.clients.get(ws);
    if (!client) return;
    try {
      const parsed = JSON.parse(String(data)) as { type?: string; token?: string };
      if (parsed.type === 'auth') {
        client.authenticated = this.allowAll || (!!parsed.token && parsed.token === this.expectedToken);
        ws.send(JSON.stringify({ type: 'auth_result', ok: client.authenticated }));
      }
    } catch {
      /* ignore malformed frames */
    }
  }

  onClose(ws: WsLike): void {
    this.clients.delete(ws);
  }

  broadcast(envelope: WsEnvelope): void {
    const frame = JSON.stringify(envelope);
    for (const [ws, client] of this.clients) {
      if (!client.authenticated) continue;
      try {
        ws.send(frame);
      } catch {
        this.clients.delete(ws);
      }
    }
  }
}


/** 安全读取 JSON body：坏载荷返回 400 而非 500 */
async function readJson<T>(c: { req: { json(): Promise<unknown> } }): Promise<T | null> {
  try {
    return (await c.req.json()) as T;
  } catch {
    return null;
  }
}

// ─── 应用装配 ──────────────────────────────────────────────────────

export function createApp(context: ServerContext): { app: Hono; hub: BroadcastHub } {
  const { registry, supervisor, connectors, token } = context;
  const hub = new BroadcastHub(token, context.devNoAuth === true);

  const app = new Hono();

  // CORS：放行开发服务器与 Tauri WebView 来源（Windows http://tauri.localhost，macOS/Linux tauri://localhost）。
  // 服务仅绑定 127.0.0.1 且除 /health 外均需 Bearer token，来源白名单无安全影响。
  const allowedOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|tauri\.localhost)(:\d+)?$/;
  app.use('*', cors({
    origin: (origin) => (origin && (allowedOrigin.test(origin) || origin === 'tauri://localhost') ? origin : 'http://localhost:3000'),
  }));

  // Bearer 鉴权中间件（/health 除外）
  app.use('*', async (c, next) => {
    if (c.req.path === '/health') return next();
    if (c.req.path.startsWith('/internal/')) {
      if (c.req.header('x-fouc-internal-token') !== context.internalToken) {
        return c.json({ ok: false, error: { code: 'unauthorized', message: 'Invalid internal token' } }, 401);
      }
      return next();
    }
    if (context.devNoAuth) return next();
    const header = c.req.header('authorization') ?? '';
    if (header !== `Bearer ${token}`) {
      return c.json({ ok: false, error: { code: 'unauthorized', message: 'Missing or invalid bearer token' } }, 401);
    }
    return next();
  });

  // ── 健康/关停（进程协议端点） ──────────────────────────────────

  app.get('/health', (c) => c.json({ ok: true, pid: process.pid, at: Date.now() }));

  // ── Connector 控制面与 DTS 数据面 ─────────────────────────────

  app.get('/api/connectors/providers', (c) => c.json({ ok: true, data: connectors.listProviders() }));
  app.get('/api/connectors/instances', (c) => c.json({ ok: true, data: connectors.listInstances() }));
  app.get('/api/connectors/instances/:id', (c) => connectorReply(c, () => connectors.detail(c.req.param('id'))));

  app.post('/api/connectors/instances/:id/connect', (c) => connectorReply(c, () => connectors.beginConnect(c.req.param('id'))));
  app.post('/api/connectors/instances/:id/disconnect', (c) => connectorReply(c, () => connectors.disconnect(c.req.param('id'))));
  app.post('/api/connectors/instances/:id/heartbeat', (c) => connectorReply(c, () => connectors.heartbeat(c.req.param('id'))));

  app.get('/api/connectors/instances/:id/dts/filters', (c) => connectorReply(c, () => connectors.dtsFilters(c.req.param('id'))));
  app.post('/api/connectors/instances/:id/dts/tickets', async (c) => {
    const body = await readJson<DtsTicketListInput>(c);
    if (!body) return c.json({ ok: false, error: { code: 'invalid_input', message: '请求体无效' } }, 400);
    return connectorReply(c, () => connectors.dtsTickets(c.req.param('id'), body));
  });
  app.get('/api/connectors/instances/:id/dts/tickets/:ticketId', (c) => connectorReply(c, () => connectors.dtsTicket(c.req.param('id'), c.req.param('ticketId'))));

  // 该端点只接受 Rust 壳持有的独立内部令牌；普通前端 Bearer Token 无权注入 Cookie。
  app.post('/internal/connectors/dts/auth-handoff', async (c) => {
    const body = await readJson<{ interactionId: string; cookies: CookieHandoff[] }>(c);
    if (!body?.interactionId || !Array.isArray(body.cookies)) return c.json({ ok: false, error: { code: 'invalid_input', message: '认证交接数据无效' } }, 400);
    return connectorReply(c, () => connectors.completeDtsConnect(body.interactionId, body.cookies));
  });
  app.post('/internal/connectors/dts/auth-cancel', async (c) => {
    const body = await readJson<{ interactionId: string; errorCode?: string; errorMessage?: string }>(c);
    if (body?.interactionId) connectors.cancelConnect(body.interactionId, body.errorCode, body.errorMessage);
    return c.json({ ok: true, data: { cancelled: true } });
  });

  // ── Agent 目录与安装 ───────────────────────────────────────────

  app.get('/api/agents/providers', (c) => c.json({ ok: true, data: registry.listProviders() }));

  app.get('/api/agents/installations', (c) => c.json({ ok: true, data: registry.listInstallations() }));

  app.get('/api/agents/installations/:id', (c) => {
    const installation = registry.installationById(c.req.param('id'));
    if (!installation) return c.json({ ok: false, error: { code: 'not_found', message: 'Installation not found' } }, 404);
    return c.json({ ok: true, data: installation });
  });

  app.post('/api/agents/refresh', async (c) => {
    await registry.refreshAll();
    return c.json({ ok: true, data: registry.listInstallations() });
  });

  app.post('/api/agents/installations/:id/health-check', async (c) => {
    const updated = await registry.probeOne(c.req.param('id'), 'manual');
    if (!updated) return c.json({ ok: false, error: { code: 'not_found', message: 'Installation not found' } }, 404);
    return c.json({ ok: true, data: updated });
  });

  app.post('/api/agents/providers/:id/test', async (c) => {
    const id = c.req.param('id');
    if (!registry.providerById(id)) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Provider not found' } }, 404);
    }
    const installation = await registry.testProvider(id);
    return c.json({ ok: true, data: { installation } });
  });

  app.post('/api/agents/installations', async (c) => {
    const body = await readJson<{ providerId: string; executablePath: string }>(c);
    if (!body || !body.providerId || !body.executablePath) {
      return c.json({ ok: false, error: { code: 'invalid_params', message: 'providerId and executablePath are required' } }, 400);
    }
    const installation = registry.addManualPath(body.providerId, body.executablePath);
    // 登记后立即探测，走两阶段失败分类
    void registry.probeOne(installation.id, 'manual');
    return c.json({ ok: true, data: installation }, 201);
  });

  app.patch('/api/agents/installations/:id/enabled', async (c) => {
    const body = await readJson<{ enabled: boolean }>(c);
    const updated = registry.setEnabled(c.req.param('id'), body?.enabled === true);
    if (!updated) return c.json({ ok: false, error: { code: 'not_found', message: 'Installation not found' } }, 404);
    return c.json({ ok: true, data: updated });
  });

  app.post('/api/agents/installations/:id/set-default', (c) => {
    const updated = registry.setDefault(c.req.param('id'));
    if (!updated) return c.json({ ok: false, error: { code: 'not_found', message: 'Installation not found' } }, 404);
    return c.json({ ok: true, data: updated });
  });

  app.delete('/api/agents/installations/:id', (c) => {
    const removed = registry.removeInstallation(c.req.param('id'));
    if (!removed) return c.json({ ok: false, error: { code: 'not_found', message: 'Installation not found' } }, 404);
    return c.json({ ok: true, data: { deleted: true } });
  });

  // ── 会话与运行 ─────────────────────────────────────────────────

  app.get('/api/sessions', (c) => c.json({ ok: true, data: supervisor.listSessions() }));

  app.post('/api/sessions', async (c) => {
    const body = await readJson<{ installationId: string; workDir?: string; yoloMode?: boolean }>(c);
    if (!body || !body.installationId) {
      return c.json({ ok: false, error: { code: 'invalid_params', message: 'installationId is required' } }, 400);
    }
    try {
      const session = await supervisor.createSession(body.installationId, body.workDir ?? process.cwd(), {
        yoloMode: body.yoloMode ?? false,
      });
      return c.json({ ok: true, data: session }, 201);
    } catch (error) {
      return c.json({ ok: false, error: { code: 'session_create_failed', message: String(error) } }, 400);
    }
  });

  app.get('/api/sessions/:id', (c) => {
    const session = supervisor.getSession(c.req.param('id'));
    if (!session) return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' } }, 404);
    return c.json({ ok: true, data: session });
  });

  app.get('/api/sessions/:id/diagnostics', (c) => c.json({ ok: true, data: supervisor.diagnostics(c.req.param('id')) }));

  app.post('/api/sessions/:id/resume', async (c) => {
    try {
      const session = await supervisor.resumeSession(c.req.param('id'));
      return c.json({ ok: true, data: session });
    } catch (error) {
      return c.json({ ok: false, error: { code: 'resume_failed', message: String(error) } }, 400);
    }
  });

  app.delete('/api/sessions/:id', async (c) => {
    await supervisor.terminateSession(c.req.param('id'));
    return c.json({ ok: true, data: { terminated: true } });
  });

  app.get('/api/sessions/:id/runs', (c) => c.json({ ok: true, data: supervisor.listRuns(c.req.param('id')) }));

  app.post('/api/sessions/:id/runs', async (c) => {
    const body = await readJson<{ input: string; files?: string[] }>(c);
    if (!body || !body.input) {
      return c.json({ ok: false, error: { code: 'invalid_params', message: 'input is required' } }, 400);
    }
    try {
      const run = await supervisor.startRun(c.req.param('id'), body.input, body.files);
      return c.json({ ok: true, data: run }, 201);
    } catch (error) {
      return c.json({ ok: false, error: { code: 'run_failed', message: String(error) } }, 400);
    }
  });

  app.post('/api/sessions/:id/cancel', async (c) => {
    await supervisor.cancelRun(c.req.param('id'));
    return c.json({ ok: true, data: { cancelled: true } });
  });

  app.get('/api/sessions/:id/events', (c) => {
    const afterId = Number(c.req.query('after') ?? 0);
    return c.json({ ok: true, data: supervisor.listEvents(c.req.param('id'), afterId) });
  });

  app.post('/api/sessions/:id/approvals', async (c) => {
    const body = await readJson<{ callId: string; optionId: string }>(c);
    if (!body || !body.callId || !body.optionId) {
      return c.json({ ok: false, error: { code: 'invalid_params', message: 'callId and optionId are required' } }, 400);
    }
    const resolved = supervisor.resolveApproval(c.req.param('id'), body.callId, body.optionId);
    return c.json({ ok: resolved, data: { resolved } });
  });

  app.post('/api/sessions/:id/model', async (c) => {
    const body = await readJson<{ modelId: string }>(c);
    supervisor.setModel(c.req.param('id'), body?.modelId ?? '');
    return c.json({ ok: true, data: { applied: true } });
  });

  app.post('/api/sessions/:id/mode', async (c) => {
    const body = await readJson<{ modeId: string }>(c);
    supervisor.setModel(c.req.param('id'), body?.modeId ?? '');
    return c.json({ ok: true, data: { applied: true } });
  });

  // ── 优雅关停（Tauri 壳在退出前调用） ─────────────────────────

  app.post('/shutdown', async (c) => {
    c.json({ ok: true });
    setTimeout(() => process.exit(0), 50);
  });

  return { app, hub };
}

async function connectorReply(c: { json: (body: unknown, status?: number) => Response }, work: () => unknown | Promise<unknown>): Promise<Response> {
  try {
    return c.json({ ok: true, data: await work() });
  } catch (error) {
    const normalized = normalizeError(error);
    return c.json({ ok: false, error: { code: normalized.code, message: normalized.message } }, normalized.status);
  }
}

export function createEventForwarder(hub: BroadcastHub): (event: AgentEvent) => void {
  return (event) => {
    const envelope: WsEnvelope = {
      topic: event.type.startsWith('installation.') ? 'agents.installationChanged' : `runs.event.${'sessionId' in event ? event.sessionId : 'unknown'}`,
      payload: event,
      at: Date.now(),
    };
    hub.broadcast(envelope);
  };
}

export { BroadcastHub };
