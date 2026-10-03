import { expect, test } from 'bun:test';
import type { DatabaseCell } from '@fouc/shared';
import { parseExplainResult } from './parse-plan';
import { buildPlanCanvas, categorizePlanNode, edgeStrokeWidth, parsePlanNumber } from './plan-canvas';
import { flattenExplainPlanNodes } from './types';
import { planDetailEntries, planNodeMatches } from './plan-presentation';

const json = (value: unknown) => ({ columns: ['QUERY PLAN'], rows: [[JSON.stringify(value)]] });

test('PostgreSQL retains native topology, zero values, estimates and unknown attributes', () => {
  const plan = parseExplainResult('postgres', json([{ Plan: { 'Node Type': 'Sort', 'Startup Cost': 0, 'Total Cost': 15, 'Plan Rows': 0, 'Sort Key': ['name'], Plans: [{ 'Node Type': 'Index Scan', 'Relation Name': 'people', 'Index Name': 'people_pkey', 'Startup Cost': 0, 'Total Cost': 10, 'Plan Rows': 0, 'Plan Width': 8, Filter: "uri = 'https://example.com:a'", 'Unknown Extension Flag': true }] } }]));
  expect(plan.nodes[0].cost).toBe('0..15'); expect(plan.nodes[0].rows).toBe('0');
  const child = plan.nodes[0].children[0]; expect(child.index).toBe('people_pkey'); expect(child.width).toBe('8');
  expect(child.details).toContain('Unknown Extension Flag: true');
  expect(planDetailEntries(child).find((entry) => entry.label === 'Filter')?.value).toBe("uri = 'https://example.com:a'");
  const layout = buildPlanCanvas(plan.nodes);
  expect(layout.nodes[0].costShare).toBeCloseTo(1 / 3); expect(layout.nodes[1].costShare).toBeCloseTo(2 / 3);
  expect(layout.edges).toHaveLength(1); expect(layout.edges[0].rows).toBe(0);
  expect(layout.width).toBeGreaterThan(layout.nodes[1].x); expect(layout.height).toBeGreaterThan(layout.nodes[1].y);
});

test('MySQL JSON preserves join and subquery operations, select_id is not a row estimate', () => {
  const plan = parseExplainResult('mysql', json({ query_block: { select_id: 8, cost_info: { query_cost: '20.0' }, ordering_operation: { using_filesort: true, nested_loop: [{ table: { table_name: 'a', access_type: 'ALL', rows_examined_per_scan: 20, cost_info: { read_cost: '3.0' } } }, { table: { table_name: 'b', access_type: 'eq_ref', key: 'PRIMARY', rows_examined_per_scan: 1, cost_info: { read_cost: '7.0' }, attached_condition: 'b.id = a.id' } }] } } }));
  expect(plan.nodes[0].rows).toBeUndefined(); expect(plan.nodes[0].cost).toBe('20.0');
  const nodes = flattenExplainPlanNodes(plan.nodes);
  expect(nodes.map((node) => node.nodeType)).toEqual(['query_block', 'ordering_operation', 'Nested Loop', 'ALL', 'eq_ref']);
  expect(nodes.at(-1)?.index).toBe('PRIMARY'); expect(planNodeMatches(nodes.at(-1)!, 'b.id')).toBe(true);
  expect(categorizePlanNode('eq_ref')).toBe('lookup'); expect(categorizePlanNode('ALL')).toBe('tscan');
  expect(buildPlanCanvas(plan.nodes).nodes.reduce((sum, node) => sum + (node.costShare ?? 0), 0)).toBeCloseTo(1);
  const standard = parseExplainResult('mysql', { columns: ['id', 'select_type', 'table', 'type', 'key', 'rows', 'Extra'], rows: [[1, 'SIMPLE', 'b', 'range', 'PRIMARY', 3, 'Using where']] });
  expect(standard.format).toBe('table'); expect(standard.nodes[0].rows).toBe('3'); expect(standard.nodes[0].cost).toBeUndefined();
});

test('SQLite physical parent IDs build a tree without fabricated cost or rows and malformed cycles stay bounded', () => {
  const plan = parseExplainResult('sqlite', { columns: ['id', 'parent', 'notused', 'detail'], rows: [[2, 0, 0, 'CO-ROUTINE q'], [3, 2, 0, 'SEARCH people USING COVERING INDEX people_name (name=?)'], [8, 0, 0, 'USE TEMP B-TREE FOR ORDER BY']] });
  expect(plan.nodes).toHaveLength(2); expect(plan.nodes[0].children[0].relation).toBe('people');
  expect(plan.nodes[0].children[0].index).toBe('people_name');
  expect(flattenExplainPlanNodes(plan.nodes).every((node) => node.cost === undefined && node.rows === undefined)).toBe(true);
  expect(categorizePlanNode(plan.nodes[1].nodeType)).toBe('sort');
  const cycle = parseExplainResult('sqlite', { columns: ['id', 'parent', 'detail'], rows: [[1, 2, 'SCAN a'], [2, 1, 'SCAN b']] });
  expect(cycle.nodes).toHaveLength(2); expect(cycle.warnings).toHaveLength(1);
  expect(buildPlanCanvas(cycle.nodes).nodes).toHaveLength(2);
});

test('unrecognized/malformed plans preserve raw output and recursive/large plans stop before excessive parsing', () => {
  const malformed = parseExplainResult('postgres', { columns: ['QUERY PLAN'], rows: [['not JSON']] });
  expect(malformed.raw).toBe('not JSON'); expect(malformed.nodes).toEqual([]); expect(malformed.warnings).toHaveLength(1);
  const unknown = parseExplainResult('mysql', json({ new_engine_shape: { marker: 1 } }));
  expect(unknown.raw).toEqual({ new_engine_shape: { marker: 1 } }); expect(unknown.warnings).toHaveLength(1);
  const large = parseExplainResult('postgres', { columns: ['QUERY PLAN'], rows: [[' '.repeat(4 * 1024 * 1024 + 1)]] });
  expect(large.nodes).toEqual([]); expect(large.warnings[0]).toContain('4 MiB');
  let root: Record<string, DatabaseCell> = { 'Node Type': 'Result' };
  for (let depth = 0; depth < 90; depth++) root = { 'Node Type': 'Result', Plans: [root] };
  const deep = parseExplainResult('postgres', json([{ Plan: root }]));
  expect(flattenExplainPlanNodes(deep.nodes).length).toBeLessThanOrEqual(65); expect(deep.warnings).toHaveLength(1);
  expect(parsePlanNumber('0.29..1830.12')).toBe(1830.12); expect(parsePlanNumber('0')).toBe(0);
  expect(parsePlanNumber('not supplied')).toBeUndefined(); expect(edgeStrokeWidth(undefined)).toBe(1.6); expect(edgeStrokeWidth(1e20)).toBe(8);
});
