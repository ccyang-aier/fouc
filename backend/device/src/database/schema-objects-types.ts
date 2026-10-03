import type { RelationalProvider } from '@fouc/shared';
export type NativeSchemaObjectAdapter = {
  provider: RelationalProvider;
  /** Only built-in catalog SQL from this module reaches this callback. */
  query: (sql: string, parameters: readonly (string | number | boolean | null)[], signal?: AbortSignal) => Promise<Record<string, unknown>[]>;
};
