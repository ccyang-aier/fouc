import { expect, test } from 'bun:test';
import {
  CompletionContext,
  nextSnippetField,
  prevSnippetField,
  snippet,
} from '@codemirror/autocomplete';
import { EditorState, type Transaction } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { DEFAULT_SQL_SNIPPETS, type RelationalProvider, type SqlSnippet } from '@fouc/shared';
import {
  sqlSnippetCompletion,
  sqlSnippetItems,
  sqlSnippetTemplate,
} from './sql-snippet-completion';

function context(text: string) {
  const pos = text.indexOf('|');
  return new CompletionContext(EditorState.create({ doc: text.replace('|', '') }), pos, true);
}
const custom: SqlSnippet = {
  id: 'custom-native',
  label: 'Personal SELECT',
  prefix: 'ssf',
  body: "SELECT ${field} FROM ${table} WHERE value = 'MixedCase';",
  enabled: true,
};

test('DBX common templates keep LIMIT 100, receive editable fields and preserve custom bodies', () => {
  const select = DEFAULT_SQL_SNIPPETS.find((entry) => entry.id === 'builtin-sel')!;
  expect(sqlSnippetTemplate(select, 'lower')).toBe('select * from ${table} limit 100;');
  expect(sqlSnippetTemplate(custom, 'lower')).toBe(custom.body);
  const changed = { ...select, body: "SELECT 'MixedCase' FROM MyTable;" };
  expect(sqlSnippetTemplate(changed, 'lower')).toBe(changed.body);
  expect(sqlSnippetItems('ssf', [custom], 'lower')[0].boost).toBe(99);
  expect(sqlSnippetItems('sf', [custom])).toHaveLength(0);
  expect(sqlSnippetItems('s', [{ ...custom, enabled: false }])).toHaveLength(0);
  expect(sqlSnippetItems('sele', [select])[0].boost).toBe(-40);
});

test('short built-in SQL stays on one line while structured and custom templates retain their layout', () => {
  for (const entry of DEFAULT_SQL_SNIPPETS.filter(
    (entry) => !['builtin-cte', 'builtin-ct'].includes(entry.id),
  )) {
    expect(sqlSnippetTemplate(entry)).not.toContain('\n');
  }
  for (const id of ['builtin-cte', 'builtin-ct'])
    expect(sqlSnippetTemplate(DEFAULT_SQL_SNIPPETS.find((entry) => entry.id === id)!)).toContain(
      '\n',
    );
  const customMultiline = {
    ...custom,
    body: "SELECT 'line one\nline two' -- keep this comment\nFROM ${table};",
  };
  expect(sqlSnippetTemplate(customMultiline)).toBe(customMultiline.body);
});

test('snippets respect native quote/comment/qualified-name boundaries and latest connection settings', async () => {
  for (const provider of ['mysql', 'postgres', 'sqlite'] as RelationalProvider[]) {
    let rows = [custom];
    const source = sqlSnippetCompletion(provider, () => ({ snippets: rows, keywordCase: 'lower' }));
    expect((await source(context('ssf|')))?.options[0].label).toBe('ssf');
    for (const text of [
      "SELECT 'ssf|'",
      'SELECT 1 -- ssf|',
      'SELECT 1 /* ssf| */',
      'SELECT x.ssf| FROM users x',
      'SELECT "ssf|"',
    ])
      expect(await source(context(text))).toBeNull();
    rows = [];
    expect(await source(context('ssf|'))).toBeNull();
    rows = [{ ...custom, prefix: 'my-sql' }];
    const dashed = await source(context('my-sql|'));
    expect(dashed?.from).toBe(0);
    expect(dashed?.options[0].label).toBe('my-sql');
  }
});

test('CodeMirror inserts and navigates actual snippet fields without executing SQL', () => {
  let state = EditorState.create({ doc: 'ssf', selection: { anchor: 3 } });
  const dispatch = (transaction: Transaction) => {
    state = transaction.state;
  };
  const editor = {
    get state() {
      return state;
    },
    dispatch,
  } as unknown as EditorView;
  snippet('SELECT ${field} FROM ${table} WHERE id = ${id}')(editor, custom, 0, 3);
  expect(state.doc.toString()).toBe('SELECT field FROM table WHERE id = id');
  expect(state.sliceDoc(state.selection.main.from, state.selection.main.to)).toBe('field');
  expect(nextSnippetField({ state, dispatch })).toBe(true);
  expect(state.sliceDoc(state.selection.main.from, state.selection.main.to)).toBe('table');
  expect(prevSnippetField({ state, dispatch })).toBe(true);
  expect(state.sliceDoc(state.selection.main.from, state.selection.main.to)).toBe('field');
});
