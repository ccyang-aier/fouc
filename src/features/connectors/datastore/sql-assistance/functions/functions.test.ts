import { expect, test } from 'bun:test';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState, type Transaction } from '@codemirror/state';
import {
  buildFunctionSnippetItems,
  sqlFunctionCompletion,
  sqlFunctionTemplate,
} from './completion';
import { sqlFunctionRegistry, sqlFunctionReplacesKeyword } from './registry';
import { sqlKeywordCompletion } from '../../sql-metadata-completion';
import {
  getSqlFunctionSignatureHelp,
  MAX_SQL_ASSISTANCE_DOCUMENT_CHARS,
  sqlFunctionAtPosition,
} from './signature';

function help(source: string, provider: 'mysql' | 'postgres' | 'sqlite' = 'mysql') {
  return getSqlFunctionSignatureHelp(source, source.length, provider);
}
function context(source: string) {
  const position = source.indexOf('|');
  return new CompletionContext(
    EditorState.create({ doc: source.replace('|', '') }),
    position,
    true,
  );
}

test('native function names replace old keyword completions while real dual-role keywords remain', async () => {
  const old = await sqlKeywordCompletion('mysql')(context('SELECT coa|'));
  expect(old?.options.some((entry) => entry.label === 'COALESCE')).toBe(true);
  const filtered = old?.options.filter(
    (entry) => !sqlFunctionReplacesKeyword(entry.label, 'mysql'),
  );
  expect(filtered?.some((entry) => entry.label === 'COALESCE')).toBe(false);
  expect(
    buildFunctionSnippetItems('coa', 'mysql').filter((entry) => entry.label === 'COALESCE'),
  ).toHaveLength(1);
  expect(sqlFunctionReplacesKeyword('CAST', 'mysql')).toBe(true);
  expect(sqlFunctionReplacesKeyword('EXTRACT', 'postgres')).toBe(true);
  expect(sqlFunctionReplacesKeyword('LEFT', 'mysql')).toBe(false);
  expect(sqlFunctionReplacesKeyword('RIGHT', 'mysql')).toBe(false);
});

test('native registries supply actual descriptions and omit foreign/removed functions', () => {
  for (const provider of ['mysql', 'postgres', 'sqlite'] as const) {
    for (const definition of sqlFunctionRegistry(provider).values()) {
      expect(typeof definition.description).toBe('string');
      expect(definition.description.length).toBeGreaterThan(0);
      expect(definition.documentation.startsWith('https://')).toBe(true);
    }
  }
  expect(sqlFunctionRegistry('mysql').has('DATE_ADD')).toBe(true);
  expect(sqlFunctionRegistry('mysql').has('PASSWORD')).toBe(false);
  expect(sqlFunctionRegistry('postgres').has('GEN_RANDOM_UUID')).toBe(true);
  expect(sqlFunctionRegistry('postgres').has('DATE_ADD')).toBe(false);
  expect(sqlFunctionRegistry('sqlite').has('STRFTIME')).toBe(true);
  expect(sqlFunctionRegistry('sqlite').has('NOW')).toBe(false);
  expect(sqlFunctionRegistry('sqlite').has('EXTRACT')).toBe(false);
  expect(sqlFunctionRegistry('sqlserver' as never).size).toBe(0);
});

test('DBX native signature help selects parameters and variadic tails', () => {
  const result = help('SELECT DATE_ADD(created_at, ');
  expect(result?.name).toBe('DATE_ADD');
  expect(result?.overloads).toHaveLength(1);
  expect(result?.overloads[0].parameterGroups).toEqual([['date', 'INTERVAL expr unit']]);
  expect(result?.activeParameter).toBe(1);
  expect(help('SELECT CONCAT(a, b, c, d, ')?.parameters).toEqual(['value', '...values']);
  expect(help('SELECT CONCAT(a, b, c, d, ')?.activeParameter).toBe(1);
  expect(help('SELECT NOW(')?.parameters).toEqual([]);
});

test('nested calls and grouping commas do not change the outer argument index', () => {
  expect(help('SELECT COALESCE(SUM(amount), ')?.activeParameter).toBe(1);
  expect(help('SELECT COALESCE((1 + 2), ')?.activeParameter).toBe(1);
  expect(help('SELECT COALESCE((1 + 2')?.name).toBe('COALESCE');
  expect(help('SELECT COALESCE(unknown_function(')).toBeNull();
  expect(help('SELECT COALESCE(ARRAY[1,2], ', 'postgres')?.activeParameter).toBe(1);
});

test('native quotes, comments and escapes are lexed rather than counted as commas', () => {
  expect(help("SELECT CONCAT('a,b', ")?.activeParameter).toBe(1);
  expect(help("SELECT CONCAT('a\\\'b,c', ")?.activeParameter).toBe(1);
  expect(help('SELECT CONCAT(`a``b,c`, ')?.activeParameter).toBe(1);
  expect(help('SELECT COALESCE($tag$(a,b)$tag$, ', 'postgres')?.activeParameter).toBe(1);
  expect(
    help('SELECT COALESCE(/* outer /* nested, ( */ tail */ NULL, ', 'postgres')?.activeParameter,
  ).toBe(1);
  expect(help('SELECT COALESCE([a,b], ', 'sqlite')?.activeParameter).toBe(1);
  expect(help('SELECT CONCAT(a, -- comma, ignored\n ')?.activeParameter).toBe(1);
  expect(help('SELECT CONCAT(a # comma, ignored\n , ')?.activeParameter).toBe(1);
  expect(help("SELECT CONCAT('literal(")).toBeNull();
  expect(help('SELECT CONCAT(a, -- comment(')).toBeNull();
});

test('syntactic delimiters select CAST/EXTRACT/POSITION arguments correctly', () => {
  expect(help('SELECT CAST(amount AS ')?.activeParameter).toBe(1);
  expect(help('SELECT CAST(amount AS ')?.signature).toBe('CAST(expression AS type)');
  expect(help('SELECT EXTRACT(YEAR FROM ', 'postgres')?.activeParameter).toBe(1);
  expect(help('SELECT EXTRACT(YEAR FROM ', 'postgres')?.signature).toBe('EXTRACT(unit FROM date)');
  expect(help('SELECT POSITION(value IN ')?.activeParameter).toBe(1);
});

test('unknown/qualified calls and statement boundaries never borrow a built-in signature', () => {
  expect(help('SELECT UNKNOWN_FUNCTION(')).toBeNull();
  expect(help('SELECT schema.COUNT(')).toBeNull();
  expect(help('SELECT schema. /* scope */ COUNT(')).toBeNull();
  expect(help('SELECT COUNT(; SELECT 1')).toBeNull();
  expect(sqlFunctionAtPosition('SELECT count FROM records', 10, 'mysql')).toBeNull();
  expect(sqlFunctionAtPosition('SELECT COUNT(value)', 10, 'mysql')?.definition.name).toBe('COUNT');
  expect(sqlFunctionAtPosition("SELECT 'COUNT(value)'", 11, 'mysql')).toBeNull();
});

test('generated templates respect function/keyword case and actual native call grammar', () => {
  const mysql = sqlFunctionRegistry('mysql');
  expect(
    sqlFunctionTemplate(mysql.get('DATE_ADD')!, 'mysql', {
      functionCase: 'lower',
      keywordCase: 'lower',
    }),
  ).toBe('date_add(${date}, interval ${expr} ${unit})');
  expect(sqlFunctionTemplate(mysql.get('POSITION')!, 'mysql', { keywordCase: 'lower' })).toBe(
    'POSITION(${substring} in ${string})',
  );
  expect(sqlFunctionTemplate(mysql.get('CAST')!, 'mysql')).toBe('CAST(${expression} AS ${type})');
  expect(sqlFunctionTemplate(mysql.get('EXTRACT')!, 'mysql')).toBe('EXTRACT(${unit} FROM ${date})');
  expect(sqlFunctionTemplate(mysql.get('DATE_ADD')!, 'mysql', {}, true)).toBe('DATE_ADD');
  expect(sqlFunctionTemplate(mysql.get('LAG')!, 'mysql')).toBe(
    'LAG(${expression}, ${offset}, ${default_value}) OVER (PARTITION BY ${partition_column} ORDER BY ${order_column})',
  );
});

test('completion inserts navigable parameter fields and does not duplicate existing parentheses', () => {
  const entry = buildFunctionSnippetItems('DATE_ADD', 'mysql')[0];
  let state = EditorState.create({ doc: 'SELECT DATE_A' });
  const editor = {
    get state() {
      return state;
    },
    dispatch(transaction: Transaction) {
      state = transaction.state;
    },
  };
  if (typeof entry.apply !== 'function')
    throw new Error('Function completion must insert snippet fields');
  entry.apply(editor as never, entry, 7, state.doc.length);
  expect(state.doc.toString()).toBe('SELECT DATE_ADD(date, INTERVAL expr unit)');
  expect(state.sliceDoc(state.selection.main.from, state.selection.main.to)).toBe('date');
  const existing = buildFunctionSnippetItems('DATE_ADD', 'mysql', {}, true)[0];
  state = EditorState.create({ doc: 'SELECT DATE_A(value)' });
  if (typeof existing.apply !== 'function')
    throw new Error('Function completion must retain the existing call');
  existing.apply(editor as never, existing, 7, 13);
  expect(state.doc.toString()).toBe('SELECT DATE_ADD(value)');
});

test('completion callback sees current settings and suppresses strings/qualifiers/table contexts', async () => {
  let settings = { functionCase: 'lower' as 'lower' | 'upper', keywordCase: 'lower' as const };
  const source = sqlFunctionCompletion('mysql', () => settings);
  expect((await source(context('SELECT DATE_A|')))?.options[0].label).toBe('date_add');
  settings = { ...settings, functionCase: 'upper' };
  expect((await source(context('SELECT DATE_A|')))?.options[0].label).toBe('DATE_ADD');
  expect(await source(context("SELECT 'DATE_A|'"))).toBeNull();
  expect(await source(context('SELECT table.DATE_A|'))).toBeNull();
  expect(await source(context('SELECT * FROM DATE_A|'))).toBeNull();
});

test('huge documents skip every helper before lexing without changing their text', async () => {
  const source = 'x'.repeat(MAX_SQL_ASSISTANCE_DOCUMENT_CHARS + 1) + ' SELECT DATE_ADD(';
  expect(getSqlFunctionSignatureHelp(source, source.length, 'mysql')).toBeNull();
  expect(sqlFunctionAtPosition(source, source.length - 2, 'mysql')).toBeNull();
  const state = EditorState.create({ doc: source });
  expect(
    await sqlFunctionCompletion('mysql', () => ({}))(
      new CompletionContext(state, state.doc.length, true),
    ),
  ).toBeNull();
  expect(state.doc.length).toBe(source.length);
});
