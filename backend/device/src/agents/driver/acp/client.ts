/**
 * @license
 * 连接客户端移植自 AionUi (aionui.com) 的
 * src/process/acp/infra/ProcessAcpClient.ts 与
 * src/process/agent/acp/acpConnectors.ts（Apache-2.0），
 * Copyright 2025 AionUi (aionui.com)，按 Apache-2.0 授权复用并修改。
 *
 * 单一所有者：一个本地 Agent 子进程 + 其 ACP 协议。
 *  - 4 信号生命周期检测（exit / close / stdout.close / connection abort）
 *  - stderr 环形缓冲（8KB，从 spawn 时刻捕获）
 *  - 启动失败监视（Promise.race: initialize vs 进程退出）
 *  - pending 请求追踪（断连时统一拒绝）
 *  - 三阶段优雅关闭
 */

import type {
  Client,
  ForkSessionResponse,
  InitializeResponse,
  LoadSessionResponse,
  NewSessionResponse,
  PromptResponse,
  SetSessionConfigOptionRequest,
  Stream,
} from '@agentclientprotocol/sdk';
import { ClientSideConnection, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import type { ChildProcess } from 'node:child_process';
import { AgentDisconnectedError, AgentSpawnError, AgentStartupError } from './errors';
import { NdjsonTransport } from './transport';
import { gracefulShutdown, waitForExit, waitForSpawn } from '../../../execution/process';
import type { ProtocolHandlers, PromptContent } from './types';
import { createLogger } from '../../../platform/logger';

const log = createLogger('acp-client');
const STARTUP_STDERR_MAX = 8192;
const CLIENT_INFO = { name: 'Fouc', version: '0.1.0' };

type PendingRequest = {
  settled: boolean;
  reject: (error: unknown) => void;
};

export type AgentDisconnectReason = 'process_exit' | 'process_close' | 'pipe_close' | 'connection_close';

export type AgentExitInfo = {
  exitCode: number | null;
  signal: string | null;
  reason: AgentDisconnectReason;
  stderr: string;
  unexpectedDuringPrompt: boolean;
};

export type AgentLifecycleSnapshot = {
  pid: number | null;
  running: boolean;
  lastExit: AgentExitInfo | null;
};

export type DisconnectInfo = {
  reason: AgentDisconnectReason;
  exitCode: number | null;
  signal: string | null;
  stderr: string;
};

// ─── 启动规格（目录声明 → 具体命令行） ─────────────────────────────

export interface AcpLaunchSpec {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  gracePeriodMs?: number;
}

export type ProcessAcpClientOptions = {
  backend: string;
  handlers: ProtocolHandlers;
  gracePeriodMs?: number;
};

export class ProcessAcpClient {
  private child: ChildProcess | null = null;
  private connection: ClientSideConnection | null = null;
  private closing = false;

  private stderrBuffer = '';

  private _lastExit: AgentExitInfo | null = null;
  private disconnectHandler: ((info: DisconnectInfo) => void) | null = null;
  private hasActivePrompt = false;

  private readonly pendingRequests = new Set<PendingRequest>();

  constructor(
    private readonly spawnFn: () => Promise<ChildProcess>,
    private readonly options: ProcessAcpClientOptions
  ) {}

  // ─── 生命周期快照 ──────────────────────────────────────────────

  get lifecycleSnapshot(): AgentLifecycleSnapshot {
    return {
      pid: this.child?.pid ?? null,
      running: this.child !== null && this._lastExit === null,
      lastExit: this._lastExit,
    };
  }

  onDisconnect(handler: (info: DisconnectInfo) => void): void {
    this.disconnectHandler = handler;
  }

  // ─── start(): spawn + initialize + 启动失败监视 ─────────────────

  async start(): Promise<InitializeResponse> {
    // 1. spawn 子进程
    let child: ChildProcess;
    try {
      child = await this.spawnFn();
      await waitForSpawn(child);
    } catch (err) {
      throw new AgentSpawnError(this.options.backend, err);
    }
    this.child = child;

    // 2. 从 spawn 时刻捕获 stderr
    this.setupStderrCapture(child);

    // 3. 挂接 4 信号生命周期观察者
    this.attachLifecycleObservers(child);

    // 4. 创建传输 + SDK 连接
    const stream: Stream = NdjsonTransport.fromChildProcess(child);
    const connection = new ClientSideConnection(
      (_agent): Client => ({
        sessionUpdate: async (params) => this.options.handlers.onSessionUpdate(params),
        requestPermission: async (params) => this.options.handlers.onRequestPermission(params),
        readTextFile: async (params) => this.options.handlers.onReadTextFile(params),
        writeTextFile: async (params) => this.options.handlers.onWriteTextFile(params),
      }),
      stream
    );
    this.connection = connection;

    // SDK 连接中断信号
    connection.signal.addEventListener(
      'abort',
      () => this.recordAgentExit('connection_close', child.exitCode ?? null, child.signalCode ?? null),
      { once: true }
    );

    // 5. Promise.race: initialize vs 启动失败监视器
    const startupFailure = this.createStartupFailureWatcher(child);
    try {
      const initResult = await Promise.race([
        this.runConnectionRequest(() =>
          this.conn.initialize({
            clientInfo: CLIENT_INFO,
            protocolVersion: PROTOCOL_VERSION,
            clientCapabilities: {
              fs: { readTextFile: true, writeTextFile: true },
            },
          })
        ),
        startupFailure.promise,
      ]);
      startupFailure.dispose();
      return initResult;
    } catch (err) {
      startupFailure.dispose();
      // SDK 的笼统 "ACP connection closed" 归一化为带 stderr/退出码的 AgentStartupError
      throw await this.normalizeInitializeError(err, child);
    }
  }

  // ─── 协议方法（全部经 runConnectionRequest 包装） ───────────────

  async createSession(params: { cwd: string; mcpServers?: NewSessionRequestMcp[]; additionalDirectories?: string[] }): Promise<NewSessionResponse> {
    return this.runConnectionRequest(() =>
      this.conn.newSession({
        cwd: params.cwd,
        mcpServers: (params.mcpServers ?? []) as never,
        additionalDirectories: params.additionalDirectories,
      })
    );
  }

  async loadSession(params: { sessionId: string; cwd: string; mcpServers?: NewSessionRequestMcp[]; additionalDirectories?: string[] }): Promise<LoadSessionResponse> {
    return this.runConnectionRequest(() =>
      this.conn.loadSession({
        sessionId: params.sessionId,
        cwd: params.cwd,
        mcpServers: (params.mcpServers ?? []) as never,
        additionalDirectories: params.additionalDirectories,
      })
    );
  }

  /**
   * 会话分叉。Claude 不支持标准 session/fork，走其私有
   * _meta.claudeCode.options.resume + forkSession 参数（仅 Claude 有效）。
   */
  async forkSession(params: { sessionId: string; cwd: string; mcpServers?: NewSessionRequestMcp[]; additionalDirectories?: string[] }): Promise<ForkSessionResponse> {
    return this.runConnectionRequest(() =>
      this.conn.extMethod('session/new', {
        cwd: params.cwd,
        mcpServers: (params.mcpServers ?? []) as never,
        _meta: { claudeCode: { options: { resume: params.sessionId } } },
        forkSession: true,
      })
    ) as Promise<ForkSessionResponse>;
  }

  async prompt(sessionId: string, content: PromptContent): Promise<PromptResponse> {
    this.hasActivePrompt = true;
    try {
      return await this.runConnectionRequest(() => this.conn.prompt({ sessionId, prompt: content }));
    } finally {
      this.hasActivePrompt = false;
    }
  }

  async cancel(sessionId: string): Promise<void> {
    await this.runConnectionRequest(() => this.conn.cancel({ sessionId }));
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.runConnectionRequest(() => this.conn.closeSession({ sessionId }));
  }

  async setModel(sessionId: string, modelId: string): Promise<void> {
    // ACP 1.4 已移除专用的 setSessionModel；经扩展方法承载，
    // 不支持的 Agent 返回 method-not-found 由调用方降级
    await this.runConnectionRequest(() => this.conn.extMethod('session/set_model', { sessionId, modelId }));
  }

  async setMode(sessionId: string, modeId: string): Promise<void> {
    await this.runConnectionRequest(() => this.conn.setSessionMode({ sessionId, modeId }));
  }

  async setConfigOption(sessionId: string, configId: string, value: string | boolean): Promise<void> {
    const params: SetSessionConfigOptionRequest =
      typeof value === 'boolean' ? { sessionId, configId, type: 'boolean', value } : { sessionId, configId, value };
    await this.runConnectionRequest(() => this.conn.setSessionConfigOption(params));
  }

  async authenticate(methodId: string): Promise<unknown> {
    return this.runConnectionRequest(() => this.conn.authenticate({ methodId }));
  }

  async extMethod(method: string, params: Record<string, unknown>): Promise<unknown> {
    return this.runConnectionRequest(() => this.conn.extMethod(method, params));
  }

  // ─── 关闭 ──────────────────────────────────────────────────────

  async close(): Promise<void> {
    this.closing = true;
    if (this.child) {
      await gracefulShutdown(this.child, this.options.gracePeriodMs ?? 100);
      this.child = null;
    }
    this.connection = null;
  }

  // ─── 内部：连接访问器 ─────────────────────────────────────────

  private get conn(): ClientSideConnection {
    if (!this.connection) {
      throw new AgentDisconnectedError('connection_close', null, null);
    }
    return this.connection;
  }

  /** pending 请求注册表：断连时全部拒绝为 AgentDisconnectedError */
  private async runConnectionRequest<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const pending: PendingRequest = { settled: false, reject };
      this.pendingRequests.add(pending);

      const finish = (fn: () => void) => {
        if (pending.settled) return;
        pending.settled = true;
        this.pendingRequests.delete(pending);
        fn();
      };

      Promise.resolve()
        .then(run)
        .then(
          (value) => finish(() => resolve(value)),
          (error) => finish(() => reject(error))
        );
    });
  }

  private rejectPendingRequests(error: unknown): void {
    for (const pending of this.pendingRequests) {
      if (pending.settled) continue;
      pending.settled = true;
      this.pendingRequests.delete(pending);
      pending.reject(error);
    }
  }

  // ─── 内部：stderr 环形缓冲 ────────────────────────────────────

  private setupStderrCapture(child: ChildProcess): void {
    child.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      log.debug(`[${this.options.backend} stderr] ${chunk.trim()}`);
      this.stderrBuffer += chunk;
      if (this.stderrBuffer.length > STARTUP_STDERR_MAX) {
        this.stderrBuffer = this.stderrBuffer.slice(-STARTUP_STDERR_MAX);
      }
    });
  }

  // ─── 内部：4 信号生命周期检测（first-write-wins） ──────────────

  private attachLifecycleObservers(child: ChildProcess): void {
    child.once('exit', (code, signal) => {
      this.recordAgentExit('process_exit', code, signal);
    });
    child.once('close', (code, signal) => {
      this.recordAgentExit('process_close', code, signal);
    });
    child.stdout?.once('close', () => {
      this.recordAgentExit('pipe_close', child.exitCode ?? null, child.signalCode ?? null);
    });
    // connection_close 在 start() 中创建 SDK 连接后挂接
  }

  private recordAgentExit(
    reason: AgentDisconnectReason,
    exitCode: number | null,
    signal: NodeJS.Signals | string | null
  ): void {
    if (this._lastExit) return;

    if (signal) {
      log.warn(`[${this.options.backend}] Process killed by signal: ${signal} (code: ${exitCode}) [reason: ${reason}]`);
    } else if (exitCode !== null && exitCode !== 0) {
      log.warn(`[${this.options.backend}] Process exited with code ${exitCode} [reason: ${reason}]`);
    }

    this._lastExit = {
      exitCode,
      signal: signal ? String(signal) : null,
      reason,
      stderr: this.stderrBuffer,
      unexpectedDuringPrompt: !this.closing && this.hasActivePrompt,
    };

    const error = new AgentDisconnectedError(reason, exitCode, signal ? String(signal) : null, {
      outputAlreadyEmitted: this.hasActivePrompt,
    });
    this.rejectPendingRequests(error);

    this.disconnectHandler?.({
      reason,
      exitCode,
      signal: signal ? String(signal) : null,
      stderr: this.stderrBuffer,
    });
  }

  // ─── 内部：启动失败监视器 ─────────────────────────────────────

  private createStartupFailureWatcher(child: ChildProcess): { promise: Promise<never>; dispose: () => void } {
    let rejectFn: ((err: Error) => void) | null = null;
    let disposed = false;

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (disposed) return;
      rejectFn?.(new AgentStartupError(this.options.backend, code, signal ? String(signal) : null, this.stderrBuffer));
    };
    const onError = (err: Error) => {
      if (disposed) return;
      rejectFn?.(new AgentSpawnError(this.options.backend, err));
    };

    child.on('exit', onExit);
    child.on('error', onError);

    const promise = new Promise<never>((_resolve, reject) => {
      rejectFn = reject;
    });
    // 预挂空 rejection 处理，防止进程在到达 Promise.race 前失败时产生未处理拒绝
    promise.catch(() => {});

    const dispose = () => {
      disposed = true;
      child.off('exit', onExit);
      child.off('error', onError);
    };

    return { promise, dispose };
  }

  /** initialize 抛 "ACP connection closed" 时归一化（等待 exit 事件捕获退出码） */
  private async normalizeInitializeError(error: unknown, child: ChildProcess): Promise<unknown> {
    if (error instanceof AgentStartupError || error instanceof AgentSpawnError) return error;

    const isConnectionClosed = error instanceof Error && /acp connection closed/i.test(error.message);
    if (!isConnectionClosed) return error;

    await waitForExit(child, 200);
    return new AgentStartupError(
      this.options.backend,
      child.exitCode ?? null,
      child.signalCode ? String(child.signalCode) : null,
      this.stderrBuffer,
      error
    );
  }
}

/** 会话创建时的 MCP server 参数（SDK McpServer 结构的本地别名） */
export type NewSessionRequestMcp = {
  name: string;
  command?: string;
  args?: string[];
  env?: Array<{ name: string; value: string }>;
  type?: 'stdio' | 'http' | 'sse';
  url?: string;
  headers?: Array<{ name: string; value: string }>;
};
