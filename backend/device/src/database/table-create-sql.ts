import type { RelationalProvider } from '@fouc/shared';
import { tableCreateTypes, tableCreateTypeSql, validateTableCreateInput, type TableCreateColumn, type TableCreateInput, type TableCreateReview } from '@fouc/shared/table-create';
import { structureSqlLiteral } from '@fouc/shared/relational-structure-edit';

function quote(value: string, provider: RelationalProvider): string {
  const mark = provider === 'mysql' ? '`' : '"';
  return mark + value.replaceAll(mark, mark + mark) + mark;
}
function hex(value: string): string { return Buffer.from(value, 'utf8').toString('hex'); }
function defaultSql(column: TableCreateColumn, provider: RelationalProvider): string | null {
  const value = column.default;
  if (value.kind === 'none') return null;
  if (value.kind === 'null') return 'NULL';
  if (value.kind === 'function') return provider === 'mysql' && value.value === 'CURRENT_DATE' ? '(CURRENT_DATE)' : value.value;
  const family = tableCreateTypes[provider].find(item => item.name === column.type)!.family;
  if (['integer', 'decimal', 'float'].includes(family)) return value.value;
  if (family === 'boolean') return value.value.toUpperCase();
  if (family === 'binary') return provider === 'postgres' ? `pg_catalog.decode('${value.value}', 'hex')` : `X'${value.value}'`;
  let text = value.value;
  if (family === 'datetime' && column.type !== 'TIMESTAMP WITH TIME ZONE') text = text.replace('T', ' ').replace(/Z$/, '');
  // MySQL hex character literals preserve quotes, backslashes and Unicode independently
  // of NO_BACKSLASH_ESCAPES, avoiding changes to another operation's session SQL_MODE.
  return provider === 'mysql' ? `_utf8mb4 X'${hex(text)}'` : structureSqlLiteral(text, provider);
}

/** Adapted DBX create_table / column_format: a single native CREATE with inline constraints. */
export function buildTableCreateReview(provider: RelationalProvider, value: unknown): { input: TableCreateInput; review: TableCreateReview } {
  const input = validateTableCreateInput(provider, value);
  const primary = input.columns.filter(column => column.primaryKey);
  const definitions = input.columns.map(column => {
    const parts = [quote(column.name, provider), tableCreateTypeSql(column)];
    if (column.identity === 'auto' && provider === 'sqlite') parts.push('PRIMARY KEY AUTOINCREMENT');
    if (column.identity === 'auto' && provider === 'mysql') parts.push('AUTO_INCREMENT');
    if (column.identity === 'by-default' || column.identity === 'always') parts.push(`GENERATED ${column.identity === 'always' ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY`);
    if (!column.nullable) parts.push('NOT NULL');
    else if (provider === 'mysql' && column.type === 'TIMESTAMP') parts.push('NULL');
    const literal = defaultSql(column, provider);
    if (literal !== null) parts.push(`DEFAULT ${literal}`);
    if (column.unique && !(primary.length === 1 && column.primaryKey)) parts.push('UNIQUE');
    return '  ' + parts.join(' ');
  });
  if (primary.length && !input.columns.some(column => provider === 'sqlite' && column.identity === 'auto')) definitions.push(`  PRIMARY KEY (${primary.map(column => quote(column.name, provider)).join(', ')})`);
  const sql = `CREATE TABLE ${quote(input.schema, provider)}.${quote(input.table, provider)} (\n${definitions.join(',\n')}\n)${provider === 'mysql' ? ' ENGINE=InnoDB' : ''};`;
  const warnings = [
    '仅创建空表及配置中的主键 / 单字段唯一约束，不导入数据或修改已有对象。',
    '外键、计算生成列、CHECK、分区、表注释与独立复合索引尚不包含在本建表设计器。',
  ];
  if (!primary.length) warnings.push('未设置主键；后续精确行编辑与稳定分页可能受限。');
  if (input.columns.some(column => column.unique && column.nullable)) warnings.push('可空唯一字段按数据库原生语义处理，通常允许多个 NULL。');
  if (provider === 'mysql') {
    warnings.push('MySQL CREATE TABLE 隐式提交，不能通过事务撤销；连接中断后需刷新目录核对。字符集与校对规则继承目标数据库。');
    if (input.columns.some(column => column.type === 'TIMESTAMP' && column.default.kind === 'literal')) warnings.push('TIMESTAMP 默认字面量按输入的 UTC 墙上时间生成，使用 MySQL 原生会话时区解释；如需执行时的当前时间请选择 CURRENT_TIMESTAMP。');
  }
  if (provider === 'sqlite') warnings.push('SQLite 使用原生类型亲和性；NUMERIC / REAL 可能转换并舍入数值。INTEGER 单字段主键具有 rowid 自动编号语义。');
  if (provider === 'postgres') warnings.push('Identity 不自动提供唯一性；请明确选择主键或唯一约束。TIMESTAMP 无时区默认字面量按输入 UTC 墙上时间保存。');
  return { input, review: { provider, schema: input.schema, table: input.table, sql, columns: structuredClone(input.columns), warnings, transaction: provider === 'mysql' ? 'implicit-commit' : 'atomic' } };
}
