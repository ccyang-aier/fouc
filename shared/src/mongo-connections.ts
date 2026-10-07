/** Persisted connection metadata contains no password or credential-bearing URI. */
import type { DatabaseConnectionOptions } from './connection-options';
import type { ConnectionUrlFields } from './connection-options-url';
import type { ConnectionDirectoryMetadata, ConnectionDirectoryStatus } from './connection-directory';
export interface MongoConnectionConfig {
  provider: 'mongodb'; host: string; port: number; username: string;
  database: string; authSource: string; connectionOptions: DatabaseConnectionOptions;
  mongo?: ConnectionUrlFields['mongo'];
}
export interface MongoSavedConnection {
  id: string; name: string; config: MongoConnectionConfig; updatedAt: number;
  directory?: ConnectionDirectoryMetadata;
  status?: ConnectionDirectoryStatus;
}
