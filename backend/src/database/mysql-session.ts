import mysql from 'mysql2/promise';
import {
  DATABASE_CAPABILITIES,
  type DatabaseCapabilities,
  type DatabaseCapabilitySnapshot,
  type DatabaseObjectInfo,
  type MysqlConnectInput,
} from '@fouc/shared';
import { DatabaseCapabilityRegistry } from './capability-registry';

type Row = Record<string, unknown>;
type MysqlWire = {
  query(sql: string, values?: unknown[]): Promise<Row[]>;
  end(): Promise<void>;
};
type WireFactory = (input: MysqlConnectInput) => MysqlWire;

// DBX's MySQL driver declaration; observation below remains narrower until
// the corresponding runtime operation is wired and verified in Fouc.
const DECLARED = Object.fromEntries(DATABASE_CAPABILITIES.map((key) => [key, key !== 'driverManagement'])) as DatabaseCapabilities;
const OBSERVED = Object.fromEntries(DATABASE_CAPABILITIES.map((key) => [key, key === 'metadataBrowse'])) as DatabaseCapabilities;
const DATABASES_SQL = ['SHOW DATABASES', 'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME'];
const TABLES_SQL = 'SELECT TABLE_NAME, TABLE_TYPE, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME';

type Session = { wire: MysqlWire; readOnly: boolean; production: boolean };

function createMysqlWire(input: MysqlConnectInput): MysqlWire {
  const pool = mysql.createPool({
    host: input.host,
    port: input.port,
    user: input.username,
    password: input.password,
    database: input.database || undefined,
    connectTimeout: (input.connectTimeoutSecs ?? 10) * 1_000,
    waitForConnections: true,
    connectionLimit: 5,
    multipleStatements: false,
    ssl: input.ssl ? {} : undefined,
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: true,
  });
  return {
    async query(sql, values) {
      const [rows] = await pool.query(sql, values);
      return rows as Row[];
    },
    end: () => pool.end(),
  };
}

function assertConnectInput(value: unknown): asserts value is MysqlConnectInput {
  if (!value || typeof value !== 'object') throw new Error('连接参数无效');
  const input = value as Record<string, unknown>;
  if (typeof input.host !== 'string' || !input.host.trim() || typeof input.username !== 'string'
    || typeof input.password !== 'string' || !Number.isInteger(input.port)
    || (input.port as number) < 1 || (input.port as number) > 65535) {
    throw new Error('主机、端口、用户或密码无效');
  }
  if (input.connectTimeoutSecs !== undefined && (!Number.isInteger(input.connectTimeoutSecs)
    || (input.connectTimeoutSecs as number) < 1 || (input.connectTimeoutSecs as number) > 120)) {
    throw new Error('连接超时必须为 1–120 秒');
  }
  if (input.database !== undefined && input.database !== null && typeof input.database !== 'string') throw new Error('数据库名称无效');
  for (const key of ['ssl', 'readOnly', 'production']) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') throw new Error(`${key} 参数无效`);
  }
}

/** DBX MySQL database and table discovery, ported to the Bun sidecar. */
export class MysqlSessionManager {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly capabilities: DatabaseCapabilityRegistry,
    private readonly wireFactory: WireFactory = createMysqlWire,
  ) {}

  async connect(value: unknown): Promise<DatabaseCapabilitySnapshot> {
    assertConnectInput(value);
    const input = value;
    const id = crypto.randomUUID();
    const wire = this.wireFactory(input);
    this.capabilities.begin(id, id);
    try {
      await wire.query('SELECT 1 AS fouc_probe');
      // DBX probes server metadata after checkout. A successful TCP handshake alone
      // never grants metadata access; this query checks the current account.
      await this.queryDatabases(wire);
      const snapshot = this.capabilities.confirm(id, id, DECLARED, OBSERVED, {
        readOnly: input.readOnly ?? false,
        production: input.production ?? false,
      });
      if (!snapshot) throw new Error('连接探测已失效');
      this.sessions.set(id, { wire, readOnly: input.readOnly ?? false, production: input.production ?? false });
      return snapshot;
    } catch (error) {
      this.capabilities.disconnect(id, id);
      await wire.end().catch(() => undefined);
      throw error;
    }
  }

  async refresh(id: string): Promise<DatabaseCapabilitySnapshot | null> {
    const session = this.sessions.get(id);
    if (!session) return null;
    try {
      await session.wire.query('SELECT 1 AS fouc_probe');
      await this.queryDatabases(session.wire);
      return this.capabilities.confirm(id, id, DECLARED, OBSERVED, {
        readOnly: session.readOnly,
        production: session.production,
      });
    } catch {
      await this.disconnect(id);
      return null;
    }
  }

  async databases(id: string): Promise<DatabaseObjectInfo[] | null> {
    const session = this.sessions.get(id);
    if (!session || !await this.refresh(id)) return null;
    const names = await this.queryDatabases(session.wire);
    return names.map((name) => ({ connectionId: id, database: name, schema: null, kind: 'database', name, comment: null }));
  }

  async tables(id: string, database: string): Promise<DatabaseObjectInfo[] | null> {
    const session = this.sessions.get(id);
    if (!session || !await this.refresh(id)) return null;
    if (!database.trim()) throw new Error('数据库名称不能为空');
    let rows: Row[];
    try {
      rows = await session.wire.query(TABLES_SQL, [database]);
    } catch {
      // DBX falls back to SHOW TABLES on information_schema-restricted servers.
      const quoted = '`' + database.replaceAll('`', '``') + '`';
      rows = await session.wire.query(`SHOW FULL TABLES FROM ${quoted}`);
    }
    return rows.map((row) => {
      const name = String(row.TABLE_NAME ?? Object.values(row)[0] ?? '').trim();
      const type = String(row.TABLE_TYPE ?? Object.values(row)[1] ?? 'BASE TABLE');
      return { connectionId: id, database, schema: null, kind: type.toUpperCase().includes('VIEW') ? 'view' as const : 'table' as const,
        name, comment: row.TABLE_COMMENT == null ? null : String(row.TABLE_COMMENT) };
    }).filter((item) => item.name !== '');
  }

  async disconnect(id: string): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session) return false;
    this.sessions.delete(id);
    this.capabilities.disconnect(id, id);
    await session.wire.end();
    return true;
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((id) => this.disconnect(id)));
  }

  private async queryDatabases(wire: MysqlWire): Promise<string[]> {
    let rows: Row[];
    try {
      rows = await wire.query(DATABASES_SQL[0]!);
    } catch {
      rows = await wire.query(DATABASES_SQL[1]!);
    }
    return rows.map((row) => String(Object.values(row)[0] ?? '').trim()).filter(Boolean).sort();
  }
}
