import {
  ValidationError,
  type RelationalProvider,
  type RelationalTableStructure,
} from '@fouc/shared';
import {
  structureColumnFromMetadata,
  structureSqlLiteral,
  validateStructureDataType,
  validateStructureExpression,
  validateStructureIdentifier,
  type StructureColumn,
  type StructureColumnPatch,
  type StructureDefault,
  type StructureIndex,
} from '@fouc/shared/relational-structure-edit';

export function structureQuote(value: string, provider: RelationalProvider): string {
  const error = validateStructureIdentifier(value, provider);
  if (error) throw new ValidationError(error);
  const quote = provider === 'mysql' ? '`' : '"';
  return `${quote}${value.replaceAll(quote, quote + quote)}${quote}`;
}
export function structureTarget(structure: RelationalTableStructure): string {
  return `${structureQuote(structure.schema, structure.provider)}.${structureQuote(structure.table, structure.provider)}`;
}
export function structureDefaultSql(
  value: StructureDefault,
  provider: RelationalProvider,
  trusted = false,
): string | null {
  if (value.kind === 'none') return null;
  if (value.kind === 'null') return 'NULL';
  if (value.kind === 'text') {
    if (value.value.includes('\0')) throw new Error('DDL 文本默认值不能包含 NUL');
    return structureSqlLiteral(value.value, provider);
  }
  if (value.kind === 'boolean')
    return provider === 'sqlite' ? (value.value ? '1' : '0') : value.value ? 'TRUE' : 'FALSE';
  if (value.kind === 'number') {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.value))
      throw new Error('数字默认值格式不合法');
    return value.value;
  }
  if (!trusted) {
    const error = validateStructureExpression(value.value, provider, [], 'default');
    if (error) throw new ValidationError(error);
  }
  return provider === 'mysql' ? `(${value.value})` : value.value;
}
export function validateStructureColumn(
  column: StructureColumn,
  structure: RelationalTableStructure,
  names: string[],
  patch?: StructureColumnPatch,
): void {
  const provider = structure.provider;
  const checks = [
    validateStructureIdentifier(column.name, provider),
    !patch || patch.dataType !== undefined
      ? validateStructureDataType(
          column.dataType,
          provider,
          structure.properties.strict === 'true' || structure.properties.strict === '1',
        )
      : null,
  ];
  if (checks.some(Boolean)) throw new ValidationError(checks.find(Boolean)!);
  if (!patch || patch.default !== undefined) structureDefaultSql(column.default, provider);
  if (column.comment.includes('\0')) throw new Error('字段注释不能包含 NUL');
  if (column.generated && (!patch || patch.generated !== undefined)) {
    const error = validateStructureExpression(
      column.generated.expression,
      provider,
      names.filter((name) => name !== column.name),
      'generated',
    );
    if (error) throw new ValidationError(error);
    if (provider === 'postgres' && column.generated.storage !== 'stored')
      throw new Error('此编辑器只创建 PostgreSQL STORED 生成列');
  }
  if (column.generated && (column.identity || column.default.kind !== 'none'))
    throw new Error('生成列不能同时设置默认值或自增');
  if (column.identity) {
    if (
      column.nullable ||
      column.default.kind !== 'none' ||
      !/^(tinyint|smallint|mediumint|int|integer|bigint)(?:\b|$)/i.test(column.dataType)
    )
      throw new Error('自增 / Identity 必须为非空整数列且没有普通默认值');
    if (
      provider === 'sqlite' ||
      (provider === 'postgres' && column.identity.kind === 'auto-increment') ||
      (provider === 'mysql' && column.identity.kind !== 'auto-increment')
    )
      throw new Error('自增类型不适用于当前数据库');
    if (column.identity.kind !== 'auto-increment') {
      for (const value of [column.identity.start, column.identity.increment])
        if (
          value != null &&
          (BigInt(value) < -9223372036854775808n || BigInt(value) > 9223372036854775807n)
        )
          throw new Error('Identity 参数超出 int64 范围');
      if (column.identity.increment != null && BigInt(column.identity.increment) === 0n)
        throw new Error('Identity increment 不能为 0');
    }
  }
}
export function structureColumnDdl(
  column: StructureColumn,
  structure: RelationalTableStructure,
  originalName?: string,
  patch?: StructureColumnPatch,
): string {
  const provider = structure.provider,
    q = (value: string) => structureQuote(value, provider);
  const pieces = [q(column.name), column.dataType];
  const original = structure.columns.find((entry) => entry.name === originalName);
  if (
    provider === 'mysql' &&
    original &&
    /^(?:char|varchar|(?:tiny|medium|long)?text|enum|set)\b/i.test(column.dataType)
  ) {
    if (original.characterSet) pieces.push(`CHARACTER SET ${q(original.characterSet)}`);
    if (original.collation) pieces.push(`COLLATE ${q(original.collation)}`);
  }
  if (column.generated)
    pieces.push(
      `GENERATED ALWAYS AS (${column.generated.expression}) ${column.generated.storage.toUpperCase()}`,
    );
  else if (column.identity?.kind === 'auto-increment') pieces.push('AUTO_INCREMENT');
  else if (column.identity) {
    pieces.push(
      `GENERATED ${column.identity.kind === 'always' ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY`,
    );
    const settings = [
      column.identity.start != null ? `START WITH ${column.identity.start}` : '',
      column.identity.increment != null ? `INCREMENT BY ${column.identity.increment}` : '',
    ].filter(Boolean);
    if (settings.length) pieces.push(`(${settings.join(' ')})`);
  }
  pieces.push(column.nullable ? 'NULL' : 'NOT NULL');
  const defaultSql = structureDefaultSql(
    column.default,
    provider,
    Boolean(original && patch?.default === undefined),
  );
  if (defaultSql !== null)
    pieces.push(
      `DEFAULT ${provider === 'mysql' && /^(?:json|(?:tiny|medium|long)?(?:text|blob))\b/i.test(column.dataType) && column.default.kind !== 'expression' ? `(${defaultSql})` : defaultSql}`,
    );
  if (provider === 'mysql' && original) {
    const extra = (original.extra ?? '')
      .replace(/DEFAULT_GENERATED|AUTO_INCREMENT|(?:VIRTUAL|STORED) GENERATED/gi, '')
      .trim();
    if (extra) {
      if (!/^on update current_timestamp(?:\(\d?\))?$/i.test(extra))
        throw new Error(`字段 ${original.name} 含未支持的原生额外属性，不能重写`);
      pieces.push(extra);
    }
  }
  if (provider === 'mysql' && column.comment)
    pieces.push(`COMMENT ${structureSqlLiteral(column.comment, provider)}`);
  return pieces.join(' ');
}
export function structureIndexDdl(
  index: StructureIndex,
  structure: RelationalTableStructure,
  names: string[],
): string[] {
  const provider = structure.provider,
    q = (name: string) => structureQuote(name, provider),
    target = structureTarget(structure);
  const methods: Record<RelationalProvider, string[]> = {
    mysql: ['btree', 'hash', 'fulltext', 'spatial'],
    postgres: ['btree', 'hash', 'gin', 'gist', 'spgist', 'brin'],
    sqlite: ['btree'],
  };
  if (!methods[provider].includes(index.method)) throw new Error('索引方法不适用于当前数据库');
  if (index.unique && !['btree'].includes(index.method))
    throw new Error('此编辑器只创建 BTREE 唯一索引');
  if (provider !== 'postgres' && index.include.length) throw new Error('INCLUDE 仅支持 PostgreSQL');
  if (
    provider === 'postgres' &&
    index.include.length &&
    !['btree', 'gist', 'spgist'].includes(index.method)
  )
    throw new Error('此索引方法不支持 INCLUDE');
  if (provider === 'mysql' && index.predicate) throw new Error('MySQL 不支持条件索引');
  if (provider === 'sqlite' && index.comment) throw new Error('SQLite 没有原生索引注释');
  if (index.predicate) {
    const error = validateStructureExpression(index.predicate, provider, names, 'predicate');
    if (error) throw new ValidationError(error);
  }
  if (
    new Set(index.parts.map((part) => part.column)).size !== index.parts.length ||
    new Set(index.include).size !== index.include.length
  )
    throw new Error('索引字段不能重复');
  const parts = index.parts.map((part) => {
    if (!names.includes(part.column)) throw new Error(`索引字段 ${part.column} 不存在`);
    if (
      part.prefixLength &&
      (provider !== 'mysql' || ['fulltext', 'spatial'].includes(index.method))
    )
      throw new Error('索引前缀长度只支持 MySQL 普通索引');
    if (['fulltext', 'spatial'].includes(index.method) && part.descending)
      throw new Error('FULLTEXT / SPATIAL 不接受 DESC');
    return `${q(part.column)}${part.prefixLength ? `(${part.prefixLength})` : ''}${part.descending ? ' DESC' : ''}`;
  });
  for (const name of index.include)
    if (!names.includes(name) || index.parts.some((part) => part.column === name))
      throw new Error('INCLUDE 字段无效或与索引键重复');
  const modifier =
    provider === 'mysql' && ['fulltext', 'spatial'].includes(index.method)
      ? `${index.method.toUpperCase()} `
      : index.unique
        ? 'UNIQUE '
        : '';
  const indexName =
    provider === 'sqlite' ? `${q(structure.schema)}.${q(index.name)}` : q(index.name);
  let sql = `CREATE ${modifier}INDEX ${indexName} ON ${provider === 'sqlite' ? q(structure.table) : target}`;
  if (provider === 'postgres') sql += ` USING ${index.method}`;
  sql += ` (${parts.join(', ')})`;
  if (provider === 'mysql' && ['btree', 'hash'].includes(index.method))
    sql += ` USING ${index.method.toUpperCase()}`;
  if (index.include.length) sql += ` INCLUDE (${index.include.map(q).join(', ')})`;
  if (index.predicate) sql += ` WHERE ${index.predicate}`;
  if (provider === 'mysql' && index.comment)
    sql += ` COMMENT ${structureSqlLiteral(index.comment, provider)}`;
  return [
    sql,
    ...(provider === 'postgres' && index.comment
      ? [
          `COMMENT ON INDEX ${q(structure.schema)}.${q(index.name)} IS ${structureSqlLiteral(index.comment, provider)}`,
        ]
      : []),
  ];
}
export function originalStructureColumn(
  structure: RelationalTableStructure,
  name: string,
): StructureColumn {
  const original = structure.columns.find((column) => column.name === name);
  if (!original) throw new Error(`字段 ${name} 不存在`);
  return structureColumnFromMetadata(structure, original);
}
