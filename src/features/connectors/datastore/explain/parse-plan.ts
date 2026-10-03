import type { DatabaseQueryResult, RelationalProvider } from '@fouc/shared';
import type { ExplainPlanNode, ParsedExplainPlan } from './types';

const MAX_PLAN_NODES = 2048;
const MAX_PLAN_DEPTH = 64;
const MAX_JSON_PLAN_LENGTH = 4 * 1024 * 1024;
type PlanBudget = { remaining: number; warnings: string[] };

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function arrayValue(value: unknown): unknown[] | null { return Array.isArray(value) ? value : null; }
function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined;
}
function numberLike(value: unknown): string | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' && value.trim() ? value : undefined;
}
function warning(budget: PlanBudget, message: string): void { if (!budget.warnings.includes(message)) budget.warnings.push(message); }
function claim(budget: PlanBudget, depth: number): boolean {
  if (depth > MAX_PLAN_DEPTH || budget.remaining-- <= 0) {
    warning(budget, `计划结构超过 ${MAX_PLAN_DEPTH} 层或 ${MAX_PLAN_NODES} 个节点；可在原始计划中查看完整返回内容。`);
    return false;
  }
  return true;
}

function nativeDetails(value: Record<string, unknown>, omit: readonly string[]): string[] {
  return Object.entries(value).filter(([key, item]) => !omit.includes(key) && item !== null && item !== undefined && typeof item !== 'object').map(([key, item]) => `${key}: ${String(item)}`);
}

/** DBX PostgreSQL JSON plan recursion; ANALYZE metrics are absent from the Fouc estimated-only path. */
function parsePostgresNode(plan: Record<string, unknown> | null, id: string, budget: PlanBudget, depth = 0): ExplainPlanNode | null {
  if (!plan || !claim(budget, depth)) return null;
  const nodeType = stringValue(plan['Node Type']) || 'Unknown operator';
  const relation = stringValue(plan['Relation Name']);
  const index = stringValue(plan['Index Name']);
  const startupCost = numberLike(plan['Startup Cost']);
  const totalCost = numberLike(plan['Total Cost']);
  const filter = stringValue(plan.Filter);
  const joinType = stringValue(plan['Join Type']);
  const sortKey = arrayValue(plan['Sort Key'])?.map(String).join(', ');
  const children = arrayValue(plan.Plans)?.map((child, position) => parsePostgresNode(objectValue(child), `${id}.${position}`, budget, depth + 1)).filter((node): node is ExplainPlanNode => !!node) ?? [];
  return {
    id, title: relation ? `${nodeType} on ${relation}` : nodeType, nodeType, relation, index,
    cost: startupCost !== undefined && totalCost !== undefined ? `${startupCost}..${totalCost}` : totalCost,
    rows: numberLike(plan['Plan Rows']), width: numberLike(plan['Plan Width']),
    details: [
      joinType ? `Join: ${joinType}` : '', filter ? `Filter: ${filter}` : '', sortKey ? `Sort: ${sortKey}` : '',
      ...nativeDetails(plan, ['Node Type', 'Relation Name', 'Index Name', 'Startup Cost', 'Total Cost', 'Plan Rows', 'Plan Width', 'Filter', 'Join Type', 'Sort Key']),
    ].filter(Boolean), children,
  };
}

function parsePostgresExplain(raw: unknown, budget: PlanBudget): ExplainPlanNode[] {
  return (Array.isArray(raw) ? raw : [raw]).map((item, position) => {
    const root = objectValue(item);
    if (!root) return null;
    const plan = objectValue(root.Plan) ?? (typeof root['Node Type'] === 'string' ? root : null);
    if (!plan) return null;
    const node = parsePostgresNode(plan, String(position), budget);
    if (node && numberLike(root['Planning Time']) !== undefined) node.details.push(`Planning Time: ${numberLike(root['Planning Time'])} ms`);
    return node;
  }).filter((node): node is ExplainPlanNode => !!node);
}

/** DBX MySQL query-block operations, preserving nested-loop and materialized-subquery structure. */
function parseMysqlBlock(block: Record<string, unknown>, id: string, nodeType: string, budget: PlanBudget, depth = 0): ExplainPlanNode | null {
  if (!claim(budget, depth)) return null;
  const costInfo = objectValue(block.cost_info);
  const children: ExplainPlanNode[] = [];
  const add = (value: Record<string, unknown>, kind: string) => {
    const childId = `${id}.${children.length}`;
    const child = kind === 'table' ? parseMysqlTable(value, childId, budget, depth + 1) : parseMysqlBlock(value, childId, kind, budget, depth + 1);
    if (child) children.push(child);
  };
  const table = objectValue(block.table);
  if (table) add(table, 'table');
  const nestedLoop = arrayValue(block.nested_loop);
  if (nestedLoop) {
    const joinChildren: ExplainPlanNode[] = [];
    for (const item of nestedLoop) {
      const value = objectValue(item);
      if (!value) continue;
      const nestedTable = objectValue(value.table);
      const child = nestedTable ? parseMysqlTable(nestedTable, `${id}.${children.length}.${joinChildren.length}`, budget, depth + 2) : parseMysqlBlock(value, `${id}.${children.length}.${joinChildren.length}`, 'operation', budget, depth + 2);
      if (child) joinChildren.push(child);
    }
    if (joinChildren.length && claim(budget, depth + 1)) children.push({ id: `${id}.${children.length}`, title: 'Nested Loop', nodeType: 'Nested Loop', details: [], children: joinChildren });
  }
  for (const key of ['query_block', 'ordering_operation', 'grouping_operation', 'duplicates_removal', 'union_result', 'materialized_from_subquery', 'buffer_result', 'windowing']) {
    const child = objectValue(block[key]);
    if (child) add(child, key);
  }
  for (const key of ['query_specifications', 'attached_subqueries', 'optimized_away_subqueries', 'subqueries']) {
    for (const value of arrayValue(block[key]) ?? []) {
      const child = objectValue(value);
      if (child) add(child, key);
    }
  }
  return {
    id, title: nodeType, nodeType, cost: numberLike(costInfo?.query_cost),
    // select_id identifies a query block and is not an estimate of returned rows.
    details: [
      ...nativeDetails(block, []),
      ...nativeDetails(costInfo ?? {}, ['query_cost']),
      ...(['using_filesort', 'using_temporary_table'].filter((key) => block[key] === true).map((key) => key === 'using_filesort' ? 'Filesort: true' : 'Temporary table: true')),
    ], children,
  };
}

function parseMysqlTable(table: Record<string, unknown>, id: string, budget: PlanBudget, depth: number): ExplainPlanNode | null {
  if (!claim(budget, depth)) return null;
  const relation = stringValue(table.table_name);
  const accessType = stringValue(table.access_type) || 'table';
  const costInfo = objectValue(table.cost_info);
  const details = [
    stringValue(table.attached_condition) ? `Condition: ${stringValue(table.attached_condition)}` : '',
    arrayValue(table.used_columns)?.length ? `Columns: ${arrayValue(table.used_columns)!.map(String).join(', ')}` : '',
    table.using_index === true ? 'Using index' : '',
    ...nativeDetails(table, ['table_name', 'access_type', 'key', 'rows_examined_per_scan', 'rows_produced_per_join', 'attached_condition', 'using_index']),
    ...nativeDetails(costInfo ?? {}, []),
  ].filter(Boolean);
  const children: ExplainPlanNode[] = [];
  for (const key of ['materialized_from_subquery', 'attached_subqueries']) {
    const values = Array.isArray(table[key]) ? table[key] as unknown[] : [table[key]];
    for (const value of values) {
      const object = objectValue(value);
      const child = object && parseMysqlBlock(object, `${id}.${children.length}`, key, budget, depth + 1);
      if (child) children.push(child);
    }
  }
  return {
    id, title: relation ? `${accessType} on ${relation}` : accessType, nodeType: accessType, relation, index: stringValue(table.key),
    cost: numberLike(costInfo?.query_cost) ?? numberLike(costInfo?.read_cost) ?? numberLike(costInfo?.eval_cost),
    rows: numberLike(table.rows_examined_per_scan) ?? numberLike(table.rows_produced_per_join), details, children,
  };
}

function parseMysqlExplain(raw: unknown, budget: PlanBudget): ExplainPlanNode[] {
  const root = objectValue(raw);
  if (!root) return [];
  const block = objectValue(root.query_block) ?? root;
  if (!['query_block', 'table', 'nested_loop', 'ordering_operation', 'grouping_operation', 'message'].some((key) => key in root || key in block)) return [];
  const node = parseMysqlBlock(block, '0', 'query_block', budget);
  return node ? [node] : [];
}

function parseMysqlStandard(result: Pick<DatabaseQueryResult, 'columns' | 'rows'>, budget: PlanBudget): ExplainPlanNode[] {
  if (result.rows.length > MAX_PLAN_NODES) warning(budget, '计划表格超过 2048 个节点，原始计划中保留了完整返回内容。');
  const lookup = (row: unknown[], key: string) => row[result.columns.findIndex((column) => column.toLowerCase() === key)];
  return result.rows.slice(0, MAX_PLAN_NODES).map((row, position) => {
    const relation = stringValue(lookup(row, 'table'));
    const nodeType = stringValue(lookup(row, 'type')) ?? 'query_block';
    return { id: String(position), title: relation ? `${nodeType} on ${relation}` : nodeType, nodeType, relation,
      index: stringValue(lookup(row, 'key')), rows: numberLike(lookup(row, 'rows')), details: result.columns.map((column, index) => `${column}: ${stringValue(row[index]) ?? 'NULL'}`), children: [] };
  }).filter(() => claim(budget, 0));
}

/** SQLite's real id/parent/detail plan rows preserve physical topology; cost/rows remain unknown. */
function parseSqliteExplain(result: Pick<DatabaseQueryResult, 'columns' | 'rows'>, budget: PlanBudget): ExplainPlanNode[] {
  if (result.rows.length > MAX_PLAN_NODES) warning(budget, '计划表格超过 2048 个节点，原始计划中保留了完整返回内容。');
  const keys = result.columns.map((column) => column.toLowerCase());
  const idIndex = keys.indexOf('id'), parentIndex = keys.indexOf('parent'), detailIndex = keys.indexOf('detail');
  if (idIndex < 0 || parentIndex < 0 || detailIndex < 0) return [];
  const rows = result.rows.slice(0, MAX_PLAN_NODES).map((row, position) => {
    const detail = String(row[detailIndex] ?? '');
    const relation = /^(?:SCAN|SEARCH)\s+(.+?)(?:\s+USING\s+|$)/i.exec(detail)?.[1];
    const index = /USING\s+(?:COVERING\s+)?INDEX\s+([^\s(]+)/i.exec(detail)?.[1];
    const nodeType = /^(SCAN|SEARCH|MATERIALIZE|CO-ROUTINE|MULTI-INDEX OR|USE TEMP B-TREE)/i.exec(detail)?.[1] ?? 'Plan';
    const node: ExplainPlanNode = { id: `sqlite-${row[idIndex]}-${position}`, title: detail, nodeType, relation, index, details: [detail], children: [] };
    return { nativeId: String(row[idIndex]), parent: String(row[parentIndex]), node };
  });
  const parents = new Map(rows.map((item) => [item.nativeId, item]));
  const roots: ExplainPlanNode[] = [];
  for (const item of rows) {
    if (!claim(budget, 0)) break;
    let candidate = parents.get(item.parent);
    const seen = new Set([item.nativeId]);
    let cycle = false;
    while (candidate) {
      if (seen.has(candidate.nativeId)) { cycle = true; break; }
      seen.add(candidate.nativeId);
      if (seen.size > MAX_PLAN_DEPTH) { cycle = true; warning(budget, 'SQLite 计划层级超过 64 层，过深节点已单独呈现。'); break; }
      candidate = parents.get(candidate.parent);
    }
    const parent = parents.get(item.parent);
    if (parent && !cycle) parent.node.children.push(item.node);
    else roots.push(item.node);
    if (cycle && seen.size <= MAX_PLAN_DEPTH) warning(budget, 'SQLite 返回了循环的父节点标识，已将该节点单独呈现。');
  }
  return roots;
}

export function parseExplainResult(provider: RelationalProvider, result: Pick<DatabaseQueryResult, 'columns' | 'rows'>): ParsedExplainPlan {
  const budget: PlanBudget = { remaining: MAX_PLAN_NODES, warnings: [] };
  let raw: unknown = result.rows[0]?.[0];
  let format: ParsedExplainPlan['format'] = 'json';
  let nodes: ExplainPlanNode[];
  if (provider === 'sqlite') {
    raw = result.rows.map((row) => Object.fromEntries(result.columns.map((column, index) => [column, row[index] ?? null])));
    format = 'table';
    nodes = parseSqliteExplain(result, budget);
  } else if (provider === 'mysql' && result.columns.some((column) => column.toLowerCase() === 'select_type' || column.toLowerCase() === 'table')) {
    raw = result.rows.map((row) => Object.fromEntries(result.columns.map((column, index) => [column, row[index] ?? null])));
    format = 'table';
    nodes = parseMysqlStandard(result, budget);
  } else {
    if (typeof raw === 'string') {
      if (raw.length > MAX_JSON_PLAN_LENGTH) return { databaseType: provider, raw, format, nodes: [], warnings: ['JSON 计划超过 4 MiB，已跳过结构解析；原始返回内容已保留。'] };
      try { raw = JSON.parse(raw); }
      catch { return { databaseType: provider, raw, format, nodes: [], warnings: ['服务器没有返回可识别的 JSON 执行计划。原始返回内容已保留。'] }; }
    }
    nodes = provider === 'postgres' ? parsePostgresExplain(raw, budget) : parseMysqlExplain(raw, budget);
  }
  if (!nodes.length) warning(budget, '没有可识别的计划节点，可查看服务器返回的原始计划。');
  return { databaseType: provider, raw, format, nodes, warnings: budget.warnings };
}
