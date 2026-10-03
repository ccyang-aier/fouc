import type { DatabaseColumnInfo } from './database';
import type { RelationalTableStructure } from './relational-structure';
import { isTableImportDefaultColumn, isTableImportGeneratedColumn } from './table-import';
import type { TestDataConfig, TestDataGenerator } from './test-data-types';

export function testDataColumnFamily(column: DatabaseColumnInfo): 'integer' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'time' | 'text' | 'uuid' | 'unsupported' {
  const type = column.dataType.toLowerCase();
  if (/\[\]|\barray\b|\brange\b/.test(type)) return 'unsupported';
  if (/\b(?:tinyint|smallint|mediumint|int|integer|bigint|int2|int4|int8|serial|bigserial|smallserial)\b/.test(type)) return 'integer';
  if (/\b(?:decimal|numeric|number|real|float|double|money)\b/.test(type)) return 'decimal';
  if (/\b(?:boolean|bool)\b/.test(type)) return 'boolean';
  if (/^date$/.test(type)) return 'date';
  if (/timestamp|datetime/.test(type)) return 'datetime';
  if (/^time(?:\b|\()/i.test(type)) return 'time';
  if (/^uuid$/.test(type)) return 'uuid';
  if (!type || /char|text|clob|string|enum/.test(type)) return 'text';
  return 'unsupported';
}

export function testDataColumnLock(structure: RelationalTableStructure, column: DatabaseColumnInfo): string | null {
  if (isTableImportGeneratedColumn(column)) return '数据库生成字段';
  if (/auto_increment|nextval\s*\(|\bserial\b|\browid\b/i.test(`${column.extra ?? ''} ${column.columnDefault ?? ''} ${column.dataType}`)) return '数据库自增 / 序列';
  if (structure.provider === 'sqlite' && column.isPrimaryKey && /^INTEGER$/i.test(column.dataType) && structure.columns.filter(item => item.isPrimaryKey).length === 1) return 'SQLite 原生 rowid';
  if (structure.foreignKeys.some(key => key.columns.includes(column.name))) return '外键：本批不采样引用表';
  if (testDataColumnFamily(column) === 'unsupported') return '当前类型不支持生成';
  return null;
}

export function testDataNativeUnique(structure: RelationalTableStructure, name: string): boolean {
  const column = structure.columns.find(item => item.name === name);
  const primary = structure.columns.filter(item => item.isPrimaryKey);
  return Boolean(column?.isUnique || (column?.isPrimaryKey && primary.length === 1) || structure.indexes.some(index => {
    const parts = index.parts.filter(part => part.role === 'key');
    return index.unique && !index.predicate && parts.length === 1 && parts[0].column === name && parts[0].prefixLength === null;
  }));
}

export function defaultTestDataGenerator(column: DatabaseColumnInfo): TestDataGenerator {
  if (column.enumValues?.length) return { kind: 'enum', values: [...column.enumValues] };
  const family = testDataColumnFamily(column);
  if (family === 'integer') return { kind: 'integer', min: '1', max: /tinyint/i.test(column.dataType) ? '100' : /smallint|int2/i.test(column.dataType) ? '30000' : '1000000' };
  if (family === 'decimal') {
    const scale = Math.min(column.numericScale ?? 2, 100);
    const integerDigits = Math.max(0, (column.numericPrecision ?? 8) - scale);
    return { kind: 'decimal', min: '0', max: integerDigits === 0 ? testDecimalMaximum(scale) : String(Math.min(1000, 10 ** Math.min(integerDigits, 4) - 1)), scale };
  }
  if (family === 'boolean') return { kind: 'enum', values: ['true', 'false'] };
  if (family === 'date' || family === 'datetime') return { kind: family, start: '2025-01-01', end: '2025-12-31' };
  if (family === 'time') return { kind: 'time', start: '09:00:00', end: '18:00:00' };
  if (family === 'uuid' || /(?:^|_)uuid$|guid/i.test(column.name)) return { kind: 'uuid' };
  if (/email|e_mail/i.test(column.name)) return { kind: 'email', domain: 'example.test' };
  if (/^(?:name|full_name|姓名|名字)$/i.test(column.name) && (column.characterMaximumLength ?? 3) >= 3) return { kind: 'name' };
  return { kind: 'text', length: Math.min(column.characterMaximumLength ?? 24, 24) };
}

function testDecimalMaximum(scale: number): string {
  return scale ? '0.' + '9'.repeat(scale) : '0';
}

export function defaultTestDataConfig(structure: RelationalTableStructure): TestDataConfig {
  return {
    seed: 'fouc-test-data',
    rowCount: 100,
    columns: structure.columns.map(column => {
      const unique = testDataNativeUnique(structure, column.name);
      let generator = defaultTestDataGenerator(column);
      if (unique && testDataColumnFamily(column) === 'integer') generator = { kind: 'sequence', start: '1', step: '1' };
      return {
        column: column.name,
        enabled: !testDataColumnLock(structure, column) && !isTableImportDefaultColumn(column, structure.provider, structure.columns),
        unique,
        nullPercent: 0,
        generator,
      };
    }),
  };
}
