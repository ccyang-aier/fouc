/** Native MongoDB transport. BSON values travel as canonical Extended JSON text. */
import type { DatabaseConnectionOptionsInput } from './connection-options';
import type { ConnectionUrlFields } from './connection-options-url';
export type MongoConnectionInput = {
  provider?: 'mongodb'; uri?: string; host?: string; port?: number;
  username?: string; password?: string; database?: string; authSource?: string;
  connectionOptions?: DatabaseConnectionOptionsInput;
  mongo?: ConnectionUrlFields['mongo'];
};
export interface MongoSession {
  provider: 'mongodb'; id: string; connectionId: string | null;
  database: string; host: string; version: string | null; readOnly: boolean;
}
export interface MongoNamespace { database: string; collection: string }
export interface MongoFindInput extends MongoNamespace {
  filter?: string; sort?: string; projection?: string; offset?: number; limit?: number;
}
export interface MongoDocumentPage extends MongoNamespace {
  documents: string[]; offset: number; limit: number; hasMore: boolean;
  nextOffset: number | null; elapsedMs: number; bytes: number; warnings: string[];
}
export interface MongoDatabase { name: string; sizeBytes: string | null; empty: boolean | null }
export interface MongoDatabaseList { databases: MongoDatabase[]; truncated: boolean }
export interface MongoCollection {
  name: string; kind: 'collection' | 'view' | 'timeseries' | 'unknown'; options: string;
}
export interface MongoCollectionList { database: string; collections: MongoCollection[]; truncated: boolean }
export interface MongoIndex {
  name: string; keys: Array<{ field: string; direction: string }>;
  unique: boolean; sparse: boolean; hidden: boolean; primary: boolean;
  expiresAfterSeconds: string | null; partialFilter: string | null; collation: string | null; raw: string;
}
export interface MongoIndexList extends MongoNamespace { indexes: MongoIndex[]; truncated: boolean }
export interface MongoCollectionInfo extends MongoNamespace {
  count: string | null; sizeBytes: string | null; storageBytes: string | null;
  averageDocumentBytes: string | null; indexBytes: string | null; indexCount: string | null;
  raw: string | null; warnings: string[];
}
export interface MongoCountResult extends MongoNamespace { count: string; elapsedMs: number }
export interface MongoCommandInput { database: string; command: string; limit?: number }
export interface MongoCommandResult {
  database: string; commandName: string; value: string | null; documents: string[];
  hasMore: boolean; elapsedMs: number; warnings: string[];
}
export const MONGO_LIMITS = { page: 500, defaultPage: 50, offset: 1_000_000, inputBytes: 262_144, responseBytes: 32 * 1024 * 1024, directory: 2000, maxTimeMs: 30_000 } as const;

/** DBX value recognition, adapted to canonical transport without coercing Long/Decimal128. */
export function mongoValueType(value: unknown): string {
  if (value === undefined) return 'missing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value !== 'object') return typeof value;
  const object = value as Record<string, unknown>, keys = Object.keys(object);
  if (keys.length === 1) {
    const types: Record<string, string> = { $oid: 'ObjectId', $numberInt: 'Int32', $numberLong: 'Int64', $numberDouble: 'Double', $numberDecimal: 'Decimal128', $date: 'Date', $binary: 'Binary', $regularExpression: 'RegExp', $timestamp: 'Timestamp', $minKey: 'MinKey', $maxKey: 'MaxKey', $undefined: 'Undefined', $symbol: 'Symbol' };
    if (types[keys[0]]) return types[keys[0]];
  }
  if (typeof object.$code === 'string' && keys.every(key => key === '$code' || key === '$scope')) return 'Code';
  return 'object';
}
export function mongoValueText(value: unknown): string {
  const type = mongoValueType(value);
  if (type === 'missing') return '—';
  if (type === 'null') return 'null';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  const object = value as Record<string, unknown>;
  if (['ObjectId', 'Int32', 'Int64', 'Double', 'Decimal128', 'Symbol'].includes(type)) return String(Object.values(object)[0]);
  if (type === 'Date') {
    const date = object.$date;
    const ms = typeof date === 'string' ? date : date && typeof date === 'object' ? (date as Record<string, unknown>).$numberLong : null;
    if (typeof ms === 'string' && /^-?\d+$/.test(ms)) {
      const numeric = Number(ms);
      if (Number.isSafeInteger(numeric) && Math.abs(numeric) <= 8_640_000_000_000_000) return new Date(numeric).toISOString();
    }
    return typeof ms === 'string' ? ms : JSON.stringify(date);
  }
  return JSON.stringify(value);
}
export function mongoDocumentFields(documents: string[]): string[] {
  const fields = new Set<string>();
  for (const text of documents) for (const key of Object.keys(JSON.parse(text) as Record<string, unknown>)) fields.add(key);
  return [...fields];
}
