/**
 * Agent 注册中心：发现编排、探测调度、installation 状态机与持久化。
 *
 * 编排模式移植自 AionUi AgentRegistry（分区缓存 + 互斥刷新），
 * 探测并发与"未探测不定罪"纪律参考 AionCore AgentRegistry。
 */

import { createHash } from 'node:crypto';
import type { AgentEvent, AgentInstallation, InstallationSource, InstallationStatus, ProbeKind, ProviderSpec } from '@shared/index';
import { PROVIDER_CATALOG } from './catalog';
import { agentDetector } from './discovery';
import { probeInstallation, buildCapabilityFromEvidence } from './probe';
import type { ProviderRepository, InstallationRepository } from '../store/repositories';
import { clearEnvCache } from '../platform/env';
import { createLogger } from '../platform/logger';

const log = createLogger('registry');

const PROBE_CONCURRENCY = 8;
const PROBE_THROTTLE_MS = 5 * 60 * 1000; // 同一 installation 完整探测的最小间隔
const PROBE_STARTUP_DELAY_MS = 1_500;

export type InstallationChangeHandler = (installation: AgentInstallation) => void;

/** 稳定 installation id：provider + 归一化路径摘要 */
function installationId(providerId: string, executablePath: string): string {
  const normalized = executablePath.replace(/\\/g, '/').toLowerCase();
  const digest = createHash('sha256').update(`${providerId}::${normalized}`).digest('hex').substring(0, 12);
  return `${providerId}-${digest}`;
}

export class AgentRegistry {
  private readonly providers: ProviderSpec[];
  private mutationQueue: Promise<void> = Promise.resolve();
  private probing = new Set<string>();

  constructor(
    private readonly providerRepo: ProviderRepository,
    private readonly installationRepo: InstallationRepository,
    private readonly emitEvent: (event: AgentEvent) => void
  ) {
    this.providers = PROVIDER_CATALOG;
    this.providerRepo.upsertAll(this.providers);
  }

  listProviders(): ProviderSpec[] {
    return this.providers;
  }

  providerById(id: string): ProviderSpec | null {
    return this.providerRepo.byId(id);
  }

  listInstallations(): AgentInstallation[] {
    return this.installationRepo.listAll();
  }

  installationById(id: string): AgentInstallation | null {
    return this.installationRepo.byId(id);
  }

  onInstallationChanged(handler: InstallationChangeHandler): void {
    this.changeHandlers.push(handler);
  }

  private readonly changeHandlers: InstallationChangeHandler[] = [];

  private notifyChanged(installation: AgentInstallation): void {
    this.emitEvent({ type: 'installation.changed', installation });
    for (const handler of this.changeHandlers) {
      try {
        handler(installation);
      } catch (error) {
        log.error('change handler failed:', error);
      }
    }
  }

  // ─── 发现同步 ──────────────────────────────────────────────────

  /** 全量发现：PATH + 常见位置 + 已登记路径核实；返回有变化的 installation 数 */
  async syncDiscovery(): Promise<{ added: number; removed: number }> {
    return this.runExclusiveMutation(async () => {
      clearEnvCache();

      const fromPath = await agentDetector.detectFromPath(this.providers);
      const fromKnown = agentDetector.scanKnownLocations(this.providers);

      // 候选合并：PATH 命中优先于常见位置命中
      const candidateByKey = new Map<string, { providerId: string; executablePath: string; source: InstallationSource }>();
      for (const candidate of [...fromPath, ...fromKnown]) {
        const key = `${candidate.providerId}::${candidate.executablePath.replace(/\\/g, '/').toLowerCase()}`;
        if (!candidateByKey.has(key)) candidateByKey.set(key, candidate);
      }

      const existing = this.installationRepo.listAll();
      const now = Date.now();
      let added = 0;
      let removed = 0;

      // 已登记但当前不可达的 → missing（保留历史引用，不自动删除）
      const reachableKeys = new Set<string>();
      for (const key of candidateByKey.keys()) {
        reachableKeys.add(key.split('::')[1] ?? '');
      }
      for (const installation of existing) {
        if (installation.source === 'user_added') continue; // 用户路径缺失由显式操作处理
        if (installation.status === 'disabled') continue;
        const normalizedPath = installation.executablePath.replace(/\\/g, '/').toLowerCase();
        const stillReachable =
          reachableKeys.has(normalizedPath) ||
          candidateByKey.has(`${installation.providerId}::${normalizedPath}`);
        if (!stillReachable && installation.status !== 'missing') {
          this.installationRepo.update(installation.id, { status: 'missing' }, now);
          removed += 1;
          this.notifyChanged(this.installationRepo.byId(installation.id)!);
        }
      }

      // 新候选 → unchecked 登记
      for (const [key, candidate] of candidateByKey) {
        void key;
        const id = installationId(candidate.providerId, candidate.executablePath);
        if (existing.some((i) => i.id === id)) continue;
        const installation: AgentInstallation = {
          id,
          providerId: candidate.providerId,
          executablePath: candidate.executablePath,
          source: candidate.source,
          version: null,
          status: 'unchecked',
          capabilityManifest: null,
          lastProbeAt: null,
          lastProbeKind: null,
          lastProbeDurationMs: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorGuidance: null,
          enabled: this.providerRepo.byId(candidate.providerId)?.defaultEnabled ?? true,
          isDefault: false,
          createdAt: now,
          updatedAt: now,
        };
        this.installationRepo.upsert(installation);
        added += 1;
        this.notifyChanged(installation);
      }

      log.info(`Discovery sync: +${added} added, ${removed} marked missing`);
      return { added, removed };
    });
  }

  /** 用户手工添加路径 */
  addManualPath(providerId: string, executablePath: string): AgentInstallation {
    const provider = this.providerById(providerId);
    if (!provider) throw new Error(`Unknown provider: ${providerId}`);
    const id = installationId(providerId, executablePath);
    const now = Date.now();
    const existing = this.installationRepo.byId(id);
    if (existing) return existing;
    const installation: AgentInstallation = {
      id,
      providerId,
      executablePath,
      source: 'user_added',
      version: null,
      status: 'unchecked',
      capabilityManifest: null,
      lastProbeAt: null,
      lastProbeKind: null,
      lastProbeDurationMs: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastErrorGuidance: null,
      enabled: true,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };
    this.installationRepo.upsert(installation);
    this.notifyChanged(installation);
    return installation;
  }

  removeInstallation(id: string): boolean {
    const installation = this.installationRepo.byId(id);
    if (!installation) return false;
    this.installationRepo.delete(id);
    return true;
  }

  setEnabled(id: string, enabled: boolean): AgentInstallation | null {
    const installation = this.installationRepo.byId(id);
    if (!installation) return null;
    this.installationRepo.update(id, { enabled, status: enabled ? 'unchecked' : 'disabled' });
    const updated = this.installationRepo.byId(id)!;
    this.notifyChanged(updated);
    return updated;
  }

  setDefault(id: string): AgentInstallation | null {
    const installation = this.installationRepo.byId(id);
    if (!installation) return null;
    this.installationRepo.clearDefault();
    this.installationRepo.update(id, { isDefault: true });
    const updated = this.installationRepo.byId(id)!;
    this.notifyChanged(updated);
    return updated;
  }

  // ─── 探测调度 ──────────────────────────────────────────────────

  /** 应用启动后的后台刷新：发现 + 逐个探测（并发受限） */
  startupRefresh(): void {
    void (async () => {
      await this.syncDiscovery().catch((error) => log.error('startup discovery failed:', error));
      await new Promise((resolve) => setTimeout(resolve, PROBE_STARTUP_DELAY_MS));
      const pending = this.installationRepo
        .listAll()
        .filter((i) => i.status === 'unchecked' || i.status === 'missing');
      await this.probeBatch(pending, 'startup');
    })();
  }

  /** 手动刷新：重新发现 + 全量探测（忽略节流） */
  async refreshAll(): Promise<void> {
    await this.syncDiscovery();
    await this.probeBatch(this.installationRepo.listAll(), 'manual');
  }

  /** 探测单个 installation（节流：完整探测 5 分钟内不重复，manual 除外） */
  async probeOne(id: string, kind: ProbeKind): Promise<AgentInstallation | null> {
    const installation = this.installationRepo.byId(id);
    if (!installation) return null;
    if (this.probing.has(id)) return installation;

    if (kind !== 'manual' && installation.lastProbeAt && Date.now() - installation.lastProbeAt < PROBE_THROTTLE_MS) {
      return installation;
    }

    const provider = this.providerById(installation.providerId);
    if (!provider) return null;

    this.probing.add(id);
    try {
      const outcome = await probeInstallation(provider, installation);
      const now = Date.now();

      if (outcome.ok) {
        const manifest = buildCapabilityFromEvidence(provider, outcome.manifest);
        this.installationRepo.update(
          id,
          {
            version: outcome.version,
            status: installation.enabled === false ? 'disabled' : outcome.status,
            capabilityManifest: manifest,
            lastProbeAt: now,
            lastProbeKind: kind,
            lastProbeDurationMs: outcome.durationMs,
            lastErrorCode: null,
            lastErrorMessage: null,
            lastErrorGuidance: null,
          },
          now
        );
      } else {
        this.installationRepo.update(
          id,
          {
            status: installation.enabled === false ? 'disabled' : outcome.status,
            lastProbeAt: now,
            lastProbeKind: kind,
            lastProbeDurationMs: outcome.durationMs,
            lastErrorCode: outcome.errorCode,
            lastErrorMessage: outcome.errorMessage,
            lastErrorGuidance: outcome.guidance,
          },
          now
        );
      }

      const updated = this.installationRepo.byId(id)!;
      this.notifyChanged(updated);
      return updated;
    } finally {
      this.probing.delete(id);
    }
  }

  private async probeBatch(installations: AgentInstallation[], kind: ProbeKind): Promise<void> {
    const queue = [...installations];
    const workers = Array.from({ length: Math.min(PROBE_CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) break;
        await this.probeOne(next.id, kind).catch((error) => log.error(`probe ${next.id} failed:`, error));
      }
    });
    await Promise.all(workers);
  }

  // ─── 互斥变更队列 ──────────────────────────────────────────────

  private async runExclusiveMutation<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.mutationQueue;
    let release: () => void;
    this.mutationQueue = new Promise<void>((resolve) => (release = resolve));
    await previous;
    try {
      return await task();
    } finally {
      release!();
    }
  }
}
