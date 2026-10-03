import type {
  DatabaseCell,
  DatabaseColumnInfo,
  DatabaseConnectionInfo,
  DatabaseObjectKind,
} from '@fouc/shared';

export type Relation = { name: string; schema: string; kind: DatabaseObjectKind; comment: string | null };
export type DriverResult = {
  columns: string[];
  columnTypes: string[];
  rows: DatabaseCell[][];
  hasMore: boolean;
};
export type SqlParameter = string | number | boolean | null | Uint8Array | bigint;
export type TransactionResult = DriverResult & { affectedRows: number };
export interface RelationalTransaction {
  query(sql: string, values: SqlParameter[]): Promise<TransactionResult>;
}
export interface RelationalDriver {
  info: DatabaseConnectionInfo;
  quoteIdentifier(value: string): string;
  schemas(): Promise<string[]>;
  tables(schema: string): Promise<Relation[]>;
  columns(schema: string, table: string): Promise<DatabaseColumnInfo[]>;
  read(sql: string, schema: string | null, maxRows: number): Promise<DriverResult>;
  assertEditable(schema: string, table: string): Promise<void>;
  transaction<T>(schema: string, run: (transaction: RelationalTransaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function relationalCell(value: unknown): DatabaseCell {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return { type: 'binary', base64: Buffer.from(value).toString('base64') };
  if (Array.isArray(value)) return value.map(relationalCell);
  if (typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, relationalCell(item)]));
  return String(value);
}
