import type { DatabaseColumnInfo, RelationalTableStructure } from '@fouc/shared';
import { tableTransferTypeFamily } from '@fouc/shared/table-transfer';
import { DatabaseInputError } from './input-error';
import {
  expressionColumns,
  renderMutationExpression,
  type MutationExpression,
  type ParsedSqlMutation,
} from './sql-mutation-parser';

export interface MutationProjection {
  oldIndexes: number[];
  changes: { column: number; castIndex: number; rawIndex: number }[];
  countIndex: number;
}

export interface CompiledSqlMutation {
  ast: ParsedSqlMutation;
  writeSql: string;
  previewSql: string;
  countSql: string;
  lockSql: string;
  afterSql: string;
  projection: MutationProjection;
  keyIndexes: number[];
  generated: Set<number>;
}

const fail = (message: string): never => { throw new DatabaseInputError(`无法准确预览：${message}`); };
const generated = (column: DatabaseColumnInfo) => /\bgenerated\b/i.test(column.extra ?? '');

export function compileSqlMutation(
  ast: ParsedSqlMutation,
  structure: RelationalTableStructure,
  quote: (name: string) => string,
  maxRows: number,
): CompiledSqlMutation {
  const { columns, provider } = structure;
  if (!columns.length || columns.length > 200) fail('目标必须包含 1–200 个可读取字段');
  const find = (name: string) => {
    const index = columns.findIndex((column) => provider === 'postgres' ? column.name === name : column.name.toLowerCase() === name.toLowerCase());
    if (index < 0) fail(`字段 ${name} 不存在`);
    return index;
  };
  const resolve = (expression: MutationExpression): MutationExpression => {
    switch (expression.kind) {
      case 'literal': return expression;
      case 'column': return { ...expression, name: columns[find(expression.name)].name };
      case 'unary': return { ...expression, value: resolve(expression.value) };
      case 'binary': return { ...expression, left: resolve(expression.left), right: resolve(expression.right) };
      case 'list': return { ...expression, values: expression.values.map(resolve) };
      case 'between': return { ...expression, value: resolve(expression.value), lower: resolve(expression.lower), upper: resolve(expression.upper) };
    }
  };
  ast = {
    ...ast,
    assignments: ast.assignments.map((assignment) => ({ column: columns[find(assignment.column)].name, expression: resolve(assignment.expression) })),
    insertColumns: ast.insertColumns.map((column) => columns[find(column)].name),
    where: ast.where && resolve(ast.where),
  };
  if (new Set(ast.insertColumns).size !== ast.insertColumns.length || new Set(ast.assignments.map((item) => item.column)).size !== ast.assignments.length) fail('字段在原生大小写解析后发生重复');
  const assigned = new Set(ast.assignments.map((item) => item.column));
  for (const assignment of ast.assignments) {
    if (expressionColumns(assignment.expression).some((name) => name !== assignment.column && assigned.has(name))) fail('赋值引用了本次其他被修改字段');
  }
  for (const column of columns) {
    if (tableTransferTypeFamily(column.dataType, provider) === 'other') fail(`字段 ${column.name} 的自定义或复杂原生类型无法证明安全`);
    if (provider === 'postgres' && /\[\]$/.test(column.dataType) && !/^(?:smallint|integer|bigint|numeric(?:\([^)]*\))?|real|double precision|boolean|text|character varying(?:\(\d+\))?|bytea|date|timestamp(?: without time zone)?)(?:\[\])+$/i.test(column.dataType)) fail(`数组字段 ${column.name} 的元素类型未受支持`);
  }
  const keyIndexes = columns.flatMap((column, index) => column.isPrimaryKey ? [index] : []);
  if (ast.operation !== 'insert' && !keyIndexes.length) fail('UPDATE / DELETE 要求真实主键以比对目标集合');
  const protectedNames = new Set([
    ...keyIndexes.map((index) => columns[index].name),
    ...structure.constraints.filter((constraint) => ['primary', 'unique'].includes(constraint.kind)).flatMap((constraint) => constraint.columns),
    ...structure.indexes.filter((index) => index.unique).flatMap((index) => index.parts.flatMap((part) => part.column ? [part.column] : [])),
  ]);
  const generatedIndexes = new Set(columns.flatMap((column, index) => generated(column) || /on update/i.test(column.extra ?? '') ? [index] : []));
  const changedColumns = ast.operation === 'insert' ? ast.insertColumns : ast.assignments.map((item) => item.column);
  for (const name of changedColumns) {
    const column = columns[find(name)];
    if (generated(column) || /\bidentity\b/i.test(column.extra ?? '')) fail(`字段 ${name} 由数据库生成，不能在此预览中显式赋值`);
    if (ast.operation === 'update' && protectedNames.has(name)) fail(`不支持更新主键或唯一键字段 ${name}，避免未预览的引用变化`);
    if (['json', 'array'].includes(tableTransferTypeFamily(column.dataType, provider)) || /^(?:enum|set|char\b|character\s*\(|binary\s*\()/i.test(column.dataType)) fail(`字段 ${name} 的隐式转换暂无准确的新值预览`);
  }
  const target = `${quote(ast.schema)}.${quote(ast.table)}`;
  const where = ast.where ? renderMutationExpression(ast.where, quote) : '';
  const countSql = ast.operation === 'insert' ? `SELECT ${ast.values.length} AS ${quote('input_rows')}` : `SELECT COUNT(*) AS ${quote('matched_rows')} FROM ${target} WHERE ${where}`;
  const snapshot = columns.map((column) => mutationSnapshotColumn(column, provider, quote));
  const projection: MutationProjection = { oldIndexes: [], changes: [], countIndex: -1 };
  let previewSql: string;
  let writeSql: string;
  let lockSql = '';
  if (ast.operation === 'insert') {
    for (const column of columns) {
      if (!ast.insertColumns.includes(column.name) && !column.isNullable && column.columnDefault === null && !generated(column) && !/identity|auto_increment/i.test(column.extra ?? '') && !(provider === 'sqlite' && /^integer$/i.test(column.dataType) && column.isPrimaryKey && keyIndexes.length === 1 && structure.properties.withoutRowid !== 'true')) fail(`INSERT 未提供非空字段 ${column.name}，且无默认值`);
    }
    const selects = ast.values.map((row, rowIndex) => {
      const items: string[] = [];
      row.forEach((expression, index) => {
        const columnIndex = find(ast.insertColumns[index]), raw = renderMutationExpression(expression, quote);
        if (rowIndex === 0) projection.changes.push({ column: columnIndex, castIndex: items.length, rawIndex: items.length + 1 });
        items.push(`${mutationCast(raw, columns[columnIndex], provider)} AS ${quote(`new_${index}`)}`, `${raw} AS ${quote(`raw_${index}`)}`);
      });
      return `SELECT ${items.join(', ')}`;
    });
    previewSql = selects.join('\nUNION ALL\n');
    writeSql = `INSERT INTO ${target} (${ast.insertColumns.map(quote).join(', ')}) VALUES\n${ast.values.map((row) => '(' + row.map((expression) => renderMutationExpression(expression, quote)).join(', ') + ')').join(',\n')}`;
  } else {
    const items: string[] = [];
    columns.forEach((column, index) => {
      projection.oldIndexes.push(items.length);
      items.push(`${snapshot[index]} AS ${quote(column.name)}`);
      const assignment = ast.assignments.find((item) => item.column === column.name);
      if (assignment) {
        const raw = renderMutationExpression(assignment.expression, quote);
        projection.changes.push({ column: index, castIndex: items.length, rawIndex: items.length + 1 });
        items.push(`${mutationCast(raw, column, provider)} AS ${quote(column.name + ' (new)')}`, `${raw} AS ${quote(column.name + ' (raw)')}`);
      }
    });
    projection.countIndex = items.length;
    const order = keyIndexes.map((index) => quote(columns[index].name)).join(', ');
    lockSql = `SELECT ${items.join(', ')}\nFROM ${target} WHERE ${where}\nORDER BY ${order} LIMIT ${maxRows + 1}${provider === 'sqlite' ? '' : ' FOR UPDATE'}`;
    previewSql = `SELECT ${items.join(', ')}, (${countSql}) AS ${quote('__fouc_matched')}\nFROM ${target} WHERE ${where}\nORDER BY ${order} LIMIT ${maxRows + 1}`;
    writeSql = ast.operation === 'delete'
      ? `DELETE FROM ${target} WHERE ${where}`
      : `UPDATE ${target} SET ${ast.assignments.map((item) => `${quote(item.column)} = ${renderMutationExpression(item.expression, quote)}`).join(', ')}\nWHERE ${where}`;
  }
  return {
    ast, writeSql, previewSql, countSql, projection, keyIndexes, generated: generatedIndexes,
    lockSql,
    afterSql: `SELECT ${snapshot.join(', ')} FROM ${target}`,
  };
}

export function mutationSnapshotColumn(column: DatabaseColumnInfo, provider: RelationalTableStructure['provider'], quote: (name: string) => string): string {
  const value = quote(column.name), family = tableTransferTypeFamily(column.dataType, provider);
  return ['json', 'array'].includes(family) ? `CAST(${value} AS ${provider === 'mysql' ? 'CHAR' : 'TEXT'})` : value;
}

function mutationCast(expression: string, column: DatabaseColumnInfo, provider: RelationalTableStructure['provider']): string {
  const family = tableTransferTypeFamily(column.dataType, provider);
  if (provider === 'postgres') {
    if (!/^(?:smallint|integer|bigint|int[248]|numeric(?:\(\d+(?:,\s*-?\d+)?\))?|decimal(?:\(\d+(?:,\s*\d+)?\))?|real|double precision|float[48]|bool(?:ean)?|text|(?:character varying|varchar)(?:\(\d+\))?|bytea|date|time(?:stamp)?(?:\(\d+\))?(?: (?:with|without) time zone)?|timestamptz)$/i.test(column.dataType.trim())) fail(`字段 ${column.name} 暂无受支持的原生 CAST`);
    return `CAST(${expression} AS ${column.dataType})`;
  }
  if (provider === 'sqlite') {
    const type = family === 'text' ? 'TEXT' : family === 'integer' || family === 'boolean' ? 'INTEGER' : family === 'float' ? 'REAL' : family === 'binary' ? 'BLOB' : '';
    if (!type) fail(`SQLite 字段 ${column.name} 的动态类型或十进制精度需要明确处理`);
    return `CAST(${expression} AS ${type})`;
  }
  const type = family === 'integer' || family === 'boolean' ? /\bunsigned\b/i.test(column.dataType) ? 'UNSIGNED' : 'SIGNED'
    : family === 'decimal' ? `DECIMAL(${column.numericPrecision ?? 65},${column.numericScale ?? 30})`
    : family === 'float' ? 'DOUBLE'
    : family === 'binary' ? 'BINARY'
    : family === 'text' ? `CHAR${column.characterMaximumLength ? `(${column.characterMaximumLength})` : ''}${column.characterSet && /^[A-Za-z0-9_]+$/.test(column.characterSet) ? ` CHARACTER SET ${column.characterSet}` : ''}`
    : family === 'date' ? 'DATE' : family === 'time' ? 'TIME' : family === 'timestamp' ? 'DATETIME' : '';
  if (!type) fail(`字段 ${column.name} 暂无受支持的原生 CAST`);
  return `CAST(${expression} AS ${type})`;
}
