import { describe, expect, test } from 'bun:test';
import { assertMysqlReadOnlySql } from './mysql-read-only-sql';

describe('MySQL read-only preflight adapted from DBX', () => {
  test('accepts ordinary single-statement reads and ignores literal text', () => {
    for (const sql of [
      'SELECT 1',
      "SELECT 'DROP TABLE users' AS note, COUNT(*) FROM `users`",
      '/* ordinary comment */ SELECT id FROM users WHERE id IN (1, 2);',
      'WITH active AS (SELECT id FROM users) SELECT COUNT(*) FROM active',
      'SHOW CREATE TABLE users',
      'DESCRIBE users',
      'EXPLAIN SELECT * FROM users',
      'SELECT 1 AS `delete`',
    ]) expect(assertMysqlReadOnlySql(sql)).toBeTruthy();
  });

  test('rejects writes, extra statements and MySQL executable comments', () => {
    for (const sql of [
      'UPDATE users SET name = "changed"',
      'WITH x AS (DELETE FROM users) SELECT * FROM x',
      'SELECT * FROM users; DELETE FROM users',
      "SELECT * FROM users INTO OUTFILE '/tmp/export'",
      "SELECT 1 /*!50000 INTO OUTFILE '/tmp/export' */",
      "SELECT 1 /*M!100100 INTO OUTFILE '/tmp/export' */",
      'SELECT @x := 1',
      'SELECT * FROM users FOR UPDATE',
      'SELECT * FROM users LOCK IN SHARE MODE',
      'SELECT GET_LOCK("users", 1)',
      'SELECT custom_udf()',
      'SELECT `custom_udf`()',
      'SELECT "custom_udf"()',
      'EXPLAIN ANALYZE DELETE FROM users',
      "SELECT 'unterminated",
    ]) expect(() => assertMysqlReadOnlySql(sql)).toThrow();
  });
});
