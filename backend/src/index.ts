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

import { existsSync, copyFileSync, linkSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApp, createEventForwarder } from './api/server';
import { openDatabase } from './store/db';
import { EventRepository, InstallationRepository, ProviderRepository, RunRepository, SessionRepository } from './store/repositories';
import { AgentRegistry } from './agents/registry';
import { SessionSupervisor } from './agents/supervisor';
import { createLogger } from './platform/logger';
import { getDataDir } from './platform/paths';

const log = createLogger('main');

const PORT = Number(process.env.FOUC_BACKEND_PORT ?? 8710);
const TOKEN = process.env.FOUC_BACKEND_TOKEN ?? '';
const DEV_NO_AUTH = TOKEN === '';

/**
 * argv 分发（打包态多用途）：
 *  - `--bridge <providerId>`：以内嵌桥适配器身份运行（适配器编译进本二进制）
 *  - `<file.js> [args…]`：以 Bun 运行时身份执行该文件——claude 桥的 SDK 以
 *    `bun <cli.js>` spawn CLI，打包态由 userData/runtime/bin/bun.exe（本二进制的
 *    硬链接，ensureRuntimeShim 维护）承接
 * 注：Bun 编译 exe 收到首参为 js 文件时会原生执行该文件（不进本入口）；
 * 此处的文件分支兜底处理文件出现在非首位的形态。
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
  const fileArg = rawArgv.find((arg) => /\.(m?js|cjs)$/i.test(arg) && existsSync(path.resolve(arg)));
  if (fileArg) {
    const file = path.resolve(fileArg);
    process.argv = [process.argv[0], file, ...rawArgv.filter((a) => a !== fileArg)];
    await import(pathToFileURL(file).href);
  } else if (/fouc-backend/i.test(path.basename(process.execPath)) && !process.env.FOUC_BACKEND_PORT) {
    // 打包态但无启动器注入的端口：这是被当作 "bun" spawn 的运行时垫片收到了
    // 无法执行的参数形态（非 js 文件开头）。绝不起服务器——会继承环境撞端口。
    console.error(`[fouc-backend] runtime shim invoked without a script: ${JSON.stringify(rawArgv)}`);
    process.exit(2);
  } else {
    ensureRuntimeShim();
    void main().catch((error) => {
      log.error('Fatal startup error:', error);
      process.exit(1);
    });
  }
}

function runtimeShimPath(): string {
  return path.join(getDataDir(), 'runtime', 'bin', process.platform === 'win32' ? 'bun.exe' : 'bun');
}

/** 打包态：提供指向自身的 bun.exe，供 claude 桥的 SDK 启动解压出的 CLI */
function ensureRuntimeShim(): void {
  if (!/fouc-backend/i.test(path.basename(process.execPath))) return; // 开发态：系统 bun 已在
  const target = runtimeShimPath();
  mkdirSync(path.dirname(target), { recursive: true });
  try {
    rmSync(target, { force: true });
    linkSync(process.execPath, target);
  } catch {
    // 跨卷等场景退化为整份复制（仅首启一次）
    if (!existsSync(target)) copyFileSync(process.execPath, target);
  }
}

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
