import { describe, expect, test } from 'bun:test';
import { mysqlQueryAtCursor, mysqlQueryRanges } from '@fouc/shared';

describe('MySQL query ranges adapted from DBX', () => {
  test('splits only top-level delimiters and preserves document offsets', () => {
    const sql = "\nSELECT 'a;b' AS value;\n/* hint; */ SELECT `a;b` FROM t; # trailing;\n";
    const ranges = mysqlQueryRanges(sql);
    expect(ranges.map((range) => range.sql)).toEqual([
      "SELECT 'a;b' AS value",
      '/* hint; */ SELECT `a;b` FROM t',
    ]);
    for (const range of ranges) expect(sql.slice(range.from, range.to)).toBe(range.sql);
  });

  test('supports doubled quotes, escaped quotes and cursor placement between statements', () => {
    const sql = "SELECT 'it''s; ok';\nSELECT 'a\\'b; still string';\nSELECT 3;";
    expect(mysqlQueryRanges(sql)).toHaveLength(3);
    expect(mysqlQueryAtCursor(sql, sql.indexOf('SELECT 3'))?.sql).toBe('SELECT 3');
    expect(mysqlQueryAtCursor(sql, sql.length)?.sql).toBe('SELECT 3');
    expect(mysqlQueryRanges('SELECT 1; -- comment only')).toHaveLength(1);
  });
});
