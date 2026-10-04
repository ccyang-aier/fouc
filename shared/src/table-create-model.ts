import type { RelationalProvider } from './relational';
import type { TableCreateColumn, TableCreateType } from './table-create-types';

const plain = (name: string, family: TableCreateType['family']): TableCreateType => ({ name, family, parameter: 'none' });
const length = (name: string, maximumLength: number): TableCreateType => ({ name, family: 'text', parameter: 'length', maximumLength });
/** A deliberately bounded native type picker; unsupported types are not offered as editable SQL. */
export const tableCreateTypes: Record<RelationalProvider, readonly TableCreateType[]> = {
  mysql: [
    ...['TINYINT', 'SMALLINT', 'INT', 'BIGINT'].map(name => plain(name, 'integer')),
    { name: 'DECIMAL', family: 'decimal', parameter: 'decimal' },
    ...['FLOAT', 'DOUBLE'].map(name => plain(name, 'float')), plain('BOOLEAN', 'boolean'),
    length('VARCHAR', 16383), length('CHAR', 255), plain('TEXT', 'text'),
    plain('BLOB', 'binary'), plain('DATE', 'date'), plain('TIME', 'time'),
    plain('DATETIME', 'datetime'), plain('TIMESTAMP', 'datetime'), plain('JSON', 'json'),
  ],
  postgres: [
    ...['SMALLINT', 'INTEGER', 'BIGINT'].map(name => plain(name, 'integer')),
    { name: 'NUMERIC', family: 'decimal', parameter: 'decimal' },
    ...['REAL', 'DOUBLE PRECISION'].map(name => plain(name, 'float')), plain('BOOLEAN', 'boolean'),
    length('VARCHAR', 10485760), length('CHAR', 10485760), plain('TEXT', 'text'),
    plain('BYTEA', 'binary'), plain('DATE', 'date'), plain('TIME', 'time'),
    plain('TIMESTAMP', 'datetime'), plain('TIMESTAMP WITH TIME ZONE', 'datetime'), plain('JSONB', 'json'), plain('UUID', 'uuid'),
  ],
  sqlite: [plain('INTEGER', 'integer'), plain('REAL', 'float'), plain('TEXT', 'text'), plain('BLOB', 'binary'), plain('NUMERIC', 'decimal')],
};

export function tableCreateDefaultFunctions(provider: RelationalProvider, type: string): readonly string[] {
  const family = tableCreateTypes[provider].find(item => item.name === type)?.family;
  if (provider === 'sqlite') return type === 'TEXT' ? ['CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME'] : [];
  if (family === 'datetime') return ['CURRENT_TIMESTAMP'];
  if (family === 'date') return ['CURRENT_DATE'];
  if (provider === 'postgres' && family === 'time') return ['CURRENT_TIME'];
  return [];
}
export function tableCreateNewColumn(provider: RelationalProvider, id: string, primary = false): TableCreateColumn {
  return {
    id, name: primary ? 'id' : '', type: primary ? provider === 'mysql' ? 'BIGINT' : provider === 'postgres' ? 'BIGINT' : 'INTEGER' : provider === 'sqlite' ? 'TEXT' : 'VARCHAR',
    length: !primary && provider !== 'sqlite' ? 255 : null, precision: null, scale: null,
    nullable: !primary, primaryKey: primary, unique: false,
    identity: primary ? provider === 'postgres' ? 'by-default' : 'auto' : 'none', default: { kind: 'none' },
  };
}
