import { describe, expect, test } from 'bun:test';
import { assertRelationalReadSql, quoteRelationalIdentifier } from './relational-sql';

describe('DBX relational read preflight', () => {
  test('retains quoted semicolons, CTEs and PostgreSQL dollar literals', () => {
    for (const sql of [
      "SELECT ';'",
      'WITH a AS (SELECT 1) SELECT * FROM a;',
      'SELECT $tag$; DELETE FROM x;$tag$',
      '/* outer /* inner */ comment */ SELECT 1',
      "SELECT E'\\\';still literal'",
    ])
      expect(() => assertRelationalReadSql(sql)).not.toThrow();
  });
  test('rejects transaction escapes, writable CTEs, INTO and multiple statements', () => {
    for (const sql of [
      'SELECT 1; COMMIT; DELETE FROM x',
      'WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x',
      'SELECT * INTO x FROM y',
      'EXPLAIN ANALYZE SELECT 1',
      "SELECT '\\'; COMMIT; SELECT 'x'",
      'SELECT name$tag$; COMMIT; SELECT $tag$',
    ])
      expect(() => assertRelationalReadSql(sql)).toThrow();
  });
  test('matches SQLite string and comment semantics and rejects ATTACH', () => {
    expect(assertRelationalReadSql("SELECT '\\'", 'sqlite')).toBe("SELECT '\\'");
    for (const sql of [
      "ATTACH DATABASE 'other.db' AS other",
      'PRAGMA query_only=OFF',
      '/* outer /* nested */ UPDATE x SET y=1 /* */',
    ])
      expect(() => assertRelationalReadSql(sql, 'sqlite')).toThrow();
  });
  test('does not mistake stateful functions or schema-qualified functions for pure reads', () => {
    for (const sql of [
      'SELECT pg_advisory_lock(1)',
      'SELECT pg_terminate_backend(123)',
      "SELECT pg_notify('channel','message')",
      "SELECT nextval('sequence')",
      'SELECT app.abs(1)',
      'SELECT "abs"(1)',
    ])
      expect(() => assertRelationalReadSql(sql)).toThrow();
    expect(() => assertRelationalReadSql('SELECT pg_catalog.abs(-1), count(*) FROM products')).not.toThrow();
  });
  test('quotes metadata names instead of interpreting them as SQL', () => {
    expect(quoteRelationalIdentifier('a"; DROP TABLE x;--')).toBe('"a""; DROP TABLE x;--"');
    expect(() => quoteRelationalIdentifier('x\0y')).toThrow();
  });
});
