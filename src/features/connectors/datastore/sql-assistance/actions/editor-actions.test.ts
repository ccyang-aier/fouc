import { expect, test } from 'bun:test';
import { history, undo } from '@codemirror/commands';
import {
  EditorState,
  StateEffect,
  type Transaction,
  type TransactionSpec,
} from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { RelationalProvider } from '@fouc/shared';
import { applySqlAction, captureSqlAction, sqlTextActionEdit } from './editor-actions';
import { analyzeIntentionActions } from './intention-actions';
import {
  intentionActionEdit,
  sqlInListEdit,
  sqlLineCommentEdit,
  sqlBlockCommentEdit,
  sqlWildcardEdit,
  sqlWildcardFields,
} from './action-edits';
import {
  buildSqlTableShortcut,
  resolveSqlShortcutTableToken,
  sqlShortcutContextTable,
  sqlTableNameIssue,
  sqlTableShortcutEdit,
} from './table-shortcuts';

function fixture(doc: string, selection: { anchor: number; head?: number }) {
  let state = EditorState.create({ doc, selection, extensions: history() }),
    updates = 0;
  const view = {
    get state() {
      return state;
    },
    dispatch: (transaction: Transaction | TransactionSpec) => {
      state = 'state' in transaction ? transaction.state : state.update(transaction).state;
      updates++;
    },
    focus: () => {},
  } as unknown as EditorView;
  return { view, snapshot: captureSqlAction(view)!, updates: () => updates };
}

test('batch qualification uses native Unicode tokens, preserves comments/literals and is one undoable transaction', () => {
  const doc = "SELECT 字段, name, 'KeepCase', COUNT(score) FROM users u -- name",
    from = 7,
    to = doc.indexOf(' FROM');
  const model = fixture(doc, { anchor: from, head: to });
  const action = analyzeIntentionActions({
    sql: doc,
    cursor: to,
    databaseType: 'mysql',
    selection: { from, to },
  })[0];
  expect(action.kind).toBe('batch_qualify_identifiers');
  expect(action.replacements?.map((entry) => entry.replacement)).toEqual([
    '`u`.`字段`',
    '`u`.`name`',
    '`u`.`score`',
  ]);
  expect(applySqlAction(() => model.view, model.snapshot, intentionActionEdit(action))).toBe(true);
  expect(model.updates()).toBe(1);
  expect(model.view.state.doc.toString()).toContain("'KeepCase'");
  expect(undo(model.view)).toBe(true);
  expect(model.view.state.doc.toString()).toBe(doc);
});

test('batch selection across statements resolves each statement’s owning table alias', () => {
  const doc = 'SELECT id FROM first_table x; SELECT name FROM second_table y';
  const actions = analyzeIntentionActions({
    sql: doc,
    cursor: doc.length,
    databaseType: 'postgres',
    selection: { from: 0, to: doc.length },
  });
  expect(actions[0].replacements?.map((entry) => entry.replacement)).toEqual([
    '"x"."id"',
    '"y"."name"',
  ]);
});

test('selection actions protect native literals and quote backslashes/identifiers precisely', () => {
  for (const provider of ['mysql', 'postgres', 'sqlite'] as RelationalProvider[]) {
    const doc = "select 'KeepCase', name from users",
      model = fixture(doc, { anchor: 0, head: doc.length });
    const edit = sqlTextActionEdit(model.snapshot, 'upper', provider)!;
    expect(applySqlAction(() => model.view, model.snapshot, edit)).toBe(true);
    expect(model.view.state.doc.toString()).toBe("SELECT 'KeepCase', NAME FROM USERS");
    const text = "O'Reilly\\x",
      quote = fixture(text, { anchor: 0, head: text.length });
    applySqlAction(
      () => quote.view,
      quote.snapshot,
      sqlTextActionEdit(quote.snapshot, 'quote-string', provider)!,
    );
    expect(quote.view.state.doc.toString()).toBe(
      provider === 'mysql' ? "'O''Reilly\\\\x'" : "'O''Reilly\\x'",
    );
    const identifier = fixture('Mixed Name', { anchor: 0, head: 10 });
    applySqlAction(
      () => identifier.view,
      identifier.snapshot,
      sqlTextActionEdit(identifier.snapshot, 'quote-identifier', provider)!,
    );
    expect(identifier.view.state.doc.toString()).toBe(
      provider === 'mysql' ? '`Mixed Name`' : '"Mixed Name"',
    );
  }
});

test('quote insertion keeps its caret inside a new pair; existing closing quote is skipped', () => {
  const empty = fixture('', { anchor: 0 });
  applySqlAction(
    () => empty.view,
    empty.snapshot,
    sqlTextActionEdit(empty.snapshot, 'quote-string', 'postgres')!,
  );
  expect(empty.view.state.doc.toString()).toBe("''");
  expect(empty.view.state.selection.main.head).toBe(1);
  const pair = fixture("''", { anchor: 1 });
  applySqlAction(
    () => pair.view,
    pair.snapshot,
    sqlTextActionEdit(pair.snapshot, 'quote-string', 'postgres')!,
  );
  expect(pair.view.state.doc.toString()).toBe("''");
  expect(pair.view.state.selection.main.head).toBe(2);
});

test('stale state/view snapshots cannot overwrite subsequent edits or another document', () => {
  const model = fixture('name', { anchor: 0, head: 4 }),
    edit = sqlTextActionEdit(model.snapshot, 'upper', 'mysql')!;
  model.view.dispatch({ changes: { from: 0, insert: 'new ' } });
  expect(applySqlAction(() => model.view, model.snapshot, edit)).toBe(false);
  expect(model.view.state.doc.toString()).toBe('new name');
  const other = fixture('other', { anchor: 0 });
  expect(applySqlAction(() => other.view, model.snapshot, edit)).toBe(false);
});

test('tooltip/focus effects retain the intended edit while cursor changes invalidate it', () => {
  const model = fixture('name', { anchor: 0, head: 4 }),
    edit = sqlTextActionEdit(model.snapshot, 'upper', 'mysql')!;
  model.view.dispatch({ effects: StateEffect.define<boolean>().of(false) });
  expect(model.view.state).not.toBe(model.snapshot.state);
  expect(applySqlAction(() => model.view, model.snapshot, edit)).toBe(true);
  const next = captureSqlAction(model.view)!;
  model.view.dispatch({ selection: { anchor: 1 } });
  expect(applySqlAction(() => model.view, next, edit)).toBe(false);
});

test('IN list quotes native strings and precise integers without duplicating existing NOT IN', () => {
  for (const provider of ['mysql', 'postgres', 'sqlite'] as RelationalProvider[]) {
    const doc = 'SELECT * FROM t WHERE id NOT IN ',
      model = fixture(doc, { anchor: doc.length });
    const conversion = sqlInListEdit(
      model.snapshot,
      "9007199254740993\nO'Reilly\\x\nNULL",
      provider,
      'lower',
    );
    expect(conversion.result.ok).toBe(true);
    expect(applySqlAction(() => model.view, model.snapshot, conversion.edit!)).toBe(true);
    const sql = model.view.state.doc.toString();
    expect(sql).toContain("NOT IN ('9007199254740993'");
    expect(sql).toContain('NULL)');
    expect(sql).toContain(provider === 'mysql' ? "O''Reilly\\\\x" : "O''Reilly\\x");
  }
});

test('table target preserves qualified source text; generated SELECT/count/projection append without executing', () => {
  for (const provider of ['mysql', 'postgres', 'sqlite'] as RelationalProvider[]) {
    const doc = 'SELECT name FROM catalog.users u -- comment',
      model = fixture(doc, { anchor: 9 });
    expect(sqlShortcutContextTable(model.snapshot, provider)).toBe('catalog.users');
    const head = doc.indexOf('users') + 2;
    expect(
      resolveSqlShortcutTableToken(doc, { from: head, to: head, empty: true, head }, provider),
    ).toBe('catalog.users');
    expect(sqlTableNameIssue('catalog.users', provider)).toBe('');
    expect(sqlTableNameIssue('users; DELETE FROM users', provider)).not.toBe('');
    const query = buildSqlTableShortcut('projection', 'catalog.users', 27, 'id, name', 'lower');
    expect(query).toBe('select id, name\nfrom catalog.users\nlimit 27;');
    applySqlAction(() => model.view, model.snapshot, sqlTableShortcutEdit(model.snapshot, query));
    expect(model.view.state.doc.toString()).toContain('-- comment\n;\n\nselect');
    expect(undo(model.view)).toBe(true);
    expect(model.view.state.doc.toString()).toBe(doc);
    expect(buildSqlTableShortcut('count', 'catalog.users', 100, '*')).toBe(
      'SELECT COUNT(*) AS row_count\nFROM catalog.users;',
    );
  }
});

test('known CTE fields and qualified stars expand without duplicating or losing alias qualifiers', async () => {
  const doc = 'WITH c(id, name) AS (SELECT 1, 2) SELECT c.* FROM c',
    head = doc.indexOf('*') + 1;
  const model = fixture(doc, { anchor: head }),
    rows = sqlWildcardFields(model.snapshot, 'postgres');
  expect(rows).toHaveLength(1);
  expect(rows[0].fields).toEqual(['id', 'name']);
  const edit = await sqlWildcardEdit(model.snapshot, 'postgres', { [rows[0].id]: rows[0].fields });
  expect(edit).not.toBeNull();
  applySqlAction(() => model.view, model.snapshot, edit!);
  expect(model.view.state.doc.toString()).toContain('SELECT c."id", "c"."name" FROM c');
  expect(undo(model.view)).toBe(true);
  expect(model.view.state.doc.toString()).toBe(doc);
});

test('line and block comments toggle as reversible edits', () => {
  const doc = 'SELECT id,\n  name\nFROM users',
    model = fixture(doc, { anchor: 0, head: doc.length });
  applySqlAction(() => model.view, model.snapshot, sqlLineCommentEdit(model.snapshot));
  expect(model.view.state.doc.toString()).toBe('-- SELECT id,\n  -- name\n-- FROM users');
  const next = captureSqlAction(model.view)!;
  applySqlAction(() => model.view, next, sqlLineCommentEdit(next));
  expect(model.view.state.doc.toString()).toBe(doc);
  const block = captureSqlAction(model.view)!;
  applySqlAction(() => model.view, block, sqlBlockCommentEdit(block, 'postgres')!);
  expect(model.view.state.doc.toString()).toBe(`/* ${doc} */`);
});
