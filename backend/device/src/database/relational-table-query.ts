import {
  RELATIONAL_FILTER_OPERATORS,
  type DatabaseCell,
  type DatabaseColumnInfo,
  type RelationalFilter,
  type RelationalProvider,
  type RelationalTableQuery,
} from '@fouc/shared';
import { DatabaseInputError } from './input-error';
import { canonicalCell, relationalParameter, validateCell } from './relational-values';
import type { RelationalDriver, SqlParameter } from './drivers/relational-driver';

export function tableQueryInput(value: unknown): RelationalTableQuery {
  if (!value || typeof value !== 'object') throw new DatabaseInputError('表查询参数无效');
  const raw = value as RelationalTableQuery;
  if (!Array.isArray(raw.sort) || raw.sort.length > 8 || JSON.stringify(value).length > 100_000)
    throw new DatabaseInputError('排序最多 8 个字段，查询条件不能超过 100 KB');
  return raw;
}
type CompiledQuery = {
  sql: string;
  parameters: SqlParameter[];
  displayParameters: DatabaseCell[];
  stableOrder: boolean;
};

/** DBX data_grid_sql.rs: typed context filters, NULL membership, ranges and stable pagination. */
export function compileTableQuery(
  provider: RelationalProvider,
  schema: string,
  table: string,
  columns: DatabaseColumnInfo[],
  query: RelationalTableQuery,
  offset: number,
  limit: number,
  quote: RelationalDriver['quoteIdentifier'],
): CompiledQuery {
  const parameters: SqlParameter[] = [];
  const displayParameters: DatabaseCell[] = [];
  const lookup = (name: string) => {
    const column = columns.find((column) => column.name === name);
    if (!column) throw new DatabaseInputError(`字段 ${String(name)} 不存在`);
    return column;
  };
  const bind = (value: unknown, column: DatabaseColumnInfo, text = false) => {
    validateCell(value);
    if (typeof value === 'string' && value.length > 16_000)
      throw new DatabaseInputError('单个筛选值不能超过 16,000 字符');
    parameters.push(text ? String(value) : relationalParameter(value, column, provider));
    displayParameters.push(value);
    const placeholder = provider === 'postgres' ? `$${parameters.length}` : '?';
    if (!text && /\bjsonb?\b/i.test(column.dataType))
      return provider === 'postgres'
        ? `${placeholder}::jsonb`
        : provider === 'mysql'
          ? `CAST(${placeholder} AS JSON)`
          : placeholder;
    return placeholder;
  };
  let conditionCount = 0;
  function condition(node: RelationalFilter, depth = 0): string {
    if (!node || typeof node !== 'object' || depth > 6 || ++conditionCount > 100)
      throw new DatabaseInputError('筛选最多 100 个节点、6 层分组');
    if (node.kind === 'group') {
      if (!['and', 'or'].includes(node.join) || !Array.isArray(node.children) || !node.children.length)
        throw new DatabaseInputError('条件分组需要 AND/OR 和至少一个条件');
      return (
        '(' +
        node.children
          .map((child) => condition(child, depth + 1))
          .join(node.join === 'and' ? ' AND ' : ' OR ') +
        ')'
      );
    }
    if (node.kind !== 'condition' || !RELATIONAL_FILTER_OPERATORS.includes(node.operator))
      throw new DatabaseInputError('筛选操作符无效');
    const column = lookup(node.column);
    const identifier = quote(column.name);
    const ref =
      provider === 'postgres' && /\bjsonb?\b/i.test(column.dataType) ? `${identifier}::jsonb` : identifier;
    const textRef = /char|text|clob|enum|set\(/i.test(column.dataType)
      ? identifier
      : `CAST(${identifier} AS ${provider === 'mysql' ? 'CHAR' : 'TEXT'})`;
    switch (node.operator) {
      case 'is-null':
        return `${ref} IS NULL`;
      case 'is-not-null':
        return `${ref} IS NOT NULL`;
      case 'is-blank':
        return `(${ref} IS NULL OR ${textRef} = '')`;
      case 'is-not-blank':
        return `(${ref} IS NOT NULL AND ${textRef} <> '')`;
      case 'equals':
      case 'not-equals':
        return node.value === null
          ? `${ref} IS ${node.operator === 'not-equals' ? 'NOT ' : ''}NULL`
          : `${ref} ${node.operator === 'equals' ? '=' : '<>'} ${bind(node.value, column)}`;
      case 'like':
      case 'not-like':
      case 'begins-with':
      case 'ends-with': {
        if (
          typeof node.value !== 'string' &&
          typeof node.value !== 'number' &&
          typeof node.value !== 'boolean'
        )
          throw new DatabaseInputError('文本筛选需要标量值');
        const pattern = `${node.operator === 'begins-with' ? '' : '%'}${String(node.value)}${node.operator === 'ends-with' ? '' : '%'}`;
        return `${textRef} ${node.operator === 'not-like' ? 'NOT LIKE' : 'LIKE'} ${bind(pattern, column, true)}`;
      }
      case 'in':
      case 'not-in': {
        if (!Array.isArray(node.values) || !node.values.length || node.values.length > 200)
          throw new DatabaseInputError('IN 列表须包含 1–200 个值');
        const seen = new Set<string>();
        const values = node.values.filter((value) => {
          validateCell(value);
          const key = canonicalCell(value);
          if (seen.has(key)) return false;
          seen.add(key);
          return value !== null;
        });
        const negated = node.operator === 'not-in';
        if (!values.length) return `${ref} IS ${negated ? 'NOT ' : ''}NULL`;
        const membership = `${ref} ${negated ? 'NOT IN' : 'IN'} (${values.map((value) => bind(value, column)).join(', ')})`;
        if (negated) return `(${ref} IS NOT NULL AND ${membership})`;
        return node.values.includes(null) ? `(${ref} IS NULL OR ${membership})` : membership;
      }
      case 'between':
      case 'not-between':
        if (node.value == null || node.endValue == null)
          throw new DatabaseInputError('区间筛选需要两个非空边界');
        return `${ref} ${node.operator === 'not-between' ? 'NOT BETWEEN' : 'BETWEEN'} ${bind(node.value, column)} AND ${bind(node.endValue, column)}`;
      default: {
        const operators = {
          'less-than': '<',
          'less-than-or-equal': '<=',
          'greater-than': '>',
          'greater-than-or-equal': '>=',
        };
        if (node.value === null) throw new DatabaseInputError('比较筛选不能使用 NULL，请选择为空 / 非空');
        return `${ref} ${operators[node.operator]} ${bind(node.value, column)}`;
      }
    }
  }
  const where = query.filter === null ? '' : ` WHERE ${condition(query.filter)}`;
  const order: string[] = [];
  const sorted = new Set<string>();
  for (const item of query.sort) {
    if (
      !item ||
      !['asc', 'desc'].includes(item.direction) ||
      !['first', 'last'].includes(item.nulls) ||
      sorted.has(item.column)
    )
      throw new DatabaseInputError('排序字段、方向或 NULL 位置无效，字段不能重复');
    const column = lookup(item.column);
    sorted.add(item.column);
    const name = quote(column.name);
    const direction = item.direction === 'asc' ? 'ASC' : 'DESC';
    if (provider === 'mysql')
      order.push(`(${name} IS NULL) ${item.nulls === 'first' ? 'DESC' : 'ASC'}`, `${name} ${direction}`);
    else order.push(`${name} ${direction} NULLS ${item.nulls === 'first' ? 'FIRST' : 'LAST'}`);
  }
  const primary = columns.filter((column) => column.isPrimaryKey);
  for (const column of primary) if (!sorted.has(column.name)) order.push(`${quote(column.name)} ASC`);
  return {
    sql: `SELECT * FROM ${quote(schema)}.${quote(table)}${where}${order.length ? ' ORDER BY ' + order.join(', ') : ''} LIMIT ${limit + 1} OFFSET ${offset}`,
    parameters,
    displayParameters,
    stableOrder: primary.length > 0,
  };
}
