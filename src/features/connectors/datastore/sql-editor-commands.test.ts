import { expect, test } from 'bun:test';
import { EditorState } from '@codemirror/state';
import { sql, SQLite } from '@codemirror/lang-sql';
import { sqlKeywordCaseChanges } from './sql-editor-commands';

test('keyword case preserves quoted names, strings, comments and layout, and is reversible', () => {
  const document = 'SELECT "select", city AS name\nFROM customers WHERE city = \'FROM\'; -- SELECT';
  const state = EditorState.create({ doc: document, extensions: sql({ dialect: SQLite }) });
  const lowered = state.update({ changes: sqlKeywordCaseChanges(state)! }).state;
  expect(lowered.doc.toString()).toBe(
    'select "select", city as name\nfrom customers where city = \'FROM\'; -- SELECT',
  );
  expect(lowered.update({ changes: sqlKeywordCaseChanges(lowered)! }).state.doc.toString()).toBe(
    document,
  );
});
test('selection changes only complete keywords inside the selected range', () => {
  const state = EditorState.create({
    doc: 'SELECT id FROM customers',
    selection: { anchor: 10, head: 14 },
    extensions: sql({ dialect: SQLite }),
  });
  expect(state.update({ changes: sqlKeywordCaseChanges(state)! }).state.doc.toString()).toBe(
    'SELECT id from customers',
  );
});
