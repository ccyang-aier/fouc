import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { SQL_HISTORY_LIMIT, type SavedSqlDocument, type SavedSqlFile, type SavedSqlFolder, type SavedSqlLibrary, type SqlHistoryEntry, type SqlHistoryPage, type SqlHistorySearch } from '@fouc/shared';
import { DatabaseInputError } from './input-error';
import { historySearch, sqlDocument, sqlName, sqlNullable, sqlObject, sqlText } from './sql-library-input';
import { sqlDraftSnapshot } from './sql-draft-input';
import type { SqlDraftState } from '@fouc/shared';
import { defaultSqlEditorPreferences, validateSqlEditorPreferencesUpdate, type SqlEditorPreferences } from '@fouc/shared';

type Row = Record<string, unknown>;
const folderColumns = 'id, connectionId, parentFolderId, name, orderIndex, createdAt, updatedAt';
const fileColumns = 'id, connectionId, folderId, name, database, schema, orderIndex, openCount, openedAt, createdAt, updatedAt, version, sqlBytes';
const historyColumns = 'id, connectionId, connectionName, provider, database, schema, sql, executedAt, executionTimeMs, success, error, rowCount, truncated';
function historyRow(row: Row): SqlHistoryEntry { return { ...row, success: row.success === 1, truncated: row.truncated === 1 } as SqlHistoryEntry; }

/** DBX's SQLite history/library storage, isolated in an owning workspace file. */
export class RelationalSqlRepository {
  private readonly databases = new Map<string, DatabaseSync>();
  constructor(private readonly directory: string | null = null) {}
  private db(workspaceId: string): DatabaseSync {
    sqlText(workspaceId, '工作空间', 128);
    const existing = this.databases.get(workspaceId); if (existing) return existing;
    let file = ':memory:';
    if (this.directory) { mkdirSync(this.directory, { recursive: true }); file = path.join(this.directory, createHash('sha256').update(workspaceId).digest('hex') + '.sqlite'); }
    const db = new DatabaseSync(file);
    try {
      if (this.directory) chmodSync(file, 0o600);
      db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
        CREATE TABLE IF NOT EXISTS query_history (
          id TEXT PRIMARY KEY, connectionId TEXT NOT NULL, connectionName TEXT NOT NULL, provider TEXT NOT NULL,
          database TEXT NOT NULL, schema TEXT, sql TEXT NOT NULL, executedAt INTEGER NOT NULL,
          executionTimeMs INTEGER NOT NULL, success INTEGER NOT NULL, error TEXT, rowCount INTEGER NOT NULL, truncated INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS query_history_time ON query_history(executedAt DESC, id DESC);
        CREATE INDEX IF NOT EXISTS query_history_target ON query_history(connectionId, database, executedAt DESC, id DESC);
        CREATE TABLE IF NOT EXISTS sql_folders (
          id TEXT PRIMARY KEY, connectionId TEXT NOT NULL, parentFolderId TEXT REFERENCES sql_folders(id) ON DELETE CASCADE,
          name TEXT NOT NULL, nameKey TEXT NOT NULL, orderIndex INTEGER NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS sql_folder_name ON sql_folders(connectionId, COALESCE(parentFolderId,''), nameKey);
        CREATE TABLE IF NOT EXISTS sql_files (
          id TEXT PRIMARY KEY, connectionId TEXT NOT NULL, folderId TEXT REFERENCES sql_folders(id) ON DELETE CASCADE,
          name TEXT NOT NULL, nameKey TEXT NOT NULL, database TEXT NOT NULL, schema TEXT, sql TEXT NOT NULL, sqlBytes INTEGER NOT NULL,
          orderIndex INTEGER NOT NULL, openCount INTEGER NOT NULL, openedAt INTEGER, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, version TEXT NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS sql_file_name ON sql_files(connectionId, database, COALESCE(folderId,''), nameKey);
        CREATE TABLE IF NOT EXISTS sql_drafts (
          connectionId TEXT PRIMARY KEY, version TEXT NOT NULL, updatedAt INTEGER NOT NULL, snapshot TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS editor_preferences (
          connectionId TEXT PRIMARY KEY, version TEXT NOT NULL, updatedAt INTEGER NOT NULL, snapshot TEXT NOT NULL);`);
      this.databases.set(workspaceId, db); return db;
    } catch (error) { db.close(); throw error; }
  }
  private transaction<T>(db: DatabaseSync, operation: () => T): T {
    db.exec('BEGIN IMMEDIATE');
    try { const result = operation(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  append(workspaceId: string, entry: SqlHistoryEntry): void {
    const db = this.db(workspaceId);
    this.transaction(db, () => {
      db.prepare(`INSERT INTO query_history (${historyColumns}) VALUES (${Array(13).fill('?').join(',')})`).run(
        entry.id, entry.connectionId, entry.connectionName, entry.provider, entry.database, entry.schema, entry.sql,
        entry.executedAt, entry.executionTimeMs, Number(entry.success), entry.error, entry.rowCount, Number(entry.truncated));
      db.prepare('DELETE FROM query_history WHERE id NOT IN (SELECT id FROM query_history ORDER BY executedAt DESC,id DESC LIMIT ?)').run(SQL_HISTORY_LIMIT);
    });
  }
  search(workspaceId: string, value: unknown, fixedConnectionId: string | null = null): SqlHistoryPage {
    const request = historySearch(value), db = this.db(workspaceId), clauses: string[] = [], bindings: SQLInputValue[] = [];
    if (fixedConnectionId) { clauses.push('connectionId=?'); bindings.push(fixedConnectionId); }
    const scopes: string[] = [];
    for (const id of request.connectionIds) if (!request.databases.some((item) => item.connectionId === id)) { scopes.push('connectionId=?'); bindings.push(id); }
    for (const target of request.databases) { scopes.push('(connectionId=? AND database=?)'); bindings.push(target.connectionId, target.database); }
    if (scopes.length) clauses.push(`(${scopes.join(' OR ')})`);
    if (request.schema !== null) { clauses.push('schema=?'); bindings.push(request.schema); }
    if (request.success !== null) { clauses.push('success=?'); bindings.push(Number(request.success)); }
    if (request.startedAt !== null) { clauses.push('executedAt>=?'); bindings.push(request.startedAt); }
    if (request.endedAt !== null) { clauses.push('executedAt<=?'); bindings.push(request.endedAt); }
    if (request.search) { const fields = ['sql', 'connectionName', 'database', 'schema', 'error']; clauses.push(`(${fields.map((field) => `instr(lower(COALESCE(${field},'')),lower(?))>0`).join(' OR ')})`); bindings.push(...fields.map(() => request.search)); }
    const predicate = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const total = Number(db.prepare(`SELECT COUNT(*) AS total FROM query_history${predicate}`).get(...bindings)!.total);
    let pagePredicate = predicate;
    if (request.cursor) { pagePredicate += (predicate ? ' AND ' : ' WHERE ') + '(executedAt<? OR (executedAt=? AND id<?))'; bindings.push(request.cursor.executedAt, request.cursor.executedAt, request.cursor.id); }
    const rows = db.prepare(`SELECT ${historyColumns.replace(', sql,', ', substr(sql,1,600) AS sql,')}, length(CAST(sql AS BLOB)) AS sqlBytes FROM query_history${pagePredicate} ORDER BY executedAt DESC,id DESC LIMIT ?`).all(...bindings, request.limit + 1);
    const hasMore = rows.length > request.limit;
    const entries = rows.slice(0, request.limit).map((row) => { const { sql, ...entry } = historyRow(row); return { ...entry, sqlPreview: sql.replace(/\s+/g, ' ').trim(), sqlBytes: Number(row.sqlBytes) }; });
    const last = entries.at(-1);
    return { entries, total, nextCursor: hasMore && last ? { executedAt: last.executedAt, id: last.id } : null, persistent: this.directory !== null, limit: SQL_HISTORY_LIMIT };
  }
  history(workspaceId: string, id: string, fixedConnectionId: string | null = null): SqlHistoryEntry {
    const row = this.db(workspaceId).prepare(`SELECT ${historyColumns} FROM query_history WHERE id=?${fixedConnectionId ? ' AND connectionId=?' : ''}`).get(...(fixedConnectionId ? [id, fixedConnectionId] : [id]));
    if (!row) throw new DatabaseInputError('当前范围中的历史记录不存在'); return historyRow(row);
  }
  deleteHistory(workspaceId: string, id: string, connectionId: string | null = null): void {
    this.history(workspaceId, id, connectionId);
    this.db(workspaceId).prepare(`DELETE FROM query_history WHERE id=?${connectionId ? ' AND connectionId=?' : ''}`).run(...(connectionId ? [id, connectionId] : [id]));
  }
  clearHistory(workspaceId: string, connectionId: string | null = null): void {
    this.db(workspaceId).prepare(`DELETE FROM query_history${connectionId ? ' WHERE connectionId=?' : ''}`).run(...(connectionId ? [connectionId] : []));
  }
  library(workspaceId: string, connectionId: string): SavedSqlLibrary {
    const db = this.db(workspaceId);
    return { folders: db.prepare(`SELECT ${folderColumns} FROM sql_folders WHERE connectionId=? ORDER BY orderIndex,nameKey,id`).all(connectionId) as unknown as SavedSqlFolder[],
      files: db.prepare(`SELECT ${fileColumns} FROM sql_files WHERE connectionId=? ORDER BY orderIndex,nameKey,id`).all(connectionId) as unknown as SavedSqlFile[] };
  }
  folder(workspaceId: string, connectionId: string, id: string): SavedSqlFolder {
    const row = this.db(workspaceId).prepare(`SELECT ${folderColumns} FROM sql_folders WHERE connectionId=? AND id=?`).get(connectionId, id);
    if (!row) throw new DatabaseInputError('当前连接中的 SQL 文件夹不存在'); return row as unknown as SavedSqlFolder;
  }
  saveFolder(workspaceId: string, connectionId: string, value: unknown, id?: string): SavedSqlFolder {
    const input = sqlObject(value), name = sqlName(input.name), parent = sqlNullable(input.parentFolderId, '父文件夹');
    const db = this.db(workspaceId);
    return this.transaction(db, () => {
      const prior = id ? this.folder(workspaceId, connectionId, id) : null;
      if (parent !== null) {
        this.folder(workspaceId, connectionId, parent);
        if (id && db.prepare('WITH RECURSIVE children(id) AS (SELECT id FROM sql_folders WHERE id=? UNION ALL SELECT f.id FROM sql_folders f JOIN children c ON f.parentFolderId=c.id) SELECT 1 FROM children WHERE id=?').get(id, parent)) throw new DatabaseInputError('文件夹不能移动到自身或其子文件夹');
      }
      if (db.prepare("SELECT id FROM sql_folders WHERE connectionId=? AND parentFolderId IS ? AND nameKey=? AND id<>?").get(connectionId, parent, name.toLocaleLowerCase(), id ?? '')) throw new DatabaseInputError('当前位置已有同名 SQL 文件夹');
      const now = Date.now(), folder: SavedSqlFolder = { id: id ?? crypto.randomUUID(), connectionId, parentFolderId: parent, name,
        orderIndex: prior && prior.parentFolderId === parent ? prior.orderIndex : Number(db.prepare('SELECT COALESCE(MAX(orderIndex),-1)+1 AS position FROM sql_folders WHERE connectionId=? AND parentFolderId IS ?').get(connectionId, parent)!.position), createdAt: prior?.createdAt ?? now, updatedAt: now };
      db.prepare('INSERT INTO sql_folders (id,connectionId,parentFolderId,name,nameKey,orderIndex,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET parentFolderId=excluded.parentFolderId,name=excluded.name,nameKey=excluded.nameKey,orderIndex=excluded.orderIndex,updatedAt=excluded.updatedAt').run(folder.id, connectionId, parent, name, name.toLocaleLowerCase(), folder.orderIndex, folder.createdAt, now);
      return folder;
    });
  }
  deleteFolder(workspaceId: string, connectionId: string, id: string): void {
    this.folder(workspaceId, connectionId, id);
    this.db(workspaceId).prepare('DELETE FROM sql_folders WHERE connectionId=? AND id=?').run(connectionId, id);
  }
  file(workspaceId: string, connectionId: string, id: string, opened = false): SavedSqlDocument {
    const db = this.db(workspaceId), row = db.prepare(`SELECT ${fileColumns}, sql FROM sql_files WHERE connectionId=? AND id=?`).get(connectionId, id);
    if (!row) throw new DatabaseInputError('当前连接中的 SQL 文件不存在');
    if (opened) { const now = Date.now(); db.prepare('UPDATE sql_files SET openCount=openCount+1,openedAt=? WHERE connectionId=? AND id=?').run(now, connectionId, id); row.openCount = Number(row.openCount) + 1; row.openedAt = now; }
    return row as unknown as SavedSqlDocument;
  }
  saveFile(workspaceId: string, connectionId: string, value: unknown, id?: string): SavedSqlDocument {
    const input = sqlObject(value), db = this.db(workspaceId);
    return this.transaction(db, () => {
      const prior = id ? this.file(workspaceId, connectionId, id) : null;
      if (prior && input.version !== prior.version) throw new DatabaseInputError('SQL 文件已被其他编辑器修改，请重新打开并核对内容');
      const name = sqlName(input.name ?? prior?.name, true), folderId = input.folderId === undefined ? prior?.folderId ?? null : sqlNullable(input.folderId, 'SQL 文件夹');
      const database = sqlText(input.database ?? prior?.database, '数据库', 1024, true), schema = input.schema === undefined ? prior?.schema ?? null : sqlNullable(input.schema, 'Schema');
      const sql = input.sql === undefined && prior ? prior.sql : sqlDocument(input.sql);
      if (folderId !== null) this.folder(workspaceId, connectionId, folderId);
      if (db.prepare('SELECT id FROM sql_files WHERE connectionId=? AND database=? AND folderId IS ? AND nameKey=? AND id<>?').get(connectionId, database, folderId, name.toLocaleLowerCase(), id ?? '')) throw new DatabaseInputError('当前数据库和文件夹已有同名 SQL 文件');
      const now = Date.now(), file: SavedSqlDocument = { id: id ?? crypto.randomUUID(), connectionId, folderId, name, database, schema, sql,
        sqlBytes: Buffer.byteLength(sql), orderIndex: prior && prior.folderId === folderId && prior.database === database ? prior.orderIndex : Number(db.prepare('SELECT COALESCE(MAX(orderIndex),-1)+1 AS position FROM sql_files WHERE connectionId=? AND database=? AND folderId IS ?').get(connectionId, database, folderId)!.position),
        openCount: prior?.openCount ?? 0, openedAt: prior?.openedAt ?? null, createdAt: prior?.createdAt ?? now, updatedAt: now, version: crypto.randomUUID() };
      db.prepare(`INSERT INTO sql_files (${fileColumns},sql,nameKey) VALUES (${Array(15).fill('?').join(',')}) ON CONFLICT(id) DO UPDATE SET folderId=excluded.folderId,name=excluded.name,nameKey=excluded.nameKey,database=excluded.database,schema=excluded.schema,sql=excluded.sql,sqlBytes=excluded.sqlBytes,orderIndex=excluded.orderIndex,updatedAt=excluded.updatedAt,version=excluded.version`).run(
        file.id, connectionId, folderId, name, database, schema, file.orderIndex, file.openCount, file.openedAt, file.createdAt, now, file.version, file.sqlBytes, sql, name.toLocaleLowerCase());
      return file;
    });
  }
  deleteFile(workspaceId: string, connectionId: string, id: string, version: unknown): void {
    const db = this.db(workspaceId);
    this.transaction(db, () => {
      const file = this.file(workspaceId, connectionId, id); if (file.version !== version) throw new DatabaseInputError('SQL 文件已变化，请刷新后核对再删除');
      db.prepare('DELETE FROM sql_files WHERE connectionId=? AND id=?').run(connectionId, id);
    });
  }
  reorder(workspaceId: string, connectionId: string, value: unknown): void {
    const input = sqlObject(value), ids = input.ids, kind = input.kind;
    if ((kind !== 'files' && kind !== 'folders') || !Array.isArray(ids) || ids.length > 10000 || new Set(ids).size !== ids.length) throw new DatabaseInputError('SQL 排序参数无效');
    const parent = sqlNullable(input.parentFolderId, '排序文件夹'), db = this.db(workspaceId), database = kind === 'files' ? sqlText(input.database, '排序数据库', 1024, true) : null;
    const table = kind === 'files' ? 'sql_files' : 'sql_folders', parentColumn = kind === 'files' ? 'folderId' : 'parentFolderId';
    this.transaction(db, () => {
      const owned = db.prepare(`SELECT id FROM ${table} WHERE connectionId=? AND ${parentColumn} IS ?${database === null ? '' : ' AND database=?'}`).all(...(database === null ? [connectionId, parent] : [connectionId, parent, database]));
      if (owned.length !== ids.length || ids.some((id) => !owned.some((row) => row.id === id))) throw new DatabaseInputError('排序需包含当前范围的全部项目，请刷新后重试');
      const update = db.prepare(`UPDATE ${table} SET orderIndex=? WHERE connectionId=? AND id=?`); ids.forEach((id, index) => update.run(index, connectionId, sqlText(id, '排序 ID', 128)));
    });
  }
  removeConnection(workspaceId: string, connectionId: string): void {
    const db = this.db(workspaceId); this.transaction(db, () => {
      for (const table of ['query_history', 'sql_files', 'sql_folders', 'sql_drafts', 'editor_preferences']) db.prepare(`DELETE FROM ${table} WHERE connectionId=?`).run(connectionId);
    });
  }
  drafts(workspaceId: string, connectionId: string): SqlDraftState {
    const row = this.db(workspaceId).prepare('SELECT version,updatedAt,snapshot FROM sql_drafts WHERE connectionId=?').get(connectionId);
    return row ? { ...sqlDraftSnapshot(JSON.parse(String(row.snapshot))), version: String(row.version), updatedAt: Number(row.updatedAt) }
      : { tabs: [], activeTabId: null, version: null, updatedAt: null };
  }
  saveDrafts(workspaceId: string, connectionId: string, value: unknown): SqlDraftState {
    const input = sqlObject(value), expected = input.version === null ? null : sqlText(input.version, 'SQL 草稿版本', 128);
    const snapshot = sqlDraftSnapshot(input), db = this.db(workspaceId);
    return this.transaction(db, () => {
      const current = db.prepare('SELECT version FROM sql_drafts WHERE connectionId=?').get(connectionId);
      if ((current ? String(current.version) : null) !== expected) throw new DatabaseInputError('其他窗口已修改设备草稿，当前内容已保留；请查看设备版本后再决定如何处理');
      const version = crypto.randomUUID(), updatedAt = Date.now();
      db.prepare('INSERT INTO sql_drafts(connectionId,version,updatedAt,snapshot) VALUES(?,?,?,?) ON CONFLICT(connectionId) DO UPDATE SET version=excluded.version,updatedAt=excluded.updatedAt,snapshot=excluded.snapshot')
        .run(connectionId, version, updatedAt, JSON.stringify(snapshot));
      return { ...snapshot, version, updatedAt };
    });
  }
  editorPreferences(workspaceId: string, connectionId: string): SqlEditorPreferences {
    sqlText(connectionId, '连接 ID', 128);
    const row = this.db(workspaceId).prepare('SELECT version,updatedAt,snapshot FROM editor_preferences WHERE connectionId=?').get(connectionId);
    return row ? { ...JSON.parse(String(row.snapshot)), version: String(row.version), updatedAt: Number(row.updatedAt) } : defaultSqlEditorPreferences();
  }
  saveEditorPreferences(workspaceId: string, connectionId: string, value: unknown): SqlEditorPreferences {
    sqlText(connectionId, '连接 ID', 128);
    let input;
    try { input = validateSqlEditorPreferencesUpdate(value); }
    catch (reason) { throw new DatabaseInputError(reason instanceof Error ? reason.message : String(reason)); }
    const db = this.db(workspaceId);
    return this.transaction(db, () => {
      const current = db.prepare('SELECT version FROM editor_preferences WHERE connectionId=?').get(connectionId);
      if ((current ? String(current.version) : null) !== input.version) {
        throw new DatabaseInputError('其他窗口已修改 SQL 编辑器设置，当前编辑已保留；请重新载入后核对');
      }
      const version = crypto.randomUUID(), updatedAt = Date.now();
      const snapshot = { formatter: input.formatter, formatOnSave: input.formatOnSave, snippets: input.snippets };
      db.prepare('INSERT INTO editor_preferences(connectionId,version,updatedAt,snapshot) VALUES(?,?,?,?) ON CONFLICT(connectionId) DO UPDATE SET version=excluded.version,updatedAt=excluded.updatedAt,snapshot=excluded.snapshot')
        .run(connectionId, version, updatedAt, JSON.stringify(snapshot));
      return { ...snapshot, version, updatedAt };
    });
  }
  close(): void { for (const db of this.databases.values()) db.close(); this.databases.clear(); }
}
