import path from 'node:path';
import type { RelationalConnectionConfig } from '@fouc/shared';
import { DeviceConnectionRepository } from './connection-repository';
import { DatabaseInputError } from './input-error';

function normalize(value: unknown): RelationalConnectionConfig {
  if (!value || typeof value !== 'object') throw new DatabaseInputError('连接参数无效');
  const raw = value as Record<string, unknown>;
  if (
    raw.provider === 'postgres' &&
    typeof raw.host === 'string' &&
    raw.host.trim() &&
    Number.isInteger(raw.port) &&
    Number(raw.port) > 0 &&
    Number(raw.port) <= 65535 &&
    typeof raw.username === 'string' &&
    raw.username.trim() &&
    typeof raw.database === 'string' &&
    raw.database.trim() &&
    (raw.ssl === undefined || typeof raw.ssl === 'boolean')
  ) {
    return {
      provider: 'postgres',
      host: raw.host.trim(),
      port: Number(raw.port),
      username: raw.username.trim(),
      database: raw.database.trim(),
      ssl: raw.ssl === true,
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
