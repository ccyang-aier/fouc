/**
 * SQLite 访问层（bun:sqlite）。
 *
 * 运行时绑定隔离在本文件与 repositories.ts —— 其余代码不直接触碰 SQL，
 * 保留退回 Node（better-sqlite3）的低成本通道。
 */

import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { getDbPath } from '../platform/paths';
import { createLogger } from '../platform/logger';

const log = createLogger('store');

export type Db = Database;

const CONNECTOR_SCHEMA = `
CREATE TABLE IF NOT EXISTS connector_instance (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  name TEXT NOT NULL,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  desired_state TEXT NOT NULL,
  auth_state TEXT NOT NULL,
  health_state TEXT NOT NULL,
  execution_state TEXT NOT NULL,
  execution_target_type TEXT NOT NULL,
  execution_target_id TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  identity TEXT,
  connected_at INTEGER,
  last_heartbeat_at INTEGER,
  last_heartbeat_duration_ms INTEGER,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_connector_instance_provider ON connector_instance(provider_id);

CREATE TABLE IF NOT EXISTS connector_heartbeat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT NOT NULL REFERENCES connector_instance(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  duration_ms INTEGER,
  error_code TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_connector_heartbeat_instance ON connector_heartbeat(instance_id, created_at DESC);

CREATE TABLE IF NOT EXISTS connector_invocation (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES connector_instance(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  status TEXT NOT NULL,
  input_summary TEXT,
  result_summary TEXT,
  error_code TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_connector_invocation_instance ON connector_invocation(instance_id, started_at DESC);
`;

const KNOWLEDGE_SCHEMA = `
CREATE TABLE IF NOT EXISTS knowledge_project (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, icon_id TEXT NOT NULL,
  parent_id TEXT REFERENCES knowledge_project(id) ON DELETE SET NULL,
  starred INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS knowledge_document (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '',
  project_id TEXT REFERENCES knowledge_project(id) ON DELETE SET NULL,
  starred INTEGER NOT NULL DEFAULT 0, trashed_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_document_project ON knowledge_document(project_id);
CREATE TABLE IF NOT EXISTS knowledge_tag (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS knowledge_document_tag (
  document_id TEXT NOT NULL REFERENCES knowledge_document(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES knowledge_tag(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, tag_id)
);
CREATE TABLE IF NOT EXISTS knowledge_document_version (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES knowledge_document(id) ON DELETE CASCADE,
  title TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_version_document ON knowledge_document_version(document_id, created_at DESC);
`;

// ─── 嵌入式迁移（AionCore 模式：NNN_描述.sql 顺序执行） ─────────────

const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: '001_initial_schema',
    sql: `
CREATE TABLE IF NOT EXISTS agent_provider (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cli_command TEXT NOT NULL,
  acp_launch TEXT NOT NULL,
  auth_required INTEGER NOT NULL DEFAULT 0,
  skills_dir TEXT,
  default_enabled INTEGER NOT NULL DEFAULT 1,
  behavior_policy TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS agent_installation (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES agent_provider(id),
  executable_path TEXT NOT NULL,
  source TEXT NOT NULL,
  version TEXT,
  status TEXT NOT NULL DEFAULT 'unchecked',
  capability_manifest TEXT,
  last_probe_at INTEGER,
  last_probe_kind TEXT,
  last_probe_duration_ms INTEGER,
  last_error_code TEXT,
  last_error_message TEXT,
  last_error_guidance TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_installation_provider ON agent_installation(provider_id);

CREATE TABLE IF NOT EXISTS agent_session (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES agent_installation(id),
  provider_id TEXT NOT NULL,
  work_dir TEXT NOT NULL,
  native_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  ended_at INTEGER,
  end_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_session_installation ON agent_session(installation_id);

CREATE TABLE IF NOT EXISTS agent_run (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES agent_session(id),
  seq INTEGER NOT NULL,
  input TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  started_at INTEGER,
  ended_at INTEGER,
  exit_info TEXT,
  stop_reason TEXT,
  usage TEXT
);
CREATE INDEX IF NOT EXISTS idx_run_session ON agent_run(session_id, seq);

CREATE TABLE IF NOT EXISTS agent_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  run_id TEXT,
  installation_id TEXT,
  seq_in_run INTEGER,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_session ON agent_event(session_id, seq_in_run);
CREATE INDEX IF NOT EXISTS idx_event_type ON agent_event(type, created_at);

${CONNECTOR_SCHEMA}
`,
  },
];

export function openDatabase(dbPath?: string): Db {
  const target = dbPath ?? getDbPath();
  if (target !== ':memory:') mkdirSync(path.dirname(target), { recursive: true });
  const db = new Database(target);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const applied = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as Array<{ name: string }>).map((r) => r.name)
  );
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(migration.name, Date.now());
    })();
    log.info(`Applied migration ${migration.name}`);
  }
  // 当前唯一 schema 以幂等 DDL 校准；开发期不保留旧 Connector 数据模型兼容分支。
  db.exec(CONNECTOR_SCHEMA);
  db.exec(KNOWLEDGE_SCHEMA);
  return db;
}
