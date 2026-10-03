import path from 'node:path';
import type { RelationalConnectionConfig } from '@fouc/shared';
import { DeviceConnectionRepository } from './connection-repository';
import { DatabaseInputError } from './input-error';
import { publicNativeConnectionOptions } from './connection-options';

function normalize(value: unknown): RelationalConnectionConfig {
  if (!value || typeof value !== 'object') throw new DatabaseInputError('连接参数无效');
  const raw = value as Record<string, unknown>;
  if ('ssl' in raw || 'tls' in raw) throw new DatabaseInputError('TLS 设置请使用统一的高级连接参数');
  if (
    (raw.provider === 'postgres' || raw.provider === 'mysql') &&
    typeof raw.host === 'string' &&
    raw.host.trim() &&
    Number.isInteger(raw.port) &&
    Number(raw.port) > 0 &&
    Number(raw.port) <= 65535 &&
    typeof raw.username === 'string' &&
    raw.username.trim() &&
    typeof raw.database === 'string' &&
    (raw.provider === 'mysql' || raw.database.trim())
  ) {
    return {
      provider: raw.provider,
      host: raw.host.trim(),
      port: Number(raw.port),
      username: raw.username.trim(),
      database: raw.database.trim(),
      connectionOptions: publicNativeConnectionOptions(raw.provider, raw.connectionOptions),
    };
  }
  if (raw.provider === 'sqlite' && typeof raw.path === 'string' && path.isAbsolute(raw.path))
    return { provider: 'sqlite', path: raw.path };
  throw new DatabaseInputError('连接参数无效');
}
export class RelationalConnectionRepository extends DeviceConnectionRepository<RelationalConnectionConfig> {
  constructor(directory: string) {
    super(directory, normalize);
  }
}
