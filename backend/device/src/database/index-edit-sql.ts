import { validateIndexEditInput, type IndexEditOptions, type IndexEditReview } from '@fouc/shared/index-edit';

/** Adapts DBX indexes.rs; only structured native columns are accepted, never arbitrary SQL. */
export function buildIndexEditReview(options: IndexEditOptions, value: unknown) {
  const input = validateIndexEditInput(options, value);
  const quote = (name: string) => options.provider === 'mysql' ? '`' + name.replaceAll('`', '``') + '`' : '"' + name.replaceAll('"', '""') + '"';
  const target = `${quote(input.schema)}.${quote(input.table)}`;
  const existing = input.operation === 'drop' ? options.structure.indexes.find(index => options.provider === 'postgres' ? index.name === input.name : index.name.toLowerCase() === input.name.toLowerCase())! : null;
  let sql: string;
  if (input.operation === 'drop') {
    sql = options.provider === 'mysql' ? `DROP INDEX ${quote(existing!.name)} ON ${target};` : `DROP INDEX ${quote(input.schema)}.${quote(existing!.name)};`;
  } else {
    const keys = input.columns.map(key => `${quote(key.column)}${key.prefix === null ? '' : `(${key.prefix})`} ${key.direction.toUpperCase()}`).join(', ');
    // SQLite qualifies the index namespace, not the ON table. PostgreSQL inherits the table namespace.
    const name = options.provider === 'sqlite' ? `${quote(input.schema)}.${quote(input.name)}` : quote(input.name);
    sql = `CREATE ${input.unique ? 'UNIQUE ' : ''}INDEX ${name} ON ${options.provider === 'sqlite' ? quote(input.table) : target} (${keys})`;
    if (input.include.length) sql += ` INCLUDE (${input.include.map(quote).join(', ')})`;
    if (input.nullsNotDistinct) sql += ' NULLS NOT DISTINCT';
    sql += ';';
  }
  const review: IndexEditReview = {
    provider: options.provider, operation: input.operation, schema: input.schema, table: input.table,
    index: existing?.name ?? input.name, sql, existing, transaction: options.provider === 'mysql' ? 'implicit-commit' : 'atomic',
    warnings: [...options.warnings, ...(input.operation === 'drop' ? ['删除索引不可撤销，可能降低查询性能；若为独立唯一索引，其唯一性约束同时移除。'] : input.unique ? ['唯一索引将校验全部现有键值；有重复值时原生服务器拒绝创建。'] : [])],
  };
  return { input, review };
}
