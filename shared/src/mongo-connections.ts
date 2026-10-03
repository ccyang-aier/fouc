/** Persisted connection metadata contains no password or credential-bearing URI. */
export interface MongoConnectionConfig {
  provider: 'mongodb'; host: string; port: number; username: string;
  database: string; authSource: string; tls: boolean;
}
export interface MongoSavedConnection {
  id: string; workspaceId: string; name: string; config: MongoConnectionConfig; updatedAt: number;
}
