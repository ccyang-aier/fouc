import type { MongoConnectionConfig } from '@fouc/shared/mongo-connections';
import { DatabaseInputError } from './input-error';
import { mongoConnection, mongoDatabase, mongoInteger, mongoObject } from './mongo-input';

export function mongoConfig(value: unknown): MongoConnectionConfig {
  const input = mongoObject(value);
  if (input.provider !== 'mongodb' || input.uri !== undefined) throw new DatabaseInputError('保存的 MongoDB 连接须使用主机参数');
  const config: MongoConnectionConfig = {
    provider: 'mongodb', host: typeof input.host === 'string' ? input.host.trim() : '',
    port: mongoInteger(input.port, 27017, 1, 65535),
    username: typeof input.username === 'string' ? input.username.trim() : '',
    database: mongoDatabase(input.database || 'admin'), authSource: mongoDatabase(input.authSource || 'admin'),
    tls: input.tls === true,
  };
  if (config.username.length > 256 || input.tls !== undefined && typeof input.tls !== 'boolean') throw new DatabaseInputError('MongoDB 身份或 TLS 参数无效');
  mongoConnection(config);
  return config;
}
