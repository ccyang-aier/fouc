import type { SchemaObjectDetails } from '@fouc/shared';
import { schemaObjectDetailsInput } from './schema-objects-input';
import { postgresSchemaObject } from './schema-objects-postgres';
import { mysqlSchemaObject } from './schema-objects-mysql';
import { sqliteSchemaObject } from './schema-objects-sqlite';
import type { NativeSchemaObjectAdapter } from './schema-objects-types';
export type { NativeSchemaObjectAdapter } from './schema-objects-types';
export { listSchemaObjects } from './schema-objects-list';
export async function describeSchemaObject(adapter: NativeSchemaObjectAdapter, value: unknown, signal?: AbortSignal): Promise<SchemaObjectDetails> {
  const input = schemaObjectDetailsInput(adapter.provider, value); signal?.throwIfAborted();
  const details = adapter.provider === 'postgres' ? await postgresSchemaObject(adapter, input, signal) : adapter.provider === 'mysql' ? await mysqlSchemaObject(adapter, input, signal) : await sqliteSchemaObject(adapter, input, signal);
  signal?.throwIfAborted(); return details;
}
