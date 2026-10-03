import type { DatabaseCell, RelationalTableStructure } from '@fouc/shared';
import { isBinaryCell, quoteExportIdentifier, type DatabaseExportRow, type DatabaseExportTableReview } from '@fouc/shared/database-export';
import { databaseExportMysqlGeometry, databaseExportNativeText } from './database-export-plan';
import type { DriverResult, SqlParameter } from './drivers/relational-driver';

export interface ExportCursor { values: SqlParameter[]; }

function parameter(value: DatabaseCell, type: string, provider: string): SqlParameter {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (isBinaryCell(value)) return Buffer.from(value.base64, 'base64');
  if (typeof value === 'string') {
    if (provider === 'sqlite' && type === 'integer' && /^-?\d+$/.test(value)) return BigInt(value);
    return value;
  }
  throw new Error('唯一键包含无法按原生类型绑定的值，导出未继续。');
}

export function databaseExportCursor(row: DatabaseExportRow, review: DatabaseExportTableReview, provider: string): ExportCursor {
  return {
    values: review.orderColumns.map(name => {
      const index = review.columns.findIndex(column => column.name === name);
      return parameter(row.values[index], row.types[index], provider);
    })
  };
}

export function compileDatabaseExportRead(structure: RelationalTableStructure, review: DatabaseExportTableReview, size: number, offset: number, cursor: ExportCursor | null) {
  const provider = structure.provider;
  const quote = (name: string) => quoteExportIdentifier(name, provider);
  const values: SqlParameter[] = [];
  const bind = (value: SqlParameter) => { values.push(value); return provider === 'postgres' ? `$${values.length}` : '?'; };
  const bindCursor = (name: string, value: SqlParameter): string => {
    const placeholder = bind(value);
    if (provider !== 'mysql') return placeholder;
    const column = structure.columns.find(column => column.name === name)!;
    // MySQL mixed string/number comparisons must not round a BIGINT or DECIMAL
    // cursor through DOUBLE. Cast parameters to their actual catalog number type.
    if (/^(?:tinyint|smallint|mediumint|int|integer|bigint|year)\b/i.test(column.dataType)) {
      return `CAST(${placeholder} AS ${/\bunsigned\b/i.test(column.dataType) ? 'UNSIGNED' : 'SIGNED'})`;
    }
    if (/^(?:decimal|numeric|dec|fixed)\b/i.test(column.dataType)) {
      const declared = /\((\d+)(?:,\s*(\d+))?\)/.exec(column.dataType);
      const precision = column.numericPrecision ?? (declared ? Number(declared[1]) : null);
      const scale = column.numericScale ?? (declared ? Number(declared[2] ?? 0) : null);
      if (precision === null || scale === null || !Number.isInteger(precision) || !Number.isInteger(scale) || precision < 1 || precision > 65 || scale < 0 || scale > 30 || scale > precision) {
        throw new Error('原生 DECIMAL 唯一键缺少准确精度，无法保证游标比较保真。');
      }
      return `CAST(${placeholder} AS DECIMAL(${precision},${scale}))`;
    }
    return placeholder;
  };
  const fields = structure.columns.flatMap((column, index) => {
    const source = quote(column.name);
    const value = provider === 'mysql' && databaseExportMysqlGeometry(column.dataType)
      ? `CONCAT(LPAD(HEX(ST_SRID(${source})), 8, '0'), HEX(ST_AsWKB(${source})))`
      : databaseExportNativeText(provider, column)
        ? provider === 'postgres' ? `${source}::text` : `CAST(${source} AS CHAR CHARACTER SET utf8mb4)`
        : source;
    const result = [`${value} AS ${quote(`_fouc_value_${index}`)}`];
    if (provider === 'sqlite') result.push(`typeof(${source}) AS ${quote(`_fouc_type_${index}`)}`);
    return result;
  });
  const relation = `${quote(structure.schema)}.${quote(structure.table)}`;
  let where = '';
  if (cursor) {
    where = ' WHERE ' + review.orderColumns.map((column, index) => {
      const equality = review.orderColumns.slice(0, index).map((name, position) => `${quote(name)} = ${bindCursor(name, cursor.values[position])}`);
      return '(' + [...equality, `${quote(column)} > ${bindCursor(column, cursor.values[index])}`].join(' AND ') + ')';
    }).join(' OR ');
  }
  const order = review.orderColumns.length ? ` ORDER BY ${review.orderColumns.map(column => `${quote(column)} ASC`).join(', ')}` : '';
  // Both size and offset are internally bounded integers, but remain native parameters.
  const limit = ` LIMIT ${bind(size + 1)}`;
  const pagination = review.pagination === 'offset' ? ` OFFSET ${bind(offset)}` : '';
  return { sql: `SELECT ${fields.join(', ')} FROM ${relation}${where}${order}${limit}${pagination}`, values };
}

export function decodeDatabaseExportRows(result: DriverResult, structure: RelationalTableStructure): DatabaseExportRow[] {
  const width = structure.columns.length * (structure.provider === 'sqlite' ? 2 : 1);
  return result.rows.map(raw => {
    if (raw.length !== width) throw new Error('原生导出行宽度与已确认结构不匹配，文件未发布。');
    const values: DatabaseCell[] = [], types: string[] = [];
    for (let index = 0; index < structure.columns.length; index++) {
      let value = raw[index * (structure.provider === 'sqlite' ? 2 : 1)];
      const type = structure.provider === 'sqlite' ? raw[index * 2 + 1] : structure.columns[index].dataType;
      if (typeof type !== 'string' || structure.provider === 'sqlite' && !['integer', 'real', 'text', 'blob', 'null'].includes(type)) throw new Error('原生存储类型缺失，无法保证导出值保真。');
      if (typeof value === 'number' && (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value))) throw new Error('原生驱动返回了不精确的数值，请使用原始数字文本。');
      if (structure.provider === 'sqlite' && type === 'real' && typeof value !== 'number') throw new Error('SQLite REAL 不是有限原始数值，导出已停止。');
      if (structure.provider === 'mysql' && databaseExportMysqlGeometry(type) && value !== null) {
        if (typeof value !== 'string' || value.length < 10 || value.length % 2 || !/^[0-9a-f]+$/i.test(value)) throw new Error('原生几何 WKB 数据无效，导出未继续。');
        value = { type: 'geometry', srid: parseInt(value.slice(0, 8), 16), wkb: { type: 'binary', base64: Buffer.from(value.slice(8), 'hex').toString('base64') } };
      }
      values.push(value);
      types.push(type);
    }
    return { values, types };
  });
}
