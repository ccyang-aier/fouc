/**
 * Database workbench transport contract.
 *
 * Field shapes follow DBX's connection, metadata and query-result DTOs. Names
 * use camelCase at the Fouc HTTP/WS boundary; secrets are sent separately from
 * saved connection metadata. This module has no runtime or UI dependency.
 */

export const DATABASE_CAPABILITIES = [
  'queryExecution',
  'metadataBrowse',
  'objectBrowser',
  'objectSource',
  'schemaSearch',
  'diagram',
  'tableDataEdit',
  'tableStructureEdit',
  'tableImport',
  'dataTransfer',
  'sqlFileExecution',
  'databaseCreate',
  'fieldLineage',
  'sqlExplain',
  'userAdmin',
  'driverManagement',
] as const;

export type DatabaseCapability = (typeof DATABASE_CAPABILITIES)[number];
export type DatabaseCapabilities = Record<DatabaseCapability, boolean>;
export type DatabaseSupportLevel = 'connect' | 'browse' | 'understand' | 'operate';
export type DatabaseRuntimeMode = 'native' | 'file' | 'agent' | 'external';
export type DatabaseMcpMode = 'direct' | 'bridge' | 'unsupported';

export interface DatabaseDriverDescriptor {
  dbType: string;
  label: string;
  dialect: string;
  runtimeMode: DatabaseRuntimeMode;
  mcpMode: DatabaseMcpMode;
  supportLevel: DatabaseSupportLevel;
  defaultPort: number;
  singleConnectionPool: boolean;
  metadataConnectionScoped: boolean;
  skipTcpProbe: boolean;
  traits: Record<string, boolean | number | string>;
  capabilities: DatabaseCapabilities;
}

export interface DatabaseConnectionProfile {
  id: string;
  dbType: string;
  label: string;
  icon: string;
  port: number;
  user: string;
  category: string | null;
  urlParams?: string;
  pickerLabel?: string;
}

export type DatabaseTransportLayer =
  | { type: 'ssh'; id: string; enabled: boolean; profileId: string; host: string; port: number; user: string; authMethod: string; keyPath?: string }
  | { type: 'proxy'; id: string; enabled: boolean; profileId: string; proxyType: string; host: string; port: number; username?: string }
  | { type: 'http_tunnel'; id: string; enabled: boolean; profileId: string; url: string };

/** Saved metadata only; passwords, tunnel credentials and tokens live in a secret store. */
export interface DatabaseConnectionConfig {
  id: string;
  name: string;
  note: string;
  dbType: string;
  driverProfile: string | null;
  driverLabel: string | null;
  host: string;
  port: number;
  username: string;
  database: string | null;
  defaultSchema: string | null;
  visibleDatabases: string[] | null;
  visibleDatabasePatterns: string[] | null;
  visibleSchemas: Record<string, string[]> | null;
  showSystemSchemas: boolean;
  color: string | null;
  transportLayers: DatabaseTransportLayer[];
  connectTimeoutSecs: number;
  queryTimeoutSecs: number;
  idleTimeoutSecs: number;
  keepaliveIntervalSecs: number;
  ssl: boolean;
  readOnly: boolean;
  isProduction: boolean;
  productionDatabases: string[];
  savePassword: boolean;
  oneTime: boolean;
  urlParams?: string | null;
  connectionString?: string | null;
  externalConfig?: Record<string, unknown> | null;
  pluginId?: string | null;
  pluginConnectionProvider?: string | null;
  pluginConnectionType?: string | null;
  jdbcDriverClass?: string | null;
  jdbcDriverPaths?: string[];
  driverOptions?: Record<string, unknown>;
}

export interface DatabaseConnectionInfo {
  productName?: string;
  productVersion?: string;
  currentDatabase?: string;
  serverComment?: string;
  serverCharset?: string;
  serverCollation?: string;
  unquotedIdentifierCase?: 'lower' | 'upper' | 'mixed';
  quotedIdentifierCase?: 'lower' | 'upper' | 'mixed';
  driverName?: string;
  driverVersion?: string;
  jdbcVersion?: string;
}

export interface DatabaseConnectionTestResult {
  message: string;
  databaseInfo: DatabaseConnectionInfo | null;
}

export type DatabaseConnectionHealth = 'disconnected' | 'connecting' | 'connected' | 'degraded' | 'error';

/** Static driver declarations never grant an operation on their own. */
export interface DatabaseCapabilitySnapshot {
  connectionId: string;
  health: DatabaseConnectionHealth;
  source: 'server';
  checkedAt: number;
  capabilities: DatabaseCapabilities;
  restrictions: { readOnly: boolean; production: boolean; reason?: string };
}

export function canUseDatabaseCapability(
  snapshot: DatabaseCapabilitySnapshot | null | undefined,
  capability: DatabaseCapability,
  effect: 'read' | 'write' = 'read',
): boolean {
  return snapshot?.source === 'server'
    && snapshot.health === 'connected'
    && snapshot.capabilities[capability]
    && (effect === 'read' || !snapshot.restrictions.readOnly);
}

export type DatabaseObjectKind =
  | 'database' | 'schema' | 'table' | 'view' | 'materialized_view'
  | 'column' | 'index' | 'foreign_key' | 'trigger' | 'procedure'
  | 'function' | 'sequence' | 'event' | 'extension' | 'type'
  | 'collection' | 'key' | 'topic' | 'other';

export interface DatabaseObjectRef {
  connectionId: string;
  database: string | null;
  schema: string | null;
  kind: DatabaseObjectKind;
  name: string;
  parentSchema?: string | null;
  parentName?: string | null;
}

export interface DatabaseObjectInfo extends DatabaseObjectRef {
  comment: string | null;
  valid?: boolean | null;
  signature?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface DatabaseColumnInfo {
  name: string;
  dataType: string;
  resolvedSchema?: string | null;
  isNullable: boolean;
  columnDefault: string | null;
  isPrimaryKey: boolean;
  isUnique: boolean;
  extra: string | null;
  comment: string | null;
  numericPrecision: number | null;
  numericScale: number | null;
  characterMaximumLength: number | null;
  enumValues?: string[] | null;
  characterSet?: string | null;
  collation?: string | null;
}

export type DatabaseCell = string | number | boolean | null | DatabaseCell[] | { [key: string]: DatabaseCell };

export interface DatabaseQueryMessage {
  severity: string;
  message: string;
  code?: string;
  detail?: string;
  hint?: string;
}

export interface DatabaseQueryResult {
  columns: string[];
  /** Optional parallel arrays: drivers may omit or truncate metadata. */
  columnTypes: string[];
  columnSortables: boolean[];
  rows: DatabaseCell[][];
  /** Outside JS safe integer range, drivers must serialize integer cells as strings. */
  affectedRows: number | string;
  executionTimeMs: number;
  serverExecuteTimeUs?: number | null;
  truncated: boolean;
  sessionId: string | null;
  hasMore: boolean;
  spatialColumns?: Array<{ columnIndex: number; srid: number | null }>;
  spatialValues?: Array<Array<number | null>>;
  elasticsearchRawBody?: string | null;
  messages: DatabaseQueryMessage[];
}

export type DatabaseTaskStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export interface DatabaseTaskProgress {
  taskId: string;
  kind: 'query' | 'import' | 'export' | 'transfer' | 'backup' | 'schema-diff' | 'other';
  status: DatabaseTaskStatus;
  currentObject: string | null;
  completedItems: number;
  totalItems: number | null;
  completedRows: number;
  totalRows: number | null;
  preparing: boolean;
  errorCount: number;
  errorSummary: string | null;
  terminal: boolean;
}

export interface DatabaseOperationError {
  code: string;
  message: string;
  detail?: string | null;
  hint?: string | null;
  connectionId?: string;
  database?: string | null;
  operation?: string;
  retryable: boolean;
}

export interface DatabasePermissionContext {
  connectionId: string;
  database: string | null;
  readOnly: boolean;
  production: boolean;
  allowedOperations: Array<'read' | 'write' | 'destructive' | 'admin'>;
  confirmationRequired: boolean;
}
