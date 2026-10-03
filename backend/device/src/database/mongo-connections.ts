import type { MongoConnectionConfig } from '@fouc/shared/mongo-connections';
import { DatabaseInputError } from './input-error';
import { mongoConnection, mongoDatabase, mongoInteger, mongoObject } from './mongo-input';
import { publicNativeConnectionOptions } from './connection-options';
import { parseConnectionSource } from '@fouc/shared/connection-options-url';

export function mongoConfig(value: unknown): MongoConnectionConfig {
  const input = mongoObject(value);
  if (input.provider !== 'mongodb' || input.uri !== undefined) throw new DatabaseInputError('保存的 MongoDB 连接须使用主机参数');
  if ('tls' in input || 'ssl' in input) throw new DatabaseInputError('TLS 设置请使用统一的高级连接参数');
  const config: MongoConnectionConfig = {
    provider: 'mongodb', host: typeof input.host === 'string' ? input.host.trim() : '',
    port: mongoInteger(input.port, 27017, 1, 65535),
    username: typeof input.username === 'string' ? input.username.trim() : '',
    database: mongoDatabase(input.database || 'admin'), authSource: mongoDatabase(input.authSource || 'admin'),
    connectionOptions: publicNativeConnectionOptions('mongodb', input.connectionOptions, !!(input.mongo && typeof input.mongo === 'object' && 'srv' in input.mongo && input.mongo.srv === true)),
  };
  if (config.username.length > 256) throw new DatabaseInputError('MongoDB 身份参数无效');
  const native = mongoConnection({ ...config, mongo: input.mongo });
  const fields = parseConnectionSource(native.uri, 'mongodb').fields;
  config.mongo = fields.mongo;
  config.host = fields.host;
  config.port = fields.port;
  return config;
}
