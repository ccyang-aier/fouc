import { expect, test } from 'bun:test'
import { sqlResultLabel, sqlResultTabLabel } from './sql-result-label'

test('uses actual qualified source names and does not read FROM inside values or comments', () => {
  expect(sqlResultLabel('SELECT * FROM "customers"', 'sqlite', 'main', '结果 1')).toBe('main.customers')
  expect(sqlResultLabel('SELECT \'FROM wrong\' FROM "other"."customers" -- FROM fake', 'sqlite', 'main', '结果 1')).toBe('other.customers')
  expect(sqlResultLabel('SELECT 1 AS result', 'sqlite', 'main', '结果 1')).toBe('结果 1')
})
test('does not imply a single-table result for joins or CTEs', () => {
  expect(sqlResultLabel('SELECT * FROM customers c JOIN orders o ON c.id=o.customer_id', 'sqlite', 'main', '结果 2')).toBe('结果 2')
  expect(sqlResultLabel('WITH c AS (SELECT * FROM customers) SELECT * FROM c', 'sqlite', 'main', '结果 2')).toBe('结果 2')
})
test('duplicate result titles are numbered without changing their source label', () => {
  expect(sqlResultTabLabel('main.customers', [])).toBe('main.customers')
  expect(sqlResultTabLabel('main.customers', ['main.customers', 'main.orders', 'main.customers'])).toBe('main.customers (3)')
})
