/** Persisted connection metadata contains no password or credential-bearing URI. */
import type { DatabaseConnectionOptions } from './connection-options';
import type { ConnectionUrlFields } from './connection-options-url';
export interface MongoConnectionConfig {
  provider: 'mongodb'; host: string; port: number; username: string;
  database: string; authSource: string; connectionOptions: DatabaseConnectionOptions;
  mongo?: ConnectionUrlFields['mongo'];
}
export interface MongoSavedConnection {
  id: string; workspaceId: string; name: string; config: MongoConnectionConfig; updatedAt: number;
}
