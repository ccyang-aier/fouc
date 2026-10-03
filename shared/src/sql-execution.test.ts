import { expect, test } from 'bun:test';
import { resolveSqlExecutionTarget, splitSqlExecutionRanges, sqlExecutionRangeAtCursor } from './sql-execution';

test('native ranges preserve source offsets and provider quote/comment boundaries', () => {
  for (const provider of ['mysql', 'postgres', 'sqlite'] as const) {
    const source = " -- heading\nSELECT '中文; 😀' AS label;\n/* tail */ SELECT 2; -- empty";
    const ranges = splitSqlExecutionRanges(source, provider);
    expect(ranges).toHaveLength(2);
    expect(ranges.map((item) => source.slice(item.from, item.to))).toEqual(ranges.map((item) => item.sql));
    expect(splitSqlExecutionRanges('-- only comment\n; /* empty */', provider)).toEqual([]);
    expect(resolveSqlExecutionTarget(source, provider, 'all', { from: 0, to: 0, head: 0 })?.sql).toBe(source);
    const selection = { from: ranges[1].from, to: ranges[1].to, head: ranges[1].to };
    expect(resolveSqlExecutionTarget(source, provider, 'current', selection)).toEqual(ranges[1]);
  }
  expect(splitSqlExecutionRanges('SELECT $tag$a;b$tag$; SELECT E\'a\\\';b\'; SELECT 3', 'postgres')).toHaveLength(3);
  expect(splitSqlExecutionRanges('SELECT 1--2; SELECT 3 # ; ignored\n; SELECT 4', 'mysql')).toHaveLength(3);
  expect(splitSqlExecutionRanges('SELECT [a;b] FROM t; SELECT 2', 'sqlite')).toHaveLength(2);
  expect(splitSqlExecutionRanges('SELECT 1; /*! DROP TABLE x */', 'mysql')).toHaveLength(2);
});
test('cursor targets delimiters/end-of-line but never silently executes a different blank-line statement', () => {
  const source = 'SELECT 1;  \n\n  SELECT 2;   ';
  expect(sqlExecutionRangeAtCursor(source, 8, 'sqlite')?.sql).toBe('SELECT 1');
  expect(sqlExecutionRangeAtCursor(source, 10, 'sqlite')?.sql).toBe('SELECT 1');
  expect(sqlExecutionRangeAtCursor(source, 12, 'sqlite')).toBeNull();
  expect(sqlExecutionRangeAtCursor(source, 14, 'sqlite')?.sql).toBe('SELECT 2');
  expect(sqlExecutionRangeAtCursor(source, source.length, 'sqlite')?.sql).toBe('SELECT 2');
});
