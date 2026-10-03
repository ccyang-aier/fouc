import { expect, test } from 'bun:test';
import { maskSqlReadDeclarations } from './sql-read-structure';

test('structural CTE declarations preserve offsets, comments, bodies and actual function calls', () => {
  const source='WITH a\n( "dé列" /* keep */ ,name ) AS (SELECT custom_udf()), b(x) AS (WITH c(y) AS (SELECT 1) SELECT y FROM c) SELECT a.name FROM a';
  const masked=maskSqlReadDeclarations(source, 'postgres');
  expect(masked.length).toBe(source.length);
  expect(masked).toContain('(SELECT custom_udf())');
  expect(masked).toContain('/* keep */');
  expect(masked).toContain('a\n  "dé列"');
  expect(masked).toContain('b x) AS');
  expect(masked).toContain('WITH c y) AS');
  expect(maskSqlReadDeclarations("SELECT 'WITH c(x) AS (SELECT 1)'", 'postgres')).toBe("SELECT 'WITH c(x) AS (SELECT 1)'");
  for(const sql of ['WITH c(custom_udf()) AS (SELECT 1) SELECT * FROM c','WITH c(1) AS (SELECT 1) SELECT * FROM c','WITH c(x) AS SELECT 1','WITH c(x) AS (SELECT 1']) expect(maskSqlReadDeclarations(sql,'postgres')).toBe(sql);
});
