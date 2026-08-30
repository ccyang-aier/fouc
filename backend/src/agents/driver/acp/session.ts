/**
 * @license
 * 会话状态机移植自 AionUi (aionui.com) 的 src/process/acp/session/
 * （AcpSession.ts / SessionLifecycle.ts / PromptExecutor.ts，Apache-2.0），
 * Copyright 2025 AionUi (aionui.com)，按 Apache-2.0 授权复用并修改。
 *
 * 七态 FSM：idle → starting → active ⇄ prompting → suspended → resuming；
 * 错误态 error 可重启。断连语义按状态分派：
 *  - prompting 中断连：视为崩溃（发 error 信号），随后自动恢复
 *  - active 中空闲断连：正常生命周期事件（桥可能因不活跃超时退出），
 *    静默转 suspended，下次 sendMessage 重新拉起
 */

import type {
  AuthMethod,
  LoadSessionResponse,
  NewSessionResponse,
  UsageUpdate,
} from '@agentclientprotocol/sdk';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { AcpError, normalizeError } from './errors';
import { ProcessAcpClient, type AcpLaunchSpec, type DisconnectInfo } from './client';
import { AuthNegotiator, PermissionResolver } from './auth';
import { EventTranslator } from './translator';
import { ConfigTracker, InputPreprocessor, McpConfig, PromptTimer } from './components';
import type { AgentConnectionConfig, ProtocolHandlers, PromptContent, SessionCallbacks, SessionStatus } from './types';
import { createLogger } from '../../../platform/logger';

const log = createLogger('acp-session');

// ─── 状态机合法转换 ────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  idle: ['starting'],
  starting: ['active', 'starting', 'error', 'idle'],
  active: ['prompting', 'suspended', 'idle'],
  prompting: ['active', 'resuming', 'error', 'idle'],
  suspended: ['resuming', 'idle'],
  resuming: ['active', 'resuming', 'error', 'idle'],
  error: ['starting', 'idle'],
};

/** 包装回调，防止单个回调实现异常破坏会话内部状态机 */
function wrapCallbacks(raw: SessionCallbacks): SessionCallbacks {
  const wrapped = {} as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    const fn = raw[key as keyof SessionCallbacks];
    if (typeof fn !== 'function') {
      wrapped[key] = fn;
      continue;
    }
    wrapped[key] = (...args: unknown[]) => {
      try {
        const result = (fn as (...a: unknown[]) => unknown)(...args);
        if (result instanceof Promise) {
          return result.catch((err: unknown) => log.error(`callback ${key} rejected:`, err));
        }
        return result;
      } catch (err) {
        log.error(`callback ${key} threw:`, err);
      }
    };
  }
  return wrapped as SessionCallbacks;
}

export function buildCrashMessage(info?: DisconnectInfo): string | null {
  if (!info) return null;
  return `process exited unexpectedly (code: ${info.exitCode ?? 'unknown'}, signal: ${info.signal ?? 'none'})`;
}

export type SessionOptions = {
  promptTimeoutMs?: number;
  maxStartRetries?: number;
  maxResumeRetries?: number;
  approvalCacheMaxSize?: number;
};

// ─── AcpSession ────────────────────────────────────────────────────

export class AcpSession {
  private _status: SessionStatus = 'idle';

  readonly configTracker = new ConfigTracker();
  readonly translator: EventTranslator;
  readonly callbacks: SessionCallbacks;

  private readonly permissionResolver: PermissionResolver;
  private readonly inputPreprocessor: InputPreprocessor;

  // 生命周期（连接、会话 id、认证、重试）
  private _sessionId: string | null = null;
  private _client: ProcessAcpClient | null = null;
  private authPending = false;
  private cachedAuthMethods: AuthMethod[] | null = null;
  private startRetryCount = 0;
  private resumeRetryCount = 0;
  readonly authNegotiator: AuthNegotiator;

  // prompt 执行
  private pendingPrompt: PromptContent | null = null;
  private readonly timer: PromptTimer;

  constructor(
    private readonly config: AgentConnectionConfig,
    private readonly spawnSpec: AcpLaunchSpec,
    callbacks: SessionCallbacks,
    options?: SessionOptions
  ) {
    this.callbacks = wrapCallbacks(callbacks);
    this.translator = new EventTranslator(config.foucSessionId);
    this.inputPreprocessor = new InputPreprocessor((p) => fs.readFileSync(p, 'utf-8'));
    this.permissionResolver = new PermissionResolver({
      autoApproveAll: config.yoloMode ?? false,
      cacheMaxSize: options?.approvalCacheMaxSize,
    });
    this.authNegotiator = new AuthNegotiator(config.agentBackend);
    if (config.authCredentials) this.authNegotiator.mergeCredentials(config.authCredentials);
    if (config.resumeSessionId) this._sessionId = config.resumeSessionId;
    this.timer = new PromptTimer(options?.promptTimeoutMs ?? 300_000, () => this.handleTimeout());
    this.maxStartRetries = options?.maxStartRetries ?? 3;
    this.maxResumeRetries = options?.maxResumeRetries ?? 2;
  }

  private readonly maxStartRetries: number;
  private readonly maxResumeRetries: number;

  // ─── 状态机 ────────────────────────────────────────────────────

  get status(): SessionStatus {
    return this._status;
  }

  get sessionId(): string | null {
    return this._sessionId;
  }

  get client(): ProcessAcpClient | null {
    return this._client;
  }

  get isAuthPending(): boolean {
    return this.authPending;
  }

  setStatus(newStatus: SessionStatus): void {
    const allowed = VALID_TRANSITIONS[this._status];
    if (!allowed.includes(newStatus)) {
      log.warn(`Invalid status transition: ${this._status} → ${newStatus}`);
      return;
    }
    this._status = newStatus;
    this.callbacks.onStatusChange(newStatus);
  }

  // ─── 公共 API ──────────────────────────────────────────────────

  start(): void {
    if (this._status !== 'idle' && this._status !== 'error') return;
    log.info(`Starting session with backend ${this.config.agentBackend}`);
    this.startRetryCount = 0;
    void this.doStart().catch((err) => this.handleStartError(err));
  }

  async stop(): Promise<void> {
    this.timer.stop();
    this.permissionResolver.rejectAll(new Error('Session stopped'));
    this.pendingPrompt = null;
    this.authPending = false;
    await this.teardown();
    this.setStatus('idle');
  }

  async suspend(): Promise<void> {
    if (this._status !== 'active') return;
    await this.teardown();
    this.setStatus('suspended');
  }

  retryAuth(credentials?: Record<string, string>): void {
    if (!this.authPending) return;
    this.authPending = false;
    if (credentials) this.authNegotiator.mergeCredentials(credentials);
    void this.doStart().catch((err) => this.handleStartError(err));
  }

  async sendMessage(text: string, files?: string[]): Promise<void> {
    const content = this.inputPreprocessor.process(text, files);
    switch (this._status) {
      case 'active':
        await this.executePrompt(content);
        return;
      case 'suspended':
        this.pendingPrompt = content;
        this.resume();
        return;
      default:
        throw new AcpError('INVALID_STATE', `Cannot send in ${this._status} state`);
    }
  }

  cancelPrompt(): void {
    this.timer.stop();
    this.permissionResolver.rejectAll(new Error('Prompt cancelled'));
    if (this._status !== 'prompting' || !this._client || !this._sessionId) return;
    this._client.cancel(this._sessionId).catch(() => {});
  }

  cancelAll(): void {
    this.pendingPrompt = null;
    if (this._status === 'prompting') this.cancelPrompt();
  }

  setModel(modelId: string): void {
    this.configTracker.setDesiredModel(modelId);
    if (this._status === 'active' && this._client && this._sessionId) {
      this._client
        .setModel(this._sessionId, modelId)
        .then(() => this.configTracker.setCurrentModel(modelId))
        .then(() => this.callbacks.onModelUpdate(this.configTracker.modelSnapshot()))
        .catch((err) => log.warn('setModel failed:', err));
    }
  }

  setMode(modeId: string): void {
    this.configTracker.setDesiredMode(modeId);
    if (this._status === 'active' && this._client && this._sessionId) {
      this._client
        .setMode(this._sessionId, modeId)
        .then(() => this.configTracker.setCurrentMode(modeId))
        .then(() => this.callbacks.onModeUpdate(this.configTracker.modeSnapshot()))
        .catch((err) => log.warn('setMode failed:', err));
    }
  }

  setConfigOption(id: string, value: string | boolean): void {
    this.configTracker.setDesiredConfigOption(id, value);
    if (this._status === 'active' && this._client && this._sessionId) {
      this._client
        .setConfigOption(this._sessionId, id, value)
        .then(() => this.configTracker.setCurrentConfigOption(id, value))
        .catch((err) => log.warn('setConfigOption failed:', err));
    }
  }

  confirmPermission(callId: string, optionId: string): void {
    this.permissionResolver.resolve(callId, optionId);
  }

  /** 当前 YOLO 模式 id 是否在该 Agent 的可用模式中（外部诊断用） */
  getYoloModeId(): string | null {
    return this.config.behaviorPolicy.yoloModeId ?? null;
  }

  // ─── 启动 ──────────────────────────────────────────────────────

  private async doStart(): Promise<void> {
    this.setStatus('starting');
    try {
      await this.spawnAndInit();
      const sessionResult = await this.establishSession();
      if (!sessionResult) return; // 需要认证，已处理
      this.applySessionResult(sessionResult);
      await this.reassertConfig();
      this.flushPendingPrompt();
    } catch (err) {
      this.handleStartError(err);
    }
  }

  private async spawnAndInit(): Promise<void> {
    const handlers = this.buildProtocolHandlers();
    const client = new ProcessAcpClient(async () => {
      const { spawnAgentProcess, prepareCleanEnv } = await import('../../../execution/process');
      const env = await prepareCleanEnv(this.config.env);
      return spawnAgentProcess({ command: this.spawnSpec.command, args: this.spawnSpec.args, cwd: this.spawnSpec.cwd, env });
    }, { backend: this.config.agentBackend, handlers, gracePeriodMs: this.config.gracePeriodMs });
    this._client = client;
    client.onDisconnect((info) => this.onDisconnect(info));

    const initResult = await client.start();

    if (initResult.authMethods && initResult.authMethods.length > 0) {
      this.cachedAuthMethods = initResult.authMethods;
    }

    // qwen-code 只在 initialize 时宣告可用模式，此处预置
    const modes = (initResult as unknown as { modes?: { currentModeId?: string; availableModes?: Array<{ id: string; name?: string; description?: string }> } }).modes;
    if (modes) {
      this.configTracker.syncFromInitializeResult(modes);
    }

    this.callbacks.onInitialize?.(initResult);
  }

  /** 返回 null 表示需要认证（调用方应退出启动流程） */
  private async establishSession(): Promise<NewSessionResponse | LoadSessionResponse | null> {
    const mcpServers = McpConfig.merge({ userServers: this.config.mcpServers });
    try {
      return this._sessionId
        ? await this.tryLoadOrCreate(mcpServers)
        : await this.createSessionViaClient(mcpServers);
    } catch (err) {
      const normalized = normalizeError(err);
      if (normalized.code === 'AUTH_REQUIRED') {
        this.authPending = true;
        await this.teardown();
        this.callbacks.onSignal({
          type: 'auth_required',
          auth: this.authNegotiator.buildAuthRequiredData(this.cachedAuthMethods ?? undefined),
        });
        return null;
      }
      throw err;
    }
  }

  private handleStartError(err: unknown): void {
    const acpErr = normalizeError(err);
    log.error(`start failed (${acpErr.code}, retryable=${acpErr.retryable}): ${acpErr.message}`);

    if (acpErr.retryable && this.startRetryCount < this.maxStartRetries) {
      this.startRetryCount++;
      void this.teardown().then(() => {
        const delay = 1000 * Math.pow(2, this.startRetryCount - 1);
        setTimeout(() => void this.doStart().catch((e) => this.handleStartError(e)), delay);
      });
    } else {
      void this.teardown().then(() => this.enterError(acpErr.message));
    }
  }

  // ─── 恢复 ──────────────────────────────────────────────────────

  resume(): void {
    void this.doResume().catch((err) => this.handleResumeError(err));
  }

  private async doResume(): Promise<void> {
    this.setStatus('resuming');
    try {
      await this.spawnAndInit();
      await this.tryLoadOrCreate(McpConfig.merge({ userServers: this.config.mcpServers }));
      await this.reassertConfig();
      this.setStatus('active');
      this.flushPendingPrompt();
    } catch (err) {
      this.handleResumeError(err);
    }
  }

  private handleResumeError(err: unknown): void {
    const acpErr = normalizeError(err);
    if (acpErr.retryable && this.resumeRetryCount < this.maxResumeRetries) {
      this.resumeRetryCount++;
      void this.teardown().then(() => {
        const delay = 1000 * Math.pow(2, this.resumeRetryCount - 1);
        setTimeout(() => void this.doResume().catch((e) => this.handleResumeError(e)), delay);
      });
    } else {
      void this.teardown().then(() => this.enterError(acpErr.message));
    }
  }

  /** 断连后重置恢复计数并触发恢复 */
  resumeFromDisconnect(): void {
    this.resumeRetryCount = 0;
    this.resume();
  }

  // ─── 会话结果应用 ─────────────────────────────────────────────

  private async createSessionViaClient(mcpServers: ReturnType<typeof McpConfig.merge>): Promise<NewSessionResponse> {
    return this._client!.createSession({
      cwd: this.config.cwd,
      mcpServers,
      additionalDirectories: this.config.additionalDirectories,
    });
  }

  private async tryLoadOrCreate(mcpServers: ReturnType<typeof McpConfig.merge>): Promise<NewSessionResponse | LoadSessionResponse> {
    if (this._sessionId && this._client) {
      try {
        return await this._client.loadSession({
          sessionId: this._sessionId,
          cwd: this.config.cwd,
          mcpServers,
          additionalDirectories: this.config.additionalDirectories,
        });
      } catch {
        this.callbacks.onSignal({ type: 'session_expired' });
        this._sessionId = null;
      }
    }
    return this.createSessionViaClient(mcpServers);
  }

  private applySessionResult(sessionResult: NewSessionResponse | LoadSessionResponse): void {
    const result = sessionResult as unknown as {
      sessionId?: string;
      models?: { currentModelId?: string | null; availableModels?: Array<{ modelId?: string; name?: string; description?: string }> };
      modes?: { currentModeId?: string | null; availableModes?: Array<{ id: string; name?: string; description?: string }> };
      configOptions?: Array<{ id: string; name?: string; type?: string; currentValue?: string }>;
    };

    if (typeof result.sessionId === 'string') {
      this._sessionId = result.sessionId;
    }
    this.callbacks.onSessionId(this._sessionId!);

    this.configTracker.syncFromSessionResult({
      currentModelId: result.models?.currentModelId ?? undefined,
      availableModels: result.models?.availableModels,
      currentModeId: result.modes?.currentModeId ?? undefined,
      availableModes: result.modes?.availableModes,
      configOptions: (result.configOptions ?? []).map((opt) => ({
        id: opt.id,
        name: opt.name ?? opt.id,
        type: (opt.type as 'select' | 'boolean' | 'string') ?? 'string',
        currentValue: opt.currentValue,
      })),
    });

    this.callbacks.onConfigUpdate(this.configTracker.configSnapshot());
    this.callbacks.onModelUpdate(this.configTracker.modelSnapshot());
    this.callbacks.onModeUpdate(this.configTracker.modeSnapshot());

    this.translator.reset();
    this.setStatus('active');

    // YOLO：让 Agent 进入全自动模式停止发权限请求；客户端 autoApproveAll 兜底
    if (this.config.yoloMode) this.applyYoloMode();
  }

  private applyYoloMode(): void {
    const availableModes = this.configTracker.modeSnapshot().availableModes;
    const yoloModeId = this.config.behaviorPolicy.yoloModeId ?? null;
    if (!yoloModeId || !availableModes.some((m) => m.id === yoloModeId)) {
      log.warn(`No YOLO mode found for ${this.config.agentBackend}, falling back to client-side auto-approve only`);
      return;
    }
    this.configTracker.setDesiredMode(yoloModeId);
    if (this._client && this._sessionId) {
      this._client
        .setMode(this._sessionId, yoloModeId)
        .then(() => {
          this.configTracker.setCurrentMode(yoloModeId);
          this.callbacks.onModeUpdate(this.configTracker.modeSnapshot());
        })
        .catch((err) => log.warn('YOLO setMode failed:', err));
    }
  }

  private async reassertConfig(): Promise<void> {
    if (!this._client || !this._sessionId) return;
    const pending = this.configTracker.getPendingChanges();
    if (pending.model) {
      try {
        await this._client.setModel(this._sessionId, pending.model);
        this.configTracker.setCurrentModel(pending.model);
      } catch {
        /* best effort */
      }
    }
    if (pending.mode) {
      try {
        await this._client.setMode(this._sessionId, pending.mode);
        this.configTracker.setCurrentMode(pending.mode);
      } catch {
        /* best effort */
      }
    }
    for (const opt of pending.configOptions) {
      try {
        await this._client.setConfigOption(this._sessionId, opt.id, opt.value);
        this.configTracker.setCurrentConfigOption(opt.id, opt.value);
      } catch {
        /* best effort */
      }
    }
  }

  // ─── prompt 执行 ──────────────────────────────────────────────

  private async executePrompt(content: PromptContent): Promise<void> {
    if (!this._client || !this._sessionId) return;
    this.setStatus('prompting');

    try {
      await this.reassertConfig();
    } catch {
      /* best effort —— 配置同步失败不阻塞 prompt */
    }

    try {
      this.timer.start();
      const result = await this._client.prompt(this._sessionId, content);
      this.timer.stop();

      const typed = result as unknown as {
        stopReason?: string;
        usage?: { totalTokens?: number; inputTokens?: number; outputTokens?: number };
      };

      // 不发 usage_update 的后端：从 PromptResponse 兜底发上下文用量
      if (typed.usage?.totalTokens !== undefined) {
        this.callbacks.onContextUsage({ used: typed.usage.totalTokens, total: 0, percentage: 0 });
      }

      this.translator.onTurnEnd();
      this.setStatus('active');
      this.callbacks.onSignal({
        type: 'turn_finished',
        stopReason: typed.stopReason ?? null,
        usage: typed.usage ?? null,
      });
    } catch (err) {
      this.timer.stop();
      this.translator.onTurnEnd();
      this.handlePromptError(err, content);
      return;
    }
  }

  private handlePromptError(err: unknown, content: PromptContent): void {
    const acpErr = normalizeError(err);

    if (acpErr.code === 'AUTH_REQUIRED') {
      this.pendingPrompt = content;
      this.authPending = true;
      void this.teardown().then(() => {
        this.setStatus('error');
        this.callbacks.onSignal({
          type: 'auth_required',
          auth: this.authNegotiator.buildAuthRequiredData(undefined),
        });
      });
      return;
    }

    log.error(`prompt failed (${acpErr.code}): ${acpErr.message}`);

    if (acpErr.retryable) {
      this.setStatus('active');
      this.callbacks.onSignal({ type: 'error', message: acpErr.message, recoverable: true });
    } else {
      this.enterError(acpErr.message);
    }
    throw acpErr;
  }

  private handleTimeout(): void {
    if (this._status !== 'prompting') return;
    this.cancelPrompt();
    this.callbacks.onSignal({ type: 'error', message: 'Prompt timed out', recoverable: true });
  }

  private flushPendingPrompt(): void {
    if (this.pendingPrompt && this._status === 'active') {
      const content = this.pendingPrompt;
      this.pendingPrompt = null;
      void this.executePrompt(content);
    }
  }

  // ─── 断连分派 ──────────────────────────────────────────────────

  private onDisconnect(info?: DisconnectInfo): void {
    switch (this._status) {
      case 'idle':
      case 'suspended':
      case 'error':
        return;

      case 'prompting': {
        this._client = null;
        this.emitCrashSignalIfProcessDied(info);
        this.timer.stop();
        this.permissionResolver.rejectAll(new Error('Process disconnected'));
        this.resumeFromDisconnect();
        return;
      }

      case 'active': {
        // 空闲时进程退出是正常生命周期事件（如 codex-acp 不活跃超时自退），
        // 静默转 suspended 让下次 sendMessage 重新拉起；不发崩溃信号
        this._client = null;
        this.setStatus('suspended');
        return;
      }

      default: {
        // starting / resuming 中死亡 —— 按崩溃处理
        this._client = null;
        this.emitCrashSignalIfProcessDied(info);
        this.setStatus('suspended');
      }
    }
  }

  private emitCrashSignalIfProcessDied(info?: DisconnectInfo): void {
    const msg = buildCrashMessage(info);
    if (!msg) return;
    this.callbacks.onSignal({ type: 'error', message: msg, recoverable: true });
  }

  enterError(message: string): void {
    this.pendingPrompt = null;
    this.permissionResolver.rejectAll(new Error(message));
    this.timer.stop();
    this.setStatus('error');
    this.callbacks.onSignal({ type: 'error', message, recoverable: false });
  }

  // ─── 路径校验（防目录穿越） ────────────────────────────────────

  private assertPathAllowed(filePath: string): void {
    const resolved = path.resolve(filePath);
    const allowedRoots = [this.config.cwd, ...(this.config.additionalDirectories ?? [])];
    const withinAllowed = allowedRoots.some(
      (root) => resolved.startsWith(path.resolve(root) + path.sep) || resolved === path.resolve(root)
    );
    if (!withinAllowed) {
      throw new Error(`Path not allowed: ${filePath} is outside permitted directories`);
    }
  }

  // ─── 协议处理器（粘合层） ──────────────────────────────────────

  private buildProtocolHandlers(): ProtocolHandlers {
    return {
      onSessionUpdate: (notification) => this.handleMessage(notification),
      onRequestPermission: (request) => this.handlePermissionRequest(request),
      onReadTextFile: async (req) => {
        this.assertPathAllowed(req.path);
        try {
          const content = fs.readFileSync(req.path, 'utf-8');
          return { content };
        } catch {
          throw new Error(`File not found: ${req.path}`);
        }
      },
      onWriteTextFile: async (req) => {
        this.assertPathAllowed(req.path);
        try {
          fs.writeFileSync(req.path, req.content, 'utf-8');
          return {};
        } catch {
          throw new Error(`Write failed: ${req.path}`);
        }
      },
    };
  }

  private handleMessage(notification: Parameters<ProtocolHandlers['onSessionUpdate']>[0]): void {
    const update = notification.update as unknown as Record<string, unknown> & { sessionUpdate: string };

    switch (update.sessionUpdate) {
      case 'current_mode_update': {
        const currentModeId = (update as unknown as { currentModeId?: string }).currentModeId;
        this.configTracker.setCurrentMode(currentModeId ?? '');
        this.callbacks.onModeUpdate(this.configTracker.modeSnapshot());
        return;
      }
      case 'config_option_update':
        this.callbacks.onConfigUpdate(this.configTracker.configSnapshot());
        return;
      case 'available_commands_update':
        this.callbacks.onConfigUpdate(this.configTracker.configSnapshot());
        return;
      case 'usage_update': {
        const u = update as unknown as UsageUpdate & { used?: number; size?: number; cost?: { amount: number; currency: string } };
        this.callbacks.onContextUsage({
          used: u.used ?? 0,
          total: u.size ?? 0,
          percentage: (u.size ?? 0) > 0 ? Math.round(((u.used ?? 0) / (u.size ?? 1)) * 100) : 0,
        });
        return;
      }
    }

    this.timer.reset();
    for (const event of this.translator.translate(notification)) {
      this.callbacks.onEvent(event);
    }
  }

  private async handlePermissionRequest(
    request: Parameters<ProtocolHandlers['onRequestPermission']>[0]
  ): ReturnType<ProtocolHandlers['onRequestPermission']> {
    this.timer.pause();
    try {
      return await this.permissionResolver.evaluate(request, (data) => {
        this.callbacks.onPermissionRequest(data);
      });
    } finally {
      this.timer.resume();
    }
  }

  // ─── 清理 ──────────────────────────────────────────────────────

  private async teardown(): Promise<void> {
    if (this._client) {
      try {
        await this._client.close();
      } catch {
        /* best effort */
      }
      this._client = null;
    }
  }
}
