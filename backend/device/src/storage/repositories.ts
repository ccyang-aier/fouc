/**
 * 领域仓储：agent_provider / agent_installation / agent_session / agent_run / agent_event。
 * 行 ↔ DTO 的 JSON 序列化集中在此，上层只见类型对象。
 */

import type {
  AgentEvent,
  AgentInstallation,
  AgentRun,
  AgentSession,
  AcpLaunch,
  InstallationSource,
  InstallationStatus,
  ProviderSpec,
  ProbeKind,
  RunStatus,
  SessionStatus,
  CapabilityManifest,
} from '@fouc/shared';
import type { Db } from './db';

// ─── Provider ──────────────────────────────────────────────────────

interface ProviderRow {
  id: string;
  name: string;
  cli_command: string;
  acp_launch: string;
  auth_required: number;
  skills_dir: string | null;
  default_enabled: number;
  behavior_policy: string;
}

export class ProviderRepository {
  constructor(private readonly db: Db) {}

  upsertAll(specs: ProviderSpec[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO agent_provider (id, name, cli_command, acp_launch, auth_required, skills_dir, default_enabled, behavior_policy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        cli_command = excluded.cli_command,
        acp_launch = excluded.acp_launch,
        auth_required = excluded.auth_required,
        skills_dir = excluded.skills_dir,
        default_enabled = excluded.default_enabled,
        behavior_policy = excluded.behavior_policy
    `);
    const tx = this.db.transaction((rows: ProviderSpec[]) => {
      for (const spec of rows) {
        stmt.run(
          spec.id,
          spec.name,
          spec.cliCommand,
          JSON.stringify(spec.acpLaunch),
          spec.authRequired ? 1 : 0,
          spec.skillsDir,
          spec.defaultEnabled ? 1 : 0,
          JSON.stringify(spec.behaviorPolicy)
        );
      }
    });
    tx(specs);
  }

  listAll(): ProviderSpec[] {
    const rows = this.db.prepare('SELECT * FROM agent_provider ORDER BY id').all() as ProviderRow[];
    return rows.map(rowToProvider);
  }

  byId(id: string): ProviderSpec | null {
    const row = this.db.prepare('SELECT * FROM agent_provider WHERE id = ?').get(id) as ProviderRow | undefined;
    return row ? rowToProvider(row) : null;
  }
}

function rowToProvider(row: ProviderRow): ProviderSpec {
  return {
    id: row.id,
    name: row.name,
    cliCommand: row.cli_command,
    acpLaunch: JSON.parse(row.acp_launch) as AcpLaunch,
    authRequired: row.auth_required === 1,
    skillsDir: row.skills_dir,
    defaultEnabled: row.default_enabled === 1,
    behaviorPolicy: JSON.parse(row.behavior_policy),
  };
}

// ─── Installation ──────────────────────────────────────────────────

interface InstallationRow {
  id: string;
  provider_id: string;
  executable_path: string;
  source: string;
  version: string | null;
  status: string;
  capability_manifest: string | null;
  last_probe_at: number | null;
  last_probe_kind: string | null;
  last_probe_duration_ms: number | null;
  last_error_code: string | null;
  last_error_message: string | null;
  last_error_guidance: string | null;
  enabled: number;
  is_default: number;
  created_at: number;
  updated_at: number;
}

export interface InstallationUpdate {
  version?: string | null;
  status?: InstallationStatus;
  capabilityManifest?: CapabilityManifest | null;
  lastProbeAt?: number;
  lastProbeKind?: ProbeKind | null;
  lastProbeDurationMs?: number | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  lastErrorGuidance?: string | null;
  enabled?: boolean;
  isDefault?: boolean;
}

export class InstallationRepository {
  constructor(private readonly db: Db) {}

  upsert(installation: AgentInstallation): void {
    this.db
      .prepare(
        `INSERT INTO agent_installation
          (id, provider_id, executable_path, source, version, status, capability_manifest,
           last_probe_at, last_probe_kind, last_probe_duration_ms,
           last_error_code, last_error_message, last_error_guidance,
           enabled, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          version = excluded.version,
          status = excluded.status,
          capability_manifest = excluded.capability_manifest,
          last_probe_at = excluded.last_probe_at,
          last_probe_kind = excluded.last_probe_kind,
          last_probe_duration_ms = excluded.last_probe_duration_ms,
          last_error_code = excluded.last_error_code,
          last_error_message = excluded.last_error_message,
          last_error_guidance = excluded.last_error_guidance,
          enabled = excluded.enabled,
          is_default = excluded.is_default,
          updated_at = excluded.updated_at`
      )
      .run(
        installation.id,
        installation.providerId,
        installation.executablePath,
        installation.source,
        installation.version,
        installation.status,
        installation.capabilityManifest ? JSON.stringify(installation.capabilityManifest) : null,
        installation.lastProbeAt,
        installation.lastProbeKind,
        installation.lastProbeDurationMs,
        installation.lastErrorCode,
        installation.lastErrorMessage,
        installation.lastErrorGuidance,
        installation.enabled ? 1 : 0,
        installation.isDefault ? 1 : 0,
        installation.createdAt,
        installation.updatedAt
      );
  }

  update(id: string, patch: InstallationUpdate, now = Date.now()): void {
    const current = this.byId(id);
    if (!current) return;
    this.upsert({
      ...current,
      ...('version' in patch ? { version: patch.version } : {}),
      ...('status' in patch ? { status: patch.status! } : {}),
      ...('capabilityManifest' in patch ? { capabilityManifest: patch.capabilityManifest ?? null } : {}),
      ...('lastProbeAt' in patch ? { lastProbeAt: patch.lastProbeAt } : {}),
      ...('lastProbeKind' in patch ? { lastProbeKind: patch.lastProbeKind } : {}),
      ...('lastProbeDurationMs' in patch ? { lastProbeDurationMs: patch.lastProbeDurationMs } : {}),
      ...('lastErrorCode' in patch ? { lastErrorCode: patch.lastErrorCode } : {}),
      ...('lastErrorMessage' in patch ? { lastErrorMessage: patch.lastErrorMessage } : {}),
      ...('lastErrorGuidance' in patch ? { lastErrorGuidance: patch.lastErrorGuidance } : {}),
      ...('enabled' in patch ? { enabled: patch.enabled! } : {}),
      ...('isDefault' in patch ? { isDefault: patch.isDefault! } : {}),
      updatedAt: now,
    });
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM agent_installation WHERE id = ?').run(id);
  }

  byId(id: string): AgentInstallation | null {
    const row = this.db
      .prepare('SELECT * FROM agent_installation WHERE id = ?')
      .get(id) as InstallationRow | undefined;
    return row ? rowToInstallation(row) : null;
  }

  listAll(): AgentInstallation[] {
    const rows = this.db
      .prepare('SELECT * FROM agent_installation ORDER BY provider_id, executable_path')
      .all() as InstallationRow[];
    return rows.map(rowToInstallation);
  }

  clearDefault(): void {
    this.db.prepare('UPDATE agent_installation SET is_default = 0 WHERE is_default = 1').run();
  }
}

function rowToInstallation(row: InstallationRow): AgentInstallation {
  return {
    id: row.id,
    providerId: row.provider_id,
    executablePath: row.executable_path,
    source: row.source as InstallationSource,
    version: row.version,
    status: row.status as InstallationStatus,
    capabilityManifest: row.capability_manifest ? (JSON.parse(row.capability_manifest) as CapabilityManifest) : null,
    lastProbeAt: row.last_probe_at,
    lastProbeKind: (row.last_probe_kind as ProbeKind | null) ?? null,
    lastProbeDurationMs: row.last_probe_duration_ms,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    lastErrorGuidance: row.last_error_guidance,
    enabled: row.enabled === 1,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Session / Run / Event ─────────────────────────────────────────

interface SessionRow {
  id: string;
  installation_id: string;
  provider_id: string;
  work_dir: string;
  native_session_id: string | null;
  status: string;
  created_at: number;
  last_active_at: number;
  ended_at: number | null;
  end_reason: string | null;
}

export class SessionRepository {
  constructor(private readonly db: Db) {}

  insert(session: AgentSession): void {
    this.db
      .prepare(
        `INSERT INTO agent_session (id, installation_id, provider_id, work_dir, native_session_id, status, created_at, last_active_at, ended_at, end_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.id,
        session.installationId,
        session.providerId,
        session.workDir,
        session.nativeSessionId,
        session.status,
        session.createdAt,
        session.lastActiveAt,
        session.endedAt,
        session.endReason
      );
  }

  update(id: string, patch: Partial<AgentSession>): void {
    const current = this.byId(id);
    if (!current) return;
    const merged = { ...current, ...patch };
    this.db
      .prepare(
        `UPDATE agent_session SET native_session_id = ?, status = ?, last_active_at = ?, ended_at = ?, end_reason = ? WHERE id = ?`
      )
      .run(merged.nativeSessionId, merged.status, merged.lastActiveAt, merged.endedAt, merged.endReason, id);
  }

  byId(id: string): AgentSession | null {
    const row = this.db.prepare('SELECT * FROM agent_session WHERE id = ?').get(id) as SessionRow | undefined;
    return row ? rowToSession(row) : null;
  }

  listAll(): AgentSession[] {
    const rows = this.db.prepare('SELECT * FROM agent_session ORDER BY created_at DESC').all() as SessionRow[];
    return rows.map(rowToSession);
  }
}

function rowToSession(row: SessionRow): AgentSession {
  return {
    id: row.id,
    installationId: row.installation_id,
    providerId: row.provider_id,
    workDir: row.work_dir,
    nativeSessionId: row.native_session_id,
    status: row.status as SessionStatus,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    endedAt: row.ended_at,
    endReason: row.end_reason,
  };
}

interface RunRow {
  id: string;
  session_id: string;
  seq: number;
  input: string;
  status: string;
  started_at: number | null;
  ended_at: number | null;
  exit_info: string | null;
  stop_reason: string | null;
  usage: string | null;
}

export class RunRepository {
  constructor(private readonly db: Db) {}

  insert(run: AgentRun): void {
    this.db
      .prepare(
        `INSERT INTO agent_run (id, session_id, seq, input, status, started_at, ended_at, exit_info, stop_reason, usage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        run.id,
        run.sessionId,
        run.seq,
        run.input,
        run.status,
        run.startedAt,
        run.endedAt,
        run.exitInfo ? JSON.stringify(run.exitInfo) : null,
        run.stopReason,
        run.usage ? JSON.stringify(run.usage) : null
      );
  }

  update(id: string, patch: Partial<AgentRun>): void {
    const current = this.byId(id);
    if (!current) return;
    const merged = { ...current, ...patch };
    this.db
      .prepare(`UPDATE agent_run SET status = ?, started_at = ?, ended_at = ?, exit_info = ?, stop_reason = ?, usage = ? WHERE id = ?`)
      .run(
        merged.status,
        merged.startedAt,
        merged.endedAt,
        merged.exitInfo ? JSON.stringify(merged.exitInfo) : null,
        merged.stopReason,
        merged.usage ? JSON.stringify(merged.usage) : null,
        id
      );
  }

  byId(id: string): AgentRun | null {
    const row = this.db.prepare('SELECT * FROM agent_run WHERE id = ?').get(id) as RunRow | undefined;
    return row ? rowToRun(row) : null;
  }

  listBySession(sessionId: string): AgentRun[] {
    const rows = this.db
      .prepare('SELECT * FROM agent_run WHERE session_id = ? ORDER BY seq')
      .all(sessionId) as RunRow[];
    return rows.map(rowToRun);
  }

  nextSeq(sessionId: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(seq), 0) AS max_seq FROM agent_run WHERE session_id = ?')
      .get(sessionId) as { max_seq: number };
    return row.max_seq + 1;
  }

  findUnresolved(): AgentRun[] {
    const rows = this.db
      .prepare(`SELECT * FROM agent_run WHERE status IN ('queued', 'running', 'waiting_approval')`)
      .all() as RunRow[];
    return rows.map(rowToRun);
  }
}

function rowToRun(row: RunRow): AgentRun {
  return {
    id: row.id,
    sessionId: row.session_id,
    seq: row.seq,
    input: row.input,
    status: row.status as RunStatus,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    exitInfo: row.exit_info ? JSON.parse(row.exit_info) : null,
    stopReason: row.stop_reason,
    usage: row.usage ? JSON.parse(row.usage) : null,
  };
}

export class EventRepository {
  constructor(private readonly db: Db) {}

  append(
    event: AgentEvent & { seqInRun?: number },
    context: { sessionId?: string | null; runId?: string | null; installationId?: string | null }
  ): void {
    this.db
      .prepare(
        `INSERT INTO agent_event (session_id, run_id, installation_id, seq_in_run, type, payload, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        context.sessionId ?? ('sessionId' in event ? event.sessionId : null),
        context.runId ?? ('runId' in event ? (event.runId as string | null) : null),
        context.installationId ?? null,
        event.seqInRun ?? null,
        event.type,
        JSON.stringify(event),
        Date.now()
      );
  }

  listBySession(sessionId: string, afterId = 0, limit = 500): Array<{ id: number; event: AgentEvent }> {
    const rows = this.db
      .prepare(`SELECT * FROM agent_event WHERE session_id = ? AND id > ? ORDER BY id LIMIT ?`)
      .all(sessionId, afterId, limit) as Array<{ id: number; type: string; payload: string }>;
    return rows.map((row) => ({ id: row.id, event: JSON.parse(row.payload) as AgentEvent }));
  }
}
