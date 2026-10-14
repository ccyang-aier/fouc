import { expect, test } from 'bun:test';
import { EditorState } from '@codemirror/state';
import { buildSqlSemanticModel } from '../../sql-semantic/model';
import {
  buildSqlSemanticDiagnostics,
  type SqlSemanticDiagnosticSchema,
} from './semantic-diagnostics';
import { sqlAliasHighlightGroups } from './alias-highlights';
import { findCteColumnResolution, resolveCteColumnOrigins } from './cte-navigation';
import { sqlReferenceNavigationAt } from './references';
import {
  sqlDiagnosticsStateField,
  sqlDiagnosticsExtensions,
  setSqlDiagnosticMetadata,
  setSqlDiagnosticLocale,
} from './extension';

test('language changes rebuild diagnostics while retaining the same metadata snapshot', () => {
  const sql = "SELECT ('unterminated";
  const field = sqlDiagnosticsStateField('sqlite', 'zh-CN');
  let state = EditorState.create({ doc: sql, extensions: [field] });
  const metadata: SqlSemanticDiagnosticSchema = { sql, columnsByTable: new Map() };
  state = state.update({ effects: setSqlDiagnosticMetadata.of(metadata) }).state;
  const chinese = state
    .field(field)
    .diagnostics.map((item) => item.message)
    .join(' ');
  expect(chinese).toMatch(/[\u3400-\u9fff]/);
  state = state.update({ effects: setSqlDiagnosticLocale.of('en-US') }).state;
  expect(state.field(field).metadata).toBe(metadata);
  expect(
    state
      .field(field)
      .diagnostics.map((item) => item.message)
      .join(' '),
  ).not.toMatch(/[\u3400-\u9fff]/);
  expect(state.doc.toString()).toBe(sql);
});
import { lineColumnToOffset, sqlErrorDecorationRange } from './error-locations';

for (const provider of ['mysql', 'postgres', 'sqlite'] as const) {
  test(`${provider}: native literals/comments, UTF-16 spans and statement-local alias checks`, () => {
    const quote = provider === 'mysql' ? '`' : provider === 'sqlite' ? '[' : '"';
    const close = quote === '[' ? ']' : quote;
    const source = `SELECT '😀; ghost.id' AS literal, i.id FROM items i;\r\n-- missing.id\nSELECT ghost.id FROM ${quote}items${close} i`;
    const diagnostics = buildSqlSemanticDiagnostics(source, provider);
    expect(diagnostics).toHaveLength(1);
    expect(source.slice(diagnostics[0].span.start, diagnostics[0].span.end)).toBe('ghost');
    expect(diagnostics[0].span.start).toBe(source.lastIndexOf('ghost'));
    expect(
      buildSqlSemanticDiagnostics('SELECT u.id FROM items u; SELECT u.id FROM items', provider),
    ).toHaveLength(1);
    expect(
      buildSqlSemanticDiagnostics(
        "SELECT i.id FROM items i /* missing.foo */ WHERE i.name='done'",
        provider,
      ),
    ).toEqual([]);
    expect(
      buildSqlSemanticDiagnostics(
        'SELECT ' + quote + 'field' + close + ' FROM ' + quote + 'items' + close,
        provider,
      ),
    ).toEqual([]);
  });
}

test('Postgres dollar bodies and nested comments keep SQL-looking content opaque', () => {
  expect(
    buildSqlSemanticDiagnostics(
      'SELECT $$ghost.id; )$$, $tag$missing.col$tag$; /* outer /* inner ) */ end */ SELECT 1',
      'postgres',
    ),
  ).toEqual([]);
  const unclosed = 'SELECT $tag$ghost.id';
  const diagnostics = buildSqlSemanticDiagnostics(unclosed, 'postgres');
  expect(diagnostics).toHaveLength(1);
  expect(unclosed.slice(diagnostics[0].span.start, diagnostics[0].span.end)).toBe('$tag$');
  expect(buildSqlSemanticDiagnostics('SELECT (1))', 'sqlite').map((item) => item.message)).toEqual([
    '右括号没有对应的左括号',
  ]);
});

test('DBX alias groups shadow outer aliases and retain quoted declaration spans', () => {
  const source = 'SELECT u.id, (SELECT u.name FROM users u) FROM teams u';
  const groups = sqlAliasHighlightGroups(source, 'postgres');
  expect(groups).toHaveLength(2);
  expect(
    groups.map((group) => group.references.map((span) => source.slice(span.start, span.end))),
  ).toEqual([['u.id'], ['u.name']]);
  expect(sqlAliasHighlightGroups('SELECT u.id FROM teams u, users u', 'mysql')).toEqual([]);
  const sqlite = 'SELECT [U].id FROM items AS [u]';
  const sqliteGroups = sqlAliasHighlightGroups(sqlite, 'sqlite');
  expect(sqliteGroups).toHaveLength(1);
  expect(sqlite.slice(sqliteGroups[0].declaration.start, sqliteGroups[0].declaration.end)).toBe(
    '[u]',
  );
  expect(sqliteGroups[0].references).toHaveLength(1);
  expect(
    buildSqlSemanticDiagnostics(
      'SELECT outer_table.id FROM items outer_table, (SELECT outer_table.id) nested',
      'postgres',
    ),
  ).toHaveLength(1);
});

test('CTE output navigation follows renamed chains and chooses the local shadowing definition', () => {
  const source =
    'WITH a AS (SELECT t.name AS label FROM teams t), b AS (SELECT label AS shown FROM a) SELECT x.shown FROM b x';
  const position = source.indexOf('x.shown') + 4;
  const navigation = sqlReferenceNavigationAt(source, position, 'postgres');
  expect(navigation?.kind).toBe('column');
  expect(source.slice(navigation!.target!.start, navigation!.target!.end)).toBe('shown');
  expect(navigation?.origins).toEqual([{ table: 'teams', column: 'name' }]);
  const nested =
    'WITH c AS (SELECT 1 AS outer_field) SELECT (WITH c AS (SELECT 2 AS inner_field) SELECT c.inner_field FROM c), c.outer_field FROM c';
  const inner = sqlReferenceNavigationAt(nested, nested.indexOf('c.inner_field') + 4, 'postgres');
  const outer = sqlReferenceNavigationAt(
    nested,
    nested.lastIndexOf('c.outer_field') + 4,
    'postgres',
  );
  expect(nested.slice(inner!.target!.start, inner!.target!.end)).toBe('inner_field');
  expect(nested.slice(outer!.target!.start, outer!.target!.end)).toBe('outer_field');
  const model = buildSqlSemanticModel(source, source.indexOf('x.shown') + 7, {
    provider: 'postgres',
  });
  const hit = findCteColumnResolution(model, 'shown', 'x');
  expect(resolveCteColumnOrigins(model, hit!, 'shown').map((origin) => origin.source.name)).toEqual(
    ['teams'],
  );
});

test('unknown metadata stays quiet, known CTE outputs/ambiguity and stale metadata are handled', () => {
  expect(buildSqlSemanticDiagnostics('SELECT i.missing FROM items i', 'postgres')).toEqual([]);
  expect(
    buildSqlSemanticDiagnostics(
      'WITH c AS (SELECT i.* FROM items i) SELECT c.missing FROM c',
      'postgres',
    ),
  ).toEqual([]);
  const virtual =
    'WITH a AS (SELECT 1 AS id), b AS (SELECT 2 AS id) SELECT id FROM a JOIN b ON a.id=b.id';
  expect(
    buildSqlSemanticDiagnostics(virtual, 'postgres').some((item) =>
      item.message.includes('多个已知来源'),
    ),
  ).toBe(true);
  expect(
    buildSqlSemanticDiagnostics(
      'WITH c AS (SELECT 1 AS id) SELECT c.missing FROM c',
      'postgres',
    ).map((item) => item.message),
  ).toEqual(['已知来源 c 没有字段 missing']);
  const source = 'SELECT i.missing FROM public.items i';
  const schema: SqlSemanticDiagnosticSchema = {
    sql: source,
    columnsByTable: new Map([['public.items', [{ name: 'id' }]]]),
  };
  expect(buildSqlSemanticDiagnostics(source, 'postgres', schema)).toHaveLength(1);
  expect(buildSqlSemanticDiagnostics(source, 'postgres', { ...schema, sql: source + ';' })).toEqual(
    [],
  );
});

test('editor field removes fixed diagnostics after typing and owns each independent document', () => {
  const field = sqlDiagnosticsStateField('postgres');
  const source = 'SELECT ghost.id FROM items i';
  let state = EditorState.create({
    doc: source,
    extensions: [field, sqlDiagnosticsExtensions('postgres')],
  });
  expect(state.field(field).diagnostics).toHaveLength(1);
  state = state.update({ changes: { from: 7, to: 12, insert: 'i' } }).state;
  expect(state.field(field).diagnostics).toEqual([]);
  expect(state.field(field).aliases).toHaveLength(1);
  const independent = EditorState.create({ doc: 'SELECT 1', extensions: [field] });
  expect(independent.field(field).aliases).toEqual([]);
  expect(independent.field(field).diagnostics).toEqual([]);
  const large = 'SELECT 1;'.repeat(16_000);
  const largeState = EditorState.create({ doc: large, extensions: [field] });
  expect(largeState.doc.length).toBe(large.length);
  expect(largeState.field(field).sql).toBe('');
  expect(largeState.field(field).diagnostics).toEqual([]);
});

test('native error coordinates preserve CRLF and UTF-16 offsets', () => {
  const source = "SELECT '😀';\r\nSELECT missing FROM items";
  expect(lineColumnToOffset(source, { line: 1, column: 7 })).toBe(source.indexOf('missing'));
  const range = sqlErrorDecorationRange(source, 'syntax error at Line: 2, Column: 8', 'postgres');
  expect(source.slice(range!.from, range!.to)).toBe('missing');
  expect(sqlErrorDecorationRange(source, 'no line reported', 'mysql')).toBeNull();
});
