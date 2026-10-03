import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { SqlDraftSnapshot } from '@fouc/shared';
import { RelationalSqlRepository } from './sql-library-repository';

function draft(sql = '-- 中文\nSELECT 9007199254740993;'): SqlDraftSnapshot {
  return { activeTabId: 'a', tabs: [{ id: 'a', title: '查询 A', customTitle: true, pinned: true, database: 'db', schema: 'public', sql, originalSql: '',
    savedFile: { id: 'file', name: 'query.sql', folderId: null, version: 'baseline' }, editorPosition: { anchor: 3, head: 900, scrollTop: 122.5, scrollLeft: 8 }, resultView: 'json' }] };
}
test('SQL draft snapshots survive reopening, preserve empty file edits and enforce workspace/connection CAS', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fouc-sql-drafts-')); let repo = new RelationalSqlRepository(directory);
  try {
    const first = repo.saveDrafts('w', 'c', { ...draft(), version: null, runtimeResult: { rows: ['not durable'] } });
    expect(first.tabs[0].editorPosition.head).toBe(first.tabs[0].sql.length); expect(first).not.toHaveProperty('runtimeResult');
    expect(repo.drafts('other', 'c').tabs).toEqual([]); expect(repo.drafts('w', 'other').version).toBeNull();
    expect(() => repo.saveDrafts('w', 'c', { ...draft('lost'), version: null })).toThrow('其他窗口');
    repo.close(); repo = new RelationalSqlRepository(directory);
    expect(repo.drafts('w', 'c')).toEqual(first);
    const emptied = repo.saveDrafts('w', 'c', { ...draft(''), version: first.version });
    expect(emptied.tabs[0].sql).toBe(''); expect(emptied.tabs[0].savedFile?.version).toBe('baseline');
    expect(emptied.tabs[0].editorPosition.anchor).toBe(0); expect(emptied.version).not.toBe(first.version);
    expect(() => repo.saveDrafts('w', 'c', { ...draft('stale'), version: first.version })).toThrow('其他窗口');
    repo.removeConnection('w', 'c'); expect(repo.drafts('w', 'c').version).toBeNull();
  } finally {
    repo.close(); Bun.gc(true); await new Promise((resolve) => setTimeout(resolve, 20));
    const target = path.resolve(directory);
    if (!target.startsWith(path.resolve(tmpdir()) + path.sep + 'fouc-sql-drafts-')) throw new Error('Unexpected SQL draft cleanup target');
    rmSync(target, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
});
test('invalid tab identity, active membership, UTF-8 and UI positions cannot replace an existing snapshot', () => {
  const repo = new RelationalSqlRepository();
  try {
    const first = repo.saveDrafts('w', 'c', { ...draft(), version: null });
    const base = { ...draft(), version: first.version }, tab = base.tabs[0];
    for (const invalid of [
      { ...base, activeTabId: 'missing' }, { ...base, tabs: [tab, tab] }, { ...base, activeTabId: null },
      { ...base, tabs: [{ ...tab, sql: '\ud800' }] }, { ...base, tabs: [{ ...tab, resultView: 'execute' }] },
      { ...base, tabs: [{ ...tab, editorPosition: { ...tab.editorPosition, scrollTop: -1 } }] },
      { ...base, tabs: [{ ...tab, editorPosition: { ...tab.editorPosition, head: 1.5 } }] },
    ]) expect(() => repo.saveDrafts('w', 'c', invalid)).toThrow();
    expect(repo.drafts('w', 'c')).toEqual(first);
    const empty = repo.saveDrafts('w', 'c', { tabs: [], activeTabId: null, version: first.version });
    expect(empty.tabs).toEqual([]); expect(empty.version).not.toBeNull();
  } finally { repo.close(); }
});
