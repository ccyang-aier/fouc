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

const log = createLogger('main');

const PORT = Number(process.env.FOUC_BACKEND_PORT ?? 8710);
const TOKEN = process.env.FOUC_BACKEND_TOKEN ?? '';
const DEV_NO_AUTH = TOKEN === '';

async function main(): Promise<void> {
  const db = openDatabase();
  const providerRepo = new ProviderRepository(db);
  const installationRepo = new InstallationRepository(db);
  const sessionRepo = new SessionRepository(db);
  const runRepo = new RunRepository(db);
  const eventRepo = new EventRepository(db);

  // 事件出口：装配期缓冲，服务器就绪后切换为 WS 广播并冲放积压
  const buffered: import('@shared/index').AgentEvent[] = [];
  const emitter: { emit: (event: import('@shared/index').AgentEvent) => void } = { emit: (event) => buffered.push(event) };

  const registry = new AgentRegistry(providerRepo, installationRepo, (event) => emitter.emit(event));
  const supervisor = new SessionSupervisor(registry, sessionRepo, runRepo, eventRepo, (event) => emitter.emit(event));

  const { app, hub } = createApp({ registry, supervisor, token: TOKEN || 'dev', devNoAuth: DEV_NO_AUTH });
  const forwarder = createEventForwarder(hub);
  emitter.emit = (event) => forwarder(event);
  for (const event of buffered.splice(0)) forwarder(event);

  const server = Bun.serve({
    port: PORT,
    hostname: '127.0.0.1',
    fetch(req, srv) {
      if (srv.upgrade(req)) return;
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

  // 优雅关停
  const shutdown = async () => {
    log.info('Shutting down: suspending sessions…');
    await supervisor.shutdown().catch((error) => log.error('shutdown failed:', error));
    server.stop(true);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error) => {
  log.error('Fatal startup error:', error);
  process.exit(1);
});
