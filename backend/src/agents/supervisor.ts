/**
 * 会话监督者：会话池、Run 生命周期、事件持久化与广播、遗留进程清理。
 *
 * 会话引擎为移植的 AcpSession（七态 FSM）；本层负责：
 *  - AgentSession/AgentRun 行的持久化与状态同步
 *  - 事件的 runId 注入、事件日志追加与 WS 广播
 *  - 审批请求/裁决的桥接
 *  - 启动时孤儿 Run 标记（F4-lite：重启不误标成功、不丢记录）
 */

import { randomUUID } from 'node:crypto';
import type { AgentEvent, AgentRun, AgentSession as AgentSessionRow, SessionStatus } from '@shared/index';
import { AgentRegistry } from './registry';
import { buildLaunchSpec } from './launch';
import { AcpSession } from './driver/acp/session';
import type { AgentConnectionConfig, SessionCallbacks } from './driver/acp/types';
import type { EventRepository, RunRepository, SessionRepository } from '../store/repositories';
import { createLogger } from '../platform/logger';
import { isProcessAlive } from '../execution/process';

const log = createLogger('supervisor');

interface SupervisedSession {
  session: AcpSession;
  installationId: string;
  providerId: string;
  rowId: string;
  currentRunId: string | null;
  lastActiveAt: number;
}

export type EventSink = (event: AgentEvent) => void;

export class SessionSupervisor {
  private readonly sessions = new Map<string, SupervisedSession>();

  constructor(
    private readonly registry: AgentRegistry,
    private readonly sessionRepo: SessionRepository,
    private readonly runRepo: RunRepository,
    private readonly eventRepo: EventRepository,
    private readonly emitEvent: EventSink
  ) {}

  // ─── 启动恢复 ──────────────────────────────────────────────────

  /** 应用重启后：把无存活连接的未决 Run 标记为 failed(orphaned)，不误标成功 */
  markOrphanedRuns(): number {
    const unresolved = this.runRepo.findUnresolved();
    let count = 0;
    for (const run of unresolved) {
      this.runRepo.update(run.id, {
        status: 'failed',
        endedAt: Date.now(),
        exitInfo: {
          exitCode: null,
          signal: null,
          reason: 'orphaned',
          stderr: '',
          unexpectedDuringPrompt: true,
        },
      });
      count += 1;
    }
    if (count > 0) log.warn(`Marked ${count} orphaned run(s) as failed after restart`);
    return count;
  }

  // ─── 会话管理 ──────────────────────────────────────────────────

  async createSession(installationId: string, workDir: string, options?: { yoloMode?: boolean }): Promise<AgentSessionRow> {
    const installation = this.registry.installationById(installationId);
    if (!installation) throw new Error(`Installation not found: ${installationId}`);
    const provider = this.registry.providerById(installation.providerId);
    if (!provider) throw new Error(`Provider not found: ${installation.providerId}`);

    if (installation.status !== 'ready' && installation.status !== 'needs_auth') {
      throw new Error(`Installation is ${installation.status}; run a health check first`);
    }
    if (!installation.enabled) throw new Error('Installation is disabled');

    const sessionId = randomUUID();
    const now = Date.now();
    const row: AgentSessionRow = {
      id: sessionId,
      installationId,
      providerId: provider.id,
      workDir,
      nativeSessionId: null,
      status: 'starting',
      createdAt: now,
      lastActiveAt: now,
      endedAt: null,
      endReason: null,
    };
    this.sessionRepo.insert(row);

    const spec = buildLaunchSpec(provider, installation, workDir);
    const config: AgentConnectionConfig = {
      agentBackend: provider.id,
      foucSessionId: sessionId,
      command: spec.command,
      args: spec.args,
      cwd: workDir,
      env: spec.env,
      gracePeriodMs: spec.gracePeriodMs,
      behaviorPolicy: provider.behaviorPolicy,
      yoloMode: options?.yoloMode ?? false,
    };

    const supervised: SupervisedSession = {
      session: new AcpSession(config, spec, this.buildCallbacks(sessionId, installationId), {
        promptTimeoutMs: 300_000,
      }),
      installationId,
      providerId: provider.id,
      rowId: sessionId,
      currentRunId: null,
      lastActiveAt: now,
    };
    this.sessions.set(sessionId, supervised);

    supervised.session.start();
    return row;
  }

  async terminateSession(sessionId: string, reason = 'user_terminated'): Promise<void> {
    const supervised = this.sessions.get(sessionId);
    if (supervised) {
      await supervised.session.stop();
      this.sessions.delete(sessionId);
    }
    const row = this.sessionRepo.byId(sessionId);
    if (row && row.status !== 'ended') {
      this.sessionRepo.update(sessionId, {
        status: 'ended',
        endedAt: Date.now(),
        endReason: reason,
      });
      this.emit({ type: 'session.ended', sessionId, reason });
    }
  }

  getSession(sessionId: string): AgentSessionRow | null {
    return this.sessionRepo.byId(sessionId);
  }

  listSessions(): AgentSessionRow[] {
    return this.sessionRepo.listAll();
  }

  getNativeSessionHandle(sessionId: string): AcpSession | null {
    return this.sessions.get(sessionId)?.session ?? null;
  }

  // ─── Run 管理 ──────────────────────────────────────────────────

  async startRun(sessionId: string, input: string, files?: string[]): Promise<AgentRun> {
    const supervised = this.sessions.get(sessionId);
    if (!supervised) throw new Error(`Session not active: ${sessionId}`);

    const runId = randomUUID();
    const run: AgentRun = {
      id: runId,
      sessionId,
      seq: this.runRepo.nextSeq(sessionId),
      input,
      status: 'running',
      startedAt: Date.now(),
      endedAt: null,
      exitInfo: null,
      stopReason: null,
      usage: null,
    };
    this.runRepo.insert(run);

    supervised.currentRunId = runId;
    supervised.lastActiveAt = Date.now();
    this.sessionRepo.update(sessionId, { lastActiveAt: Date.now() });

    this.emit({ type: 'run.started', sessionId, runId });

    try {
      await supervised.session.sendMessage(input, files);
    } catch (error) {
      // handlePromptError 已发 error 信号（会转为 run.failed）；
      // 这里兜底保证 run 不悬挂
      this.finalizeRun(sessionId, runId, 'failed', { message: String(error) });
    }
    return run;
  }

  async cancelRun(sessionId: string): Promise<void> {
    const supervised = this.sessions.get(sessionId);
    if (!supervised) return;
    supervised.session.cancelAll();
    const runId = supervised.currentRunId;
    if (runId) this.finalizeRun(sessionId, runId, 'cancelled');
  }

  listRuns(sessionId: string): AgentRun[] {
    return this.runRepo.listBySession(sessionId);
  }

  // ─── 审批 ──────────────────────────────────────────────────────

  resolveApproval(sessionId: string, callId: string, optionId: string): boolean {
    const supervised = this.sessions.get(sessionId);
    if (!supervised) return false;
    supervised.session.confirmPermission(callId, optionId);
    this.emit({ type: 'approval.resolved', sessionId, callId, outcome: optionId });
    return true;
  }

  // ─── 配置控制 ──────────────────────────────────────────────────

  setModel(sessionId: string, modelId: string): boolean {
    this.sessions.get(sessionId)?.session.setModel(modelId);
    return true;
  }

  setMode(sessionId: string, modeId: string): boolean {
    this.sessions.get(sessionId)?.session.setMode(modeId);
    return true;
  }

  // ─── 关停 ──────────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    const promises: Array<Promise<void>> = [];
    for (const [sessionId, supervised] of this.sessions) {
      promises.push(
        supervised.session
          .stop()
          .catch(() => {})
          .then(() => {
            this.sessionRepo.update(sessionId, { status: 'ended', endedAt: Date.now(), endReason: 'app_shutdown' });
          })
      );
    }
    await Promise.allSettled(promises);
    this.sessions.clear();
  }

  // ─── 回训装配 ──────────────────────────────────────────────────

  private buildCallbacks(sessionId: string, installationId: string): SessionCallbacks {
    return {
      onEvent: (event: AgentEvent) => this.emit(event),
      onSessionId: (nativeSessionId: string) => {
        this.sessionRepo.update(sessionId, { nativeSessionId, lastActiveAt: Date.now() });
      },
      onStatusChange: (status: SessionStatus) => {
        this.sessionRepo.update(sessionId, { status, lastActiveAt: Date.now() });
        this.emit({ type: 'session.status', sessionId, status });
      },
      onModelUpdate: (model) => this.emit({ type: 'control.updated', sessionId, model }),
      onModeUpdate: (mode) => this.emit({ type: 'control.updated', sessionId, mode }),
      onConfigUpdate: (configOptions) => this.emit({ type: 'control.updated', sessionId, configOptions }),
      onContextUsage: (usage) => this.emit({ type: 'context.usage', sessionId, usage }),
      onPermissionRequest: (data) => {
        const runId = this.sessions.get(sessionId)?.currentRunId ?? null;
        const supervised = this.sessions.get(sessionId);
        if (supervised && runId) {
          this.runRepo.update(runId, { status: 'waiting_approval' });
        }
        this.emit({ type: 'approval.required', sessionId, runId, approval: data });
      },
      onSignal: (signal) => {
        const supervised = this.sessions.get(sessionId);
        const runId = supervised?.currentRunId ?? null;
        switch (signal.type) {
          case 'turn_finished': {
            if (runId) {
              this.finalizeRun(sessionId, runId, 'completed', {
                stopReason: signal.stopReason,
                usage: signal.usage,
              });
            }
            break;
          }
          case 'auth_required':
            this.emit({
              type: 'auth.required',
              sessionId,
              methods: signal.auth.methods.map((m) => ({ id: m.id, name: (m as { name?: string }).name ?? m.id })),
            });
            break;
          case 'session_expired':
            log.warn(`Session ${sessionId} expired`);
            break;
          case 'error':
            if (runId) {
              this.finalizeRun(sessionId, runId, 'failed', { message: signal.message, recoverable: signal.recoverable });
            } else {
              log.error(`Session ${sessionId} error: ${signal.message}`);
            }
            break;
        }
      },
      onInitialize: (result) => {
        void installationId;
        log.debug(`Session ${sessionId} initialized`);
        void result;
      },
    };
  }

  private finalizeRun(
    sessionId: string,
    runId: string,
    status: 'completed' | 'failed' | 'cancelled',
    extra?: { stopReason?: string | null; usage?: { totalTokens?: number } | null; message?: string; recoverable?: boolean }
  ): void {
    const run = this.runRepo.byId(runId);
    if (!run || run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') return;

    this.runRepo.update(runId, {
      status,
      endedAt: Date.now(),
      stopReason: extra?.stopReason ?? null,
      usage: (extra?.usage as AgentRun['usage']) ?? null,
    });

    const supervised = this.sessions.get(sessionId);
    if (supervised?.currentRunId === runId) supervised.currentRunId = null;

    if (status === 'completed') this.emit({ type: 'run.completed', sessionId, runId, stopReason: extra?.stopReason ?? null, usage: (extra?.usage as AgentRun['usage']) ?? null });
    else if (status === 'cancelled') this.emit({ type: 'run.cancelled', sessionId, runId });
    else this.emit({ type: 'run.failed', sessionId, runId, message: extra?.message ?? 'unknown error', recoverable: extra?.recoverable ?? false });
  }

  /** 事件出口：runId 注入 + 事件日志追加 + 广播 */
  private emit(event: AgentEvent): void {
    let enriched = event;
    if ('runId' in event && event.runId === null) {
      const supervised = this.sessions.get(event.sessionId);
      if (supervised?.currentRunId) {
        enriched = { ...event, runId: supervised.currentRunId } as AgentEvent;
      }
    }

    const sessionId = 'sessionId' in enriched ? enriched.sessionId : null;
    this.eventRepo.append(enriched, {
      sessionId,
      installationId: sessionId ? (this.sessions.get(sessionId)?.installationId ?? null) : null,
    });
    this.emitEvent(enriched);
  }

  listEvents(sessionId: string, afterId = 0): Array<{ id: number; event: AgentEvent }> {
    return this.eventRepo.listBySession(sessionId, afterId);
  }

  /** 诊断：进程存活快照 */
  diagnostics(sessionId: string): { alive: boolean; status: SessionStatus | 'unknown'; pid: number | null } {
    const supervised = this.sessions.get(sessionId);
    if (!supervised) return { alive: false, status: 'unknown', pid: null };
    const snapshot = supervised.session.client?.lifecycleSnapshot;
    return {
      alive: snapshot?.running ?? false,
      status: supervised.session.status,
      pid: snapshot?.pid ?? null,
    };
  }

  /** 供测试/诊断：进程存活检查 */
  static isProcessAlive(pid: number): boolean {
    return isProcessAlive(pid);
  }
}
