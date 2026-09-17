import type {
  ConnectorHeartbeat,
  ConnectorHealthState,
  ConnectorInstance,
  ConnectorInvocationRecord,
} from '@shared/index';
import type { Db } from '../store/db';

type InstanceRow = {
  id: string; provider_id: string; name: string; owner_type: string; owner_id: string;
  desired_state: string; auth_state: string; health_state: string; execution_state: string;
  execution_target_type: string; execution_target_id: string; config: string; identity: string | null;
  connected_at: number | null; last_heartbeat_at: number | null; last_heartbeat_duration_ms: number | null;
  last_error_code: string | null; last_error_message: string | null; created_at: number; updated_at: number;
};

export class ConnectorRepository {
  constructor(private readonly db: Db) {}

  ensureDtsInstance(now = Date.now()): ConnectorInstance {
    const existing = this.byId('dts-personal');
    if (existing) return existing;
    const instance: ConnectorInstance = {
      id: 'dts-personal', providerId: 'dts', name: '我的 DTS', ownerType: 'user', ownerId: 'local-user',
      desiredState: 'enabled', authState: 'unconfigured', healthState: 'unknown', executionState: 'online',
      executionTargetType: 'desktop_sidecar', executionTargetId: 'current-device',
      config: { baseUrl: 'https://clouddragon.xfusion.com', allowedFilters: ['myTodos', 'myCreate', 'myProcessed', 'myFollowed', 'ccToMe'], pageSizeMax: 50 },
      identity: null, connectedAt: null, lastHeartbeatAt: null, lastHeartbeatDurationMs: null,
      lastErrorCode: null, lastErrorMessage: null, createdAt: now, updatedAt: now,
    };
    this.upsert(instance);
    return instance;
  }

  byId(id: string): ConnectorInstance | null {
    const row = this.db.prepare('SELECT * FROM connector_instance WHERE id = ?').get(id) as InstanceRow | undefined;
    return row ? rowToInstance(row) : null;
  }

  list(): ConnectorInstance[] {
    return (this.db.prepare('SELECT * FROM connector_instance ORDER BY created_at').all() as InstanceRow[]).map(rowToInstance);
  }

  upsert(value: ConnectorInstance): void {
    this.db.prepare(`INSERT INTO connector_instance (
      id, provider_id, name, owner_type, owner_id, desired_state, auth_state, health_state, execution_state,
      execution_target_type, execution_target_id, config, identity, connected_at, last_heartbeat_at,
      last_heartbeat_duration_ms, last_error_code, last_error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, desired_state=excluded.desired_state, auth_state=excluded.auth_state,
      health_state=excluded.health_state, execution_state=excluded.execution_state,
      execution_target_type=excluded.execution_target_type, execution_target_id=excluded.execution_target_id,
      config=excluded.config, identity=excluded.identity, connected_at=excluded.connected_at,
      last_heartbeat_at=excluded.last_heartbeat_at, last_heartbeat_duration_ms=excluded.last_heartbeat_duration_ms,
      last_error_code=excluded.last_error_code, last_error_message=excluded.last_error_message, updated_at=excluded.updated_at`).run(
      value.id, value.providerId, value.name, value.ownerType, value.ownerId, value.desiredState, value.authState,
      value.healthState, value.executionState, value.executionTargetType, value.executionTargetId,
      JSON.stringify(value.config), value.identity ? JSON.stringify(value.identity) : null, value.connectedAt,
      value.lastHeartbeatAt, value.lastHeartbeatDurationMs, value.lastErrorCode, value.lastErrorMessage,
      value.createdAt, value.updatedAt,
    );
  }

  patch(id: string, patch: Partial<ConnectorInstance>): ConnectorInstance | null {
    const current = this.byId(id);
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id, providerId: current.providerId, updatedAt: Date.now() };
    this.upsert(next);
    return next;
  }

  addHeartbeat(instanceId: string, state: ConnectorHealthState, durationMs: number | null, errorCode: string | null, now = Date.now()): void {
    this.db.prepare('INSERT INTO connector_heartbeat (instance_id, state, duration_ms, error_code, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(instanceId, state, durationMs, errorCode, now);
    this.db.prepare(`DELETE FROM connector_heartbeat WHERE instance_id = ? AND id NOT IN
      (SELECT id FROM connector_heartbeat WHERE instance_id = ? ORDER BY created_at DESC LIMIT 50)`).run(instanceId, instanceId);
  }

  heartbeats(instanceId: string, limit = 20): ConnectorHeartbeat[] {
    return (this.db.prepare('SELECT * FROM connector_heartbeat WHERE instance_id = ? ORDER BY created_at DESC LIMIT ?').all(instanceId, limit) as Array<Record<string, unknown>>)
      .map((row) => ({ id: Number(row.id), instanceId: String(row.instance_id), state: row.state as ConnectorHealthState,
        durationMs: row.duration_ms == null ? null : Number(row.duration_ms), errorCode: row.error_code == null ? null : String(row.error_code), createdAt: Number(row.created_at) }));
  }

  startInvocation(record: ConnectorInvocationRecord): void {
    this.db.prepare(`INSERT INTO connector_invocation (id, instance_id, provider_id, capability_id, status, input_summary, result_summary, error_code, started_at, ended_at, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(record.id, record.instanceId, record.providerId, record.capabilityId,
      record.status, record.inputSummary, record.resultSummary, record.errorCode, record.startedAt, record.endedAt, record.durationMs);
  }

  finishInvocation(id: string, status: ConnectorInvocationRecord['status'], resultSummary: string | null, errorCode: string | null, endedAt = Date.now()): void {
    this.db.prepare('UPDATE connector_invocation SET status = ?, result_summary = ?, error_code = ?, ended_at = ?, duration_ms = ? WHERE id = ?')
      .run(status, resultSummary, errorCode, endedAt, endedAt - Number((this.db.prepare('SELECT started_at FROM connector_invocation WHERE id = ?').get(id) as { started_at?: number })?.started_at ?? endedAt), id);
  }

  invocations(instanceId: string, limit = 20): ConnectorInvocationRecord[] {
    return (this.db.prepare('SELECT * FROM connector_invocation WHERE instance_id = ? ORDER BY started_at DESC LIMIT ?').all(instanceId, limit) as Array<Record<string, unknown>>)
      .map((row) => ({ id: String(row.id), instanceId: String(row.instance_id), providerId: String(row.provider_id), capabilityId: String(row.capability_id),
        status: row.status as ConnectorInvocationRecord['status'], inputSummary: row.input_summary == null ? null : String(row.input_summary),
        resultSummary: row.result_summary == null ? null : String(row.result_summary), errorCode: row.error_code == null ? null : String(row.error_code),
        startedAt: Number(row.started_at), endedAt: row.ended_at == null ? null : Number(row.ended_at), durationMs: row.duration_ms == null ? null : Number(row.duration_ms) }));
  }
}

function rowToInstance(row: InstanceRow): ConnectorInstance {
  return {
    id: row.id, providerId: row.provider_id, name: row.name, ownerType: row.owner_type as ConnectorInstance['ownerType'], ownerId: row.owner_id,
    desiredState: row.desired_state as ConnectorInstance['desiredState'], authState: row.auth_state as ConnectorInstance['authState'],
    healthState: row.health_state as ConnectorInstance['healthState'], executionState: row.execution_state as ConnectorInstance['executionState'],
    executionTargetType: row.execution_target_type as ConnectorInstance['executionTargetType'], executionTargetId: row.execution_target_id,
    config: JSON.parse(row.config) as Record<string, unknown>, identity: row.identity ? JSON.parse(row.identity) : null,
    connectedAt: row.connected_at, lastHeartbeatAt: row.last_heartbeat_at, lastHeartbeatDurationMs: row.last_heartbeat_duration_ms,
    lastErrorCode: row.last_error_code, lastErrorMessage: row.last_error_message, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
