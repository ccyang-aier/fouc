/**
 * Fouc 后端进程入口。
 *
 * 启动协议（由 Tauri 壳或开发脚本注入）：
 *   FOUC_BACKEND_PORT  — 监听端口（缺省 8710）
 *   FOUC_BACKEND_TOKEN — Bearer 鉴权 token（缺省进入免鉴权开发模式）
 *   FOUC_DATA_DIR      — 数据目录（缺省 ~/.fouc）
 *
 * 就绪语义：仅绑定 127.0.0.1；/health 返回 200 后才视为就绪。
 */

import { createApp, createEventForwarder } from './api/server';
import { openDatabase } from './store/db';
import { EventRepository, InstallationRepository, ProviderRepository, RunRepository, SessionRepository } from './store/repositories';
import { AgentRegistry } from './agents/registry';
import { SessionSupervisor } from './agents/supervisor';
import { createLogger } from './platform/logger';
import { ConnectorRepository } from './connectors/repository';
import { ConnectorService } from './connectors/service';

const log = createLogger('main');

const PORT = Number(process.env.FOUC_BACKEND_PORT ?? 8710);
const TOKEN = process.env.FOUC_BACKEND_TOKEN ?? '';
const DEV_NO_AUTH = TOKEN === '';
const INTERNAL_TOKEN = process.env.FOUC_INTERNAL_TOKEN ?? (DEV_NO_AUTH ? 'dev-internal' : '');

/**
 * argv 分发：`--bridge <providerId>` 以内嵌桥适配器身份运行（适配器编译进本
 * 二进制；claude 桥经 CLAUDE_CODE_EXECUTABLE 驱动用户自装的原生 claude，
 * 不再需要内嵌 CLI 与 bun 运行时垫片）。无分发参数则启动服务器。
 */
const rawArgv = process.argv.slice(1);
const bridgeFlag = rawArgv.indexOf('--bridge');

if (bridgeFlag >= 0) {
  const providerId = rawArgv[bridgeFlag + 1];
  const loaders: Record<string, () => Promise<unknown>> = {
    'claude-code': () => import('./bridges/claude-acp'),
  };
  const load = loaders[providerId];
  if (!load) {
    console.error(`[fouc-backend] unknown bridge: ${providerId}`);
    process.exit(2);
  }
  await load();
} else {
  void main().catch((error) => {
    log.error('Fatal startup error:', error);
    process.exit(1);
  });
}

async function main(): Promise<void> {
  if (!INTERNAL_TOKEN) throw new Error('FOUC_INTERNAL_TOKEN is required when backend authentication is enabled');
  const db = openDatabase();
  const providerRepo = new ProviderRepository(db);
  const installationRepo = new InstallationRepository(db);
  const sessionRepo = new SessionRepository(db);
  const runRepo = new RunRepository(db);
  const eventRepo = new EventRepository(db);
  const connectorRepo = new ConnectorRepository(db);
  const connectors = new ConnectorService(connectorRepo);

  // 事件出口：装配期缓冲，服务器就绪后切换为 WS 广播并冲放积压
  const buffered: import('@shared/index').AgentEvent[] = [];
  const emitter: { emit: (event: import('@shared/index').AgentEvent) => void } = { emit: (event) => buffered.push(event) };

  const registry = new AgentRegistry(providerRepo, installationRepo, (event) => emitter.emit(event));
  const supervisor = new SessionSupervisor(registry, sessionRepo, runRepo, eventRepo, (event) => emitter.emit(event));

  const { app, hub } = createApp({ registry, supervisor, connectors, token: TOKEN || 'dev', internalToken: INTERNAL_TOKEN, devNoAuth: DEV_NO_AUTH });
  const forwarder = createEventForwarder(hub);
  emitter.emit = (event) => forwarder(event);
  for (const event of buffered.splice(0)) forwarder(event);

  const server = Bun.serve({
    port: PORT,
    hostname: '127.0.0.1',
    // 健康检查会同步等待探测完成（桥冷启动最长 90s+），默认 10s 会掐断响应
    idleTimeout: 255,
    fetch(req, srv) {
      // 仅对真正的 WS 握手调用 upgrade：对任意请求调用会在部分 Bun 版本上触发
      // 内部 Response(status 0) 崩溃（实测 RangeError 击穿进程）
      if (req.headers.get('upgrade')?.toLowerCase() === 'websocket' && srv.upgrade(req)) return;
      return app.fetch(req);
    },
    websocket: {
      open: (ws) => hub.attach(ws),
      message: (ws, data) => hub.onMessage(ws, data as string | Buffer),
      close: (ws) => hub.onClose(ws),
    },
  });

  log.info(`Fouc backend listening on http://127.0.0.1:${server.port} (auth: ${DEV_NO_AUTH ? 'DEV MODE — no token' : 'bearer token'})`);

  // 重启恢复：孤儿 Run 不误标成功；遗留会话置 suspended 供恢复；启动空闲巡检
  supervisor.markOrphanedRuns();
  supervisor.startupSuspendScan();
  supervisor.startIdleReclaimer();

  // 后台刷新：发现 + 探测已登记 installation
  registry.startupRefresh();
  connectors.startHeartbeat();

  // 优雅关停
  const shutdown = async () => {
    log.info('Shutting down: suspending sessions…');
    connectors.stopHeartbeat();
    await supervisor.shutdown().catch((error) => log.error('shutdown failed:', error));
    server.stop(true);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}
