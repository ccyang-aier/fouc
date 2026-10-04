import type { RelationalProvider } from './relational';

export const DATABASE_ADMIN_OBJECT_LIMITS = {
  page: 100, maximumPage: 200, maximumOffset: 100_000,
  versions: 200, members: 500, dependencies: 500,
  sourceBytes: 1024 * 1024, sourceCharacters: 256 * 1024, requestBytes: 16 * 1024,
} as const;
export type DatabaseAdminObjectListInput =
  | { kind: 'event'; schema: string; search?: string; offset?: number; limit?: number }
  | { kind: 'extension'; filter?: 'all' | 'installed' | 'available'; search?: string; offset?: number; limit?: number };
export type DatabaseAdminObjectDetailsInput = { kind: 'event'; schema: string; name: string } | { kind: 'extension'; name: string };
export interface DatabaseAdminObjectItem {
  id: string;
  kind: 'event' | 'extension';
  name: string;
  schema: string | null;
  comment: string | null;
  installedVersion: string | null;
  defaultVersion: string | null;
  available: boolean | null;
  status: string | null;
  schedule: string | null;
  timeZone: string | null;
}
export interface DatabaseAdminObjectList {
  provider: RelationalProvider;
  database: string;
  items: DatabaseAdminObjectItem[];
  offset: number;
  limit: number;
  hasMore: boolean;
  coverage: 'permission-filtered' | 'database-catalog';
  warnings: string[];
}
export interface DatabaseAdminObjectSource {
  text: string | null;
  origin: 'native' | 'reconstructed' | 'unknown';
  complete: boolean;
  bytes: number | null;
  warning: string | null;
}
export interface DatabaseAdminObjectRows<T> {
  items: T[];
  limit: number;
  hasMore: boolean;
  complete: boolean;
  error: string | null;
}
export interface MySqlEventDetails {
  kind: 'event';
  name: string;
  schema: string;
  definer: string | null;
  status: string | null;
  timeZone: string | null;
  eventType: string | null;
  executeAt: string | null;
  intervalValue: string | null;
  intervalUnit: string | null;
  starts: string | null;
  ends: string | null;
  completion: string | null;
  comment: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastExecuted: string | null;
  properties: Record<string, string | null>;
  scheduler: { status: string | null; sessionTimeZone: string | null; systemTimeZone: string | null; error: string | null };
  body: DatabaseAdminObjectSource;
  source: DatabaseAdminObjectSource;
  warnings: string[];
}
export interface PostgresExtensionVersion {
  version: string;
  installed: boolean | null;
  superuser: boolean | null;
  trusted: boolean | null;
  relocatable: boolean | null;
  requiredSchema: string | null;
  requires: string[] | null;
  comment: string | null;
}
export interface PostgresExtensionMember { catalog: string; oid: string; subId: number; objectType: string | null; schema: string | null; name: string | null; identity: string | null }
export interface PostgresExtensionDependency extends PostgresExtensionMember { direction: 'requires' | 'dependent'; dependencyType: string }
export interface PostgresExtensionDetails {
  kind: 'extension';
  name: string;
  comment: string | null;
  defaultVersion: string | null;
  installed: { oid: string; version: string; schema: string | null; owner: string | null; relocatable: boolean | null } | null;
  permissions: { currentUser: string | null; superuser: boolean | null; databaseCreate: boolean | null; error: string | null };
  versionColumns: string[];
  versions: DatabaseAdminObjectRows<PostgresExtensionVersion>;
  members: DatabaseAdminObjectRows<PostgresExtensionMember>;
  dependencies: DatabaseAdminObjectRows<PostgresExtensionDependency>;
  source: DatabaseAdminObjectSource;
  warnings: string[];
}
export type DatabaseAdminObjectDetails = MySqlEventDetails | PostgresExtensionDetails;
export function databaseAdminObjectKey(kind: 'event' | 'extension', name: string, schema: string | null): string {
  return JSON.stringify([kind, schema, name]);
}
