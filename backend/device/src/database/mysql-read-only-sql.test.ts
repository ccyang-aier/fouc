import { describe, expect, test } from 'bun:test';
import { assertMysqlReadOnlySql } from './mysql-read-only-sql';

describe('MySQL read-only preflight adapted from DBX', () => {
  test('accepts ordinary single-statement reads and ignores literal text', () => {
    for (const sql of [
      'SELECT 1',
      "SELECT 'DROP TABLE users' AS note, COUNT(*) FROM `users`",
      '/* ordinary comment */ SELECT id FROM users WHERE id IN (1, 2);',
      'WITH active AS (SELECT id FROM users) SELECT COUNT(*) FROM active',
      'WITH sample(first_id, display_name) AS (SELECT id, name FROM users) SELECT * FROM sample',
      'WITH `sample`(`first_id`) AS (SELECT id FROM users) SELECT * FROM `sample`',
      'WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<3) SELECT * FROM seq',
      'SELECT d.name FROM users u CROSS JOIN LATERAL (SELECT u.name) d',
      'SELECT d.display_name FROM (SELECT name FROM users) d(display_name)',
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
      'SELECT 1--1 + GET_LOCK("users", 1)',
      'SELECT application.ABS(1)',
      'EXPLAIN ANALYZE DELETE FROM users',
      "SELECT 'unterminated",
      'WITH sample(x) AS (SELECT custom_udf()) SELECT * FROM sample',
      'WITH custom_udf(x) AS (SELECT 1) SELECT custom_udf()',
      'WITH sample(custom_udf()) AS (SELECT 1) SELECT * FROM sample',
      'WITH sample(x) AS (DELETE FROM users) SELECT * FROM sample',
      'WITH sample(x /*!50000 , DELETE */) AS (SELECT 1) SELECT * FROM sample',
      'WITH sample(x /*M!100100 , DELETE */) AS (SELECT 1) SELECT * FROM sample',
      'SELECT d.x FROM users u CROSS JOIN LATERAL (SELECT custom_udf()) d',
      'SELECT lateral(1)',
      'SELECT d.x FROM (SELECT custom_udf()) d(x)',
      'SELECT d.x FROM (SELECT 1) d(custom_udf())',
    ]) expect(() => assertMysqlReadOnlySql(sql)).toThrow();
  });
});
