import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { databaseDocsName, emptyDatabaseDocsAnnotations, validateDatabaseDocsAnnotations, validateDatabaseDocsAnnotationsUpdate, type DatabaseDocsAnnotationState } from '@fouc/shared/database-docs';
import { DatabaseInputError } from './input-error';

/** The authoritative prose store is local to the owning device workspace. */
export class DatabaseDocsRepository {
  private readonly databases = new Map<string, DatabaseSync>();
  constructor(private readonly directory: string | null = null) {}
  private db(workspaceId: string): DatabaseSync {
    databaseDocsName(workspaceId,'工作空间',128); const existing = this.databases.get(workspaceId); if (existing) return existing;
    let file = ':memory:';
    if (this.directory !== null) { mkdirSync(this.directory,{recursive:true}); file = path.join(this.directory,createHash('sha256').update(workspaceId).digest('hex')+'.sqlite'); }
    const db = new DatabaseSync(file);
    try {
      if (this.directory !== null) chmodSync(file,0o600);
      db.exec(`PRAGMA busy_timeout=5000;
        CREATE TABLE IF NOT EXISTS database_docs_annotations (
          connectionId TEXT NOT NULL, databaseName TEXT NOT NULL, version TEXT NOT NULL, updatedAt INTEGER NOT NULL, annotations TEXT NOT NULL,
          PRIMARY KEY(connectionId,databaseName));`);
      this.databases.set(workspaceId,db); return db;
    } catch (error) { db.close(); throw error; }
  }
  get(workspaceId: string, connectionId: string, database: string): DatabaseDocsAnnotationState {
    databaseDocsName(connectionId,'连接',128); databaseDocsName(database,'数据库');
    const row = this.db(workspaceId).prepare('SELECT version,updatedAt,annotations FROM database_docs_annotations WHERE connectionId=? AND databaseName=?').get(connectionId,database);
    if (!row) return { version:null, updatedAt:null, persistent:this.directory !== null, annotations:emptyDatabaseDocsAnnotations() };
    return { version:String(row.version), updatedAt:Number(row.updatedAt), persistent:this.directory !== null, annotations:validateDatabaseDocsAnnotations(JSON.parse(String(row.annotations))) };
  }
  save(workspaceId: string, connectionId: string, database: string, value: unknown): DatabaseDocsAnnotationState {
    let input; try { input = validateDatabaseDocsAnnotationsUpdate(value); } catch (error) { throw new DatabaseInputError(error instanceof Error ? error.message : String(error)); }
    databaseDocsName(connectionId,'连接',128); databaseDocsName(database,'数据库');
    const db = this.db(workspaceId); db.exec('BEGIN IMMEDIATE');
    try {
      const prior = db.prepare('SELECT version FROM database_docs_annotations WHERE connectionId=? AND databaseName=?').get(connectionId,database);
      if ((prior ? String(prior.version) : null) !== input.version) throw new DatabaseInputError('其他窗口已修改本地文档笔记；当前编辑未提交，请重新读取后核对');
      const state = { version:randomUUID(),updatedAt:Date.now(),persistent:this.directory !== null,annotations:input.annotations };
      db.prepare('INSERT INTO database_docs_annotations(connectionId,databaseName,version,updatedAt,annotations) VALUES(?,?,?,?,?) ON CONFLICT(connectionId,databaseName) DO UPDATE SET version=excluded.version,updatedAt=excluded.updatedAt,annotations=excluded.annotations').run(connectionId,database,state.version,state.updatedAt,JSON.stringify(state.annotations));
      db.exec('COMMIT'); return state;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  deleteConnection(workspaceId: string, connectionId: string): void { databaseDocsName(connectionId,'连接',128); this.db(workspaceId).prepare('DELETE FROM database_docs_annotations WHERE connectionId=?').run(connectionId); }
  close(): void { for (const db of this.databases.values()) db.close(); this.databases.clear(); }
}
