import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RelationalSqlRepository } from './sql-library-repository';
import type { SqlHistoryEntry } from '@fouc/shared';

function entry(id: string, connectionId: string, database = 'same'): SqlHistoryEntry {
  return { id, connectionId, connectionName: connectionId, provider: 'mysql', database, schema: database, sql: `SELECT '${id}_%'`, executedAt: 100,
    executionTimeMs: 1, success: id !== 'error', error: id === 'error' ? 'native error' : null, rowCount: 1, truncated: false };
}
test('SQLite SQL history persists, preserves complete source and uses stable equal-time cursors and connection-qualified filters', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fouc-sql-store-')); let repo = new RelationalSqlRepository(directory);
  try {
    for (const [id, conn] of [['c', 'a'], ['b', 'b'], ['a', 'a'], ['error', 'b']]) repo.append(entry(id, conn));
    repo.close(); repo = new RelationalSqlRepository(directory);
    const first = repo.search({ limit: 2 }); expect(first.total).toBe(4); expect(first.entries.map((row) => row.id)).toEqual(['error', 'c']);
    repo.deleteHistory('c'); repo.append({ ...entry('new', 'a'), executedAt: 101 });
    expect(repo.search({ limit: 2, cursor: first.nextCursor }).entries.map((row) => row.id)).toEqual(['b', 'a']);
    expect(repo.search({ connectionIds: ['a', 'b'], databases: [{ connectionId: 'a', database: 'no-match' }] }).entries.map((row) => row.id)).toEqual(['error', 'b']);
    expect(repo.search({ search: '_%' }).total).toBe(4); expect(repo.search({ success: false }).total).toBe(1);
    expect(repo.search({}).total).toBe(4); expect(() => repo.history('missing')).toThrow();
    expect(() => repo.history('a', 'b')).toThrow(); expect(() => repo.search({ startedAt: 100, endedAt: 99 })).toThrow();
    expect(repo.history('a').sql).toBe("SELECT 'a_%'");
    repo.clearHistory('a'); expect(repo.search({}).total).toBe(2);
    for (let index = 0; index < 1002; index++) repo.append({ ...entry(`limit-${String(index).padStart(4, '0')}`, 'a'), executedAt: 200 + index });
    expect(repo.search({}).total).toBe(1000); expect(() => repo.history('limit-0001')).toThrow();
  } finally {
    repo.close(); Bun.gc(true); await new Promise((resolve) => setTimeout(resolve, 20));
    if (!path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep + 'fouc-sql-store-')) throw new Error('Unexpected SQL test directory');
    rmSync(directory, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
});
test('SQL library lazy summaries, CAS saves, name/target guards, subtree deletion and ordering retain document bytes', () => {
  const repo = new RelationalSqlRepository();
  try {
    const root = repo.saveFolder('c', { name: 'Root', parentFolderId: null });
    const child = repo.saveFolder('c', { name: 'Nested', parentFolderId: root.id });
    expect(() => repo.saveFolder('c', { name: 'Root', parentFolderId: child.id }, root.id)).toThrow('子文件夹');
    expect(() => repo.saveFolder('c', { name: 'root', parentFolderId: null })).toThrow('同名');
    expect(() => repo.saveFolder('other', { name: 'foreign', parentFolderId: root.id })).toThrow();
    const sql = '-- 中文\nSELECT 9007199254740993;';
    const a = repo.saveFile('c', { name: 'query', folderId: child.id, database: 'db', schema: 'public', sql });
    expect(a.name).toBe('query.sql'); expect(a.sqlBytes).toBe(Buffer.byteLength(sql)); expect(repo.library('c').files[0]).not.toHaveProperty('sql');
    expect(repo.file('c', a.id, true).openCount).toBe(1);
    const updated = repo.saveFile('c', { version: a.version, name: 'renamed' }, a.id); expect(updated.sql).toBe(sql); expect(updated.openCount).toBe(1);
    expect(() => repo.saveFile('c', { version: a.version, sql: 'lost' }, a.id)).toThrow('修改');
    expect(() => repo.deleteFile('c', a.id, a.version)).toThrow('变化');
    expect(() => repo.file('missing-connection', a.id)).toThrow(); expect(() => repo.file('other', a.id)).toThrow();
    expect(() => repo.saveFile('c', { name: 'RENAMED.SQL', folderId: child.id, database: 'db', schema: null, sql: '' })).toThrow('同名');
    const b = repo.saveFile('c', { name: 'other', folderId: child.id, database: 'db', schema: null, sql: '' });
    repo.reorder('c', { kind: 'files', ids: [b.id, a.id], parentFolderId: child.id, database: 'db' }); expect(repo.library('c').files.map((file) => file.id)).toEqual([b.id, a.id]);
    expect(() => repo.reorder('c', { kind: 'files', ids: [b.id], parentFolderId: child.id, database: 'db' })).toThrow('全部');
    repo.deleteFolder('c', root.id); expect(repo.library('c')).toEqual({ folders: [], files: [] });
  } finally { repo.close(); }
});

test('a maximum-length normalized SQL filename can be reopened and saved again without invalidating its own name', () => {
  const repo = new RelationalSqlRepository();
  try {
    const file = repo.saveFile('c', { name: 'q'.repeat(196), database: 'db', schema: null, sql: 'SELECT 1' });
    expect(file.name.length).toBe(200);
    const updated = repo.saveFile('c', { name: file.name, version: file.version, sql: 'SELECT 2' }, file.id);
    expect(repo.file('c', updated.id).sql).toBe('SELECT 2');
    expect(() => repo.saveFile('c', { name: 'q'.repeat(197), database: 'db', schema: null, sql: 'SELECT 1' })).toThrow('扩展名');
  } finally { repo.close(); }
});
