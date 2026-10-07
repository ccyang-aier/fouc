import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { defaultSqlEditorPreferences, SQL_EDITOR_PREFERENCES_MAX_BYTES, SQL_SNIPPET_MAX_BODY_BYTES, SQL_SNIPPET_MAX_COUNT } from '@fouc/shared';
import { RelationalSqlRepository } from './sql-library-repository';

function snapshot(preferences = defaultSqlEditorPreferences()) {
  const { updatedAt: _updatedAt, ...input } = preferences;
  return input;
}

test('SQL editor preferences persist with connection isolation, CAS and deletion cleanup', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fouc-sql-preferences-'));
  let repo = new RelationalSqlRepository(directory);
  try {
    const first = repo.saveEditorPreferences('c', { ...snapshot(), formatOnSave: true });
    expect(first.version).toBeString();
    expect(first.updatedAt).toBeNumber();
    expect(repo.editorPreferences('c')).toEqual(first);
    expect(repo.editorPreferences('other')).toEqual(defaultSqlEditorPreferences());
    expect(() => repo.saveEditorPreferences('c', snapshot())).toThrow('其他窗口');
    repo.close();
    repo = new RelationalSqlRepository(directory);
    expect(repo.editorPreferences('c')).toEqual(first);
    const changed = repo.saveEditorPreferences('c', { ...snapshot(first), snippets: [{ id: 'custom', label: '中文查询', prefix: '中文', body: "SELECT '${value}' AS value;", enabled: false }] });
    expect(changed.version).not.toBe(first.version);
    expect(() => repo.saveEditorPreferences('c', snapshot(first))).toThrow('其他窗口');
    expect(repo.editorPreferences('c')).toEqual(changed);
    repo.saveEditorPreferences('other', snapshot());
    repo.saveEditorPreferences('third', snapshot());
    repo.removeConnection('c');
    expect(repo.editorPreferences('c')).toEqual(defaultSqlEditorPreferences());
    expect(repo.editorPreferences('other').version).not.toBeNull();
    expect(repo.editorPreferences('third').version).not.toBeNull();
    const defaults = defaultSqlEditorPreferences();
    defaults.snippets[0].body = 'local mutation';
    defaults.formatter.keywordCase = 'lower';
    expect(defaultSqlEditorPreferences().snippets[0].body).not.toBe('local mutation');
    expect(defaultSqlEditorPreferences().formatter.keywordCase).toBe('upper');
  } finally {
    repo.close();
    Bun.gc(true);
    const target = path.resolve(directory);
    if (!target.startsWith(path.resolve(tmpdir()) + path.sep + 'fouc-sql-preferences-')) throw new Error('Unexpected editor preferences cleanup target');
    rmSync(target, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
});

test('malformed or oversized settings cannot overwrite an existing preference snapshot', () => {
  const repo = new RelationalSqlRepository();
  try {
    const first = repo.saveEditorPreferences('c', snapshot());
    const input = snapshot(first), snippet = input.snippets[0];
    const invalid: unknown[] = [
      null,
      { ...input, updatedAt: first.updatedAt },
      { ...input, version: 'not-a-version' },
      { ...input, formatOnSave: 1 },
      { ...input, formatter: { keywordCase: 'upper' } },
      { ...input, formatter: { ...input.formatter, params: null } },
      { ...input, snippets: [snippet, snippet] },
      { ...input, snippets: [snippet, { ...snippet, id: 'different', prefix: snippet.prefix.toUpperCase() }] },
      { ...input, snippets: [{ ...snippet, extra: true }] },
      { ...input, snippets: [{ ...snippet, enabled: 'false' }] },
      { ...input, snippets: [{ ...snippet, prefix: 'two words' }] },
      { ...input, snippets: [{ ...snippet, body: '\ud800' }] },
      { ...input, snippets: [{ ...snippet, body: '中'.repeat(Math.floor(SQL_SNIPPET_MAX_BODY_BYTES / 3) + 1) }] },
      { ...input, snippets: Array.from({ length: SQL_SNIPPET_MAX_COUNT + 1 }, (_, index) => ({ ...snippet, id: `s-${index}`, prefix: `p${index}` })) },
      { ...input, snippets: Array.from({ length: Math.ceil(SQL_EDITOR_PREFERENCES_MAX_BYTES / SQL_SNIPPET_MAX_BODY_BYTES) + 1 }, (_, index) => ({ ...snippet, id: `s-${index}`, prefix: `p${index}`, body: 'x'.repeat(SQL_SNIPPET_MAX_BODY_BYTES) })) },
    ];
    for (const value of invalid) {
      expect(() => repo.saveEditorPreferences('c', value)).toThrow();
      expect(repo.editorPreferences('c')).toEqual(first);
    }
    const empty = repo.saveEditorPreferences('c', { ...input, snippets: [] });
    expect(empty.snippets).toEqual([]);
    expect(empty.version).not.toBe(first.version);
  } finally { repo.close(); }
});
