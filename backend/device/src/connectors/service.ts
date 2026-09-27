import { randomUUID } from 'node:crypto';
import type {
  ConnectorConnectInteraction, ConnectorDetailDto, ConnectorInstance, ConnectorProviderDefinition,
  DtsTicketDetail, DtsTicketListInput, DtsTicketListResult,
} from '@fouc/shared';
import { ConnectorRepository } from './repository';
import { ConnectorError, DTS_LOGIN_URL, DTS_PROVIDER, DtsRuntime, type CookieHandoff } from './dts/provider';

type PendingInteraction = { instanceId: string; expiresAt: number };

export class ConnectorService {
  private readonly providers = new Map<string, ConnectorProviderDefinition>([[DTS_PROVIDER.id, DTS_PROVIDER]]);
  private readonly runtimes = new Map<string, DtsRuntime>();
  private readonly pending = new Map<string, PendingInteraction>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly repository: ConnectorRepository) {
    const instance = repository.ensureDtsInstance();
    // Cookie 只驻留内存；sidecar 重启后持久化状态不能冒充有效会话。
    if (instance.authState === 'valid' || instance.authState === 'connecting') {
      repository.patch(instance.id, {
        authState: 'needs_user_action',
        healthState: 'unknown',
        identity: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      });
    }
  }

  startHeartbeat(intervalMs = 5 * 60_000): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => void this.heartbeatAll(), intervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  listProviders(): ConnectorProviderDefinition[] { return [...this.providers.values()]; }
  listInstances(): ConnectorInstance[] { return this.repository.list(); }

  detail(instanceId: string): ConnectorDetailDto {
    const instance = this.requireInstance(instanceId);
    const provider = this.providers.get(instance.providerId);
    if (!provider) throw new ConnectorError('provider_not_found', '连接器 Provider 不存在', 404);
    return { provider, instance, heartbeats: this.repository.heartbeats(instanceId), invocations: this.repository.invocations(instanceId) };
  }

  beginConnect(instanceId: string): ConnectorConnectInteraction {
    const instance = this.requireInstance(instanceId);
    if (instance.providerId !== 'dts') throw new ConnectorError('unsupported_auth', '该连接器暂不支持此认证流程');
    const now = Date.now();
    for (const [id, interaction] of this.pending) {
      if (interaction.expiresAt <= now) this.pending.delete(id);
      else if (interaction.instanceId === instanceId) {
        return { interactionId: id, kind: 'open_managed_web_session', url: DTS_LOGIN_URL, expiresAt: interaction.expiresAt };
      }
    }
    const interactionId = randomUUID();
    const expiresAt = now + 10 * 60_000;
    this.pending.set(interactionId, { instanceId, expiresAt });
    this.repository.patch(instanceId, { authState: 'connecting', healthState: 'unknown', lastErrorCode: null, lastErrorMessage: null });
    return { interactionId, kind: 'open_managed_web_session', url: DTS_LOGIN_URL, expiresAt };
  }

  async completeDtsConnect(interactionId: string, cookies: CookieHandoff[]): Promise<ConnectorInstance> {
    const interaction = this.pending.get(interactionId);
    if (!interaction || interaction.expiresAt < Date.now()) {
      this.pending.delete(interactionId);
      throw new ConnectorError('interaction_expired', '登录交互已过期，请重新连接', 410);
    }
    if (!cookies.length || cookies.length > 200) throw new ConnectorError('invalid_credentials', '未取得有效 DTS 会话 Cookie');
    const runtime = this.runtime(interaction.instanceId);
    runtime.importCookies(cookies);
    try {
      const identity = await runtime.identity();
      const now = Date.now();
      this.pending.delete(interactionId);
      return this.repository.patch(interaction.instanceId, {
        authState: 'valid', healthState: 'healthy', identity, connectedAt: now,
        lastHeartbeatAt: now, lastErrorCode: null, lastErrorMessage: null,
      })!;
    } catch (error) {
      runtime.clear();
      const normalized = normalizeError(error);
      // WebView 返回 DTS 后，浏览器可能仍在落最后一批 Cookie。原生层会在短时间内
      // 重新交接；在它明确取消或超时前，这只是一次中间验证失败，不能提前结束登录流程。
      this.repository.patch(interaction.instanceId, { authState: 'connecting', healthState: 'unknown', lastErrorCode: normalized.code, lastErrorMessage: normalized.message });
      throw normalized;
    }
  }

  cancelConnect(interactionId: string, errorCode = 'cancelled', errorMessage = '已取消登录'): void {
    const interaction = this.pending.get(interactionId);
    if (!interaction) return;
    this.pending.delete(interactionId);
    this.repository.patch(interaction.instanceId, {
      authState: 'needs_user_action',
      healthState: 'unknown',
      lastErrorCode: errorCode,
      lastErrorMessage: errorMessage,
    });
  }

  disconnect(instanceId: string): ConnectorInstance {
    this.requireInstance(instanceId);
    this.runtimes.get(instanceId)?.clear();
    this.runtimes.delete(instanceId);
    return this.repository.patch(instanceId, {
      authState: 'unconfigured', healthState: 'unknown', identity: null, connectedAt: null,
      lastHeartbeatAt: null, lastHeartbeatDurationMs: null, lastErrorCode: null, lastErrorMessage: null,
    })!;
  }

  async heartbeat(instanceId: string): Promise<ConnectorInstance> {
    this.requireInstance(instanceId);
    const startedAt = Date.now();
    try {
      const identity = await this.runtime(instanceId).identity();
      const duration = Date.now() - startedAt;
      const now = Date.now();
      this.repository.addHeartbeat(instanceId, 'healthy', duration, null, now);
      return this.repository.patch(instanceId, { authState: 'valid', healthState: 'healthy', identity, lastHeartbeatAt: now, lastHeartbeatDurationMs: duration, lastErrorCode: null, lastErrorMessage: null })!;
    } catch (error) {
      const normalized = normalizeError(error);
      const state = normalized.code === 'network_unreachable' || normalized.code === 'timeout' ? 'unreachable' : 'degraded';
      const authState = ['session_expired', 'authentication_required'].includes(normalized.code) ? 'needs_user_action' : this.requireInstance(instanceId).authState;
      const duration = Date.now() - startedAt;
      const now = Date.now();
      this.repository.addHeartbeat(instanceId, state, duration, normalized.code, now);
      this.repository.patch(instanceId, { authState, healthState: state, lastHeartbeatAt: now, lastHeartbeatDurationMs: duration, lastErrorCode: normalized.code, lastErrorMessage: normalized.message });
      throw normalized;
    }
  }

  async dtsFilters(instanceId: string) {
    return this.invoke(instanceId, 'dts.filters.list', null, () => this.runtime(instanceId).filters());
  }

  async dtsTickets(instanceId: string, input: DtsTicketListInput): Promise<DtsTicketListResult> {
    return this.invoke(instanceId, 'dts.tickets.list', { filter: input.filter, page: input.page, pageSize: input.pageSize, keywordLength: input.keyword?.length ?? 0 }, () => this.runtime(instanceId).list(input));
  }

  async dtsTicket(instanceId: string, id: string): Promise<DtsTicketDetail> {
    return this.invoke(instanceId, 'dts.tickets.get', { ticketId: id }, () => this.runtime(instanceId).detail(id));
  }

  private async invoke<T>(instanceId: string, capabilityId: string, inputSummary: unknown, execute: () => Promise<T>): Promise<T> {
    const instance = this.requireInstance(instanceId);
    if (instance.desiredState !== 'enabled') throw new ConnectorError('connector_disabled', '连接器已停用');
    if (instance.authState !== 'valid' || !this.runtime(instanceId).hasSession) throw new ConnectorError('authentication_required', 'DTS 需要重新登录', 401);
    const id = randomUUID();
    const startedAt = Date.now();
    this.repository.startInvocation({ id, instanceId, providerId: instance.providerId, capabilityId, status: 'running', inputSummary: inputSummary == null ? null : JSON.stringify(inputSummary), resultSummary: null, errorCode: null, startedAt, endedAt: null, durationMs: null });
    try {
      const result = await execute();
      const count = result && typeof result === 'object' && 'items' in result ? Array.isArray((result as { items?: unknown[] }).items) ? (result as { items: unknown[] }).items.length : null : null;
      this.repository.finishInvocation(id, 'succeeded', count == null ? 'ok' : `${count} items`, null);
      return result;
    } catch (error) {
      const normalized = normalizeError(error);
      this.repository.finishInvocation(id, 'failed', null, normalized.code);
      if (['session_expired', 'authentication_required'].includes(normalized.code)) this.repository.patch(instanceId, { authState: 'needs_user_action', healthState: 'degraded', lastErrorCode: normalized.code, lastErrorMessage: normalized.message });
      throw normalized;
    }
  }

  private runtime(instanceId: string): DtsRuntime {
    let runtime = this.runtimes.get(instanceId);
    if (!runtime) { runtime = new DtsRuntime(instanceId); this.runtimes.set(instanceId, runtime); }
    return runtime;
  }

  private requireInstance(instanceId: string): ConnectorInstance {
    const instance = this.repository.byId(instanceId);
    if (!instance) throw new ConnectorError('not_found', '连接实例不存在', 404);
    return instance;
  }

  private async heartbeatAll(): Promise<void> {
    await Promise.allSettled(this.repository.list().filter((item) => item.desiredState === 'enabled' && item.authState === 'valid').map((item) => this.heartbeat(item.id)));
  }
}

export function normalizeError(error: unknown): ConnectorError {
  return error instanceof ConnectorError ? error : new ConnectorError('internal_error', error instanceof Error ? error.message : '连接器内部错误', 500);
}
