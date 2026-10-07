export type CliFormat = 'table' | 'json' | 'csv';
export type CliProvider = 'mysql' | 'postgres' | 'sqlite' | 'redis' | 'mongodb';
export interface CliOptions {
  command: string[];
  connection: string | null;
  /** Internal callers with ID-based grants must never fall back to display names. */
  connectionResolution?: 'id';
  session: string | null;
  provider: CliProvider | null;
  schema: string | null;
  table: string | null;
  database: string | null;
  collection: string | null;
  query: string | null;
  file: string | null;
  output: string | null;
  overwrite: boolean;
  timeout: number;
  limit: number;
  offset: number;
  format: CliFormat;
  url: string;
  help: boolean;
}
export interface CliGrid {
  columns: string[];
  rows: unknown[][];
  label?: string;
}
export interface CliResult {
  command: string;
  data: unknown;
  grids?: CliGrid[];
  text?: string;
  warnings?: string[];
}
export class DatastoreCliError extends Error {
  constructor(message: string, readonly exitCode = 1, readonly code = 'operation_failed') {
    super(message);
    this.name = 'DatastoreCliError';
  }
}
export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
}
export type CliEnvironment = Record<string, string | undefined>;
