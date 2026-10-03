import {
  publicConnectionOptions,
  type DatabaseConnectionOptions,
} from './connection-options';
import {
  buildConnectionSource,
  parseConnectionSource,
} from './connection-options-url';
import type { RelationalConnectionConfig } from './relational';
import type { RedisConnectionConfig } from './redis';
import type { MongoConnectionConfig } from './mongo-connections';

export type TransferConnectionConfig =
  | RelationalConnectionConfig
  | RedisConnectionConfig
  | MongoConnectionConfig;
export type TransferConnection = {
  name: string;
  config: TransferConnectionConfig;
};
export type ConnectionConfigBundle = {
  format: 'fouc-connection-config';
  version: 1;
  exportedAt: string;
  connections: TransferConnection[];
};
export const CONNECTION_CONFIG_LIMITS = {
  connections: 500,
  plainBytes: 2_097_152,
  fileBytes: 3_145_728,
  nameCharacters: 120,
} as const;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label}须为对象`);
  return value as Record<string, unknown>;
}
function keys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      throw new Error(`${label}包含不支持的字段：${key}`);
}
function text(
  value: unknown,
  label: string,
  maximum: number,
  required = true,
): string {
  if (
    typeof value !== 'string' ||
    value.length > maximum ||
    /[\r\n\0]/u.test(value) ||
    (required && !value.trim())
  )
    throw new Error(`${label}无效`);
  return value;
}
function host(value: unknown): string {
  const raw = text(value, '主机', 253);
  if (/[\s/@?#\\]/u.test(raw)) throw new Error('主机须为 DNS 或 IP 地址');
  try {
    const normalized = new URL(
      `http://${raw.includes(':') && !raw.startsWith('[') ? `[${raw}]` : raw}`,
    ).hostname.replace(/^\[|\]$/g, '');
    if (!normalized.includes(':') && !/^[a-zA-Z0-9_.-]+$/.test(normalized))
      throw new Error();
    return normalized;
  } catch {
    throw new Error('主机须为有效 DNS 或 IP 地址');
  }
}
function integer(
  value: unknown,
  label: string,
  maximum: number,
  minimum = 1,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  )
    throw new Error(`${label}无效`);
  return value;
}
function publicOptions(
  provider: 'postgres' | 'mysql' | 'redis' | 'mongodb',
  value: unknown,
): DatabaseConnectionOptions {
  const options = object(value, '高级连接参数');
  keys(
    options,
    ['connectTimeoutMs', 'queryTimeoutMs', 'idleTimeoutMs', 'tls'],
    '高级连接参数',
  );
  for (const key of [
    'connectTimeoutMs',
    'queryTimeoutMs',
    'idleTimeoutMs',
    'tls',
  ])
    if (!(key in options)) throw new Error(`高级连接参数缺少 ${key}`);
  const tls = object(options.tls, 'TLS 参数');
  const publicKeys = [
    'enabled',
    'serverName',
    'minVersion',
    'caRequired',
    'clientCertificateRequired',
  ];
  keys(tls, publicKeys, '公开 TLS 参数（不接受证书、私钥或口令）');
  for (const key of publicKeys)
    if (!(key in tls)) throw new Error(`TLS 参数缺少 ${key}`);
  return publicConnectionOptions(provider, options);
}

/** Current schema only: importing secrets/URIs or silently adapting old shapes is forbidden. */
export function validateTransferConnection(value: unknown): TransferConnection {
  const entry = object(value, '连接条目');
  keys(entry, ['name', 'config'], '连接条目');
  const name = text(
    entry.name,
    '连接名称',
    CONNECTION_CONFIG_LIMITS.nameCharacters,
  ).trim();
  const raw = object(entry.config, '连接配置'),
    provider = raw.provider;
  if (provider === 'sqlite') {
    keys(raw, ['provider', 'path'], 'SQLite 配置');
    const path = text(raw.path, 'SQLite 文件路径', 4096);
    if (!/^(?:[a-zA-Z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+|\/)/.test(path))
      throw new Error('SQLite 文件路径须为绝对路径');
    return { name, config: { provider, path } };
  }
  if (
    provider !== 'postgres' &&
    provider !== 'mysql' &&
    provider !== 'redis' &&
    provider !== 'mongodb'
  )
    throw new Error('配置包含当前未支持的原生连接类型');
  keys(
    raw,
    [
      'provider',
      'host',
      'port',
      'username',
      'database',
      'connectionOptions',
      ...(provider === 'mongodb' ? ['authSource', 'mongo'] : []),
    ],
    '公开连接配置（不接受密码或 URI）',
  );
  const address = host(raw.host),
    port = integer(raw.port, '端口', 65535),
    username = text(
      raw.username,
      '用户名',
      256,
      provider === 'postgres' || provider === 'mysql',
    );
  const connectionOptions = publicOptions(provider, raw.connectionOptions);
  if (provider === 'redis')
    return {
      name,
      config: {
        provider,
        host: address,
        port,
        username,
        database: integer(raw.database, 'Redis 数据库索引', 2147483646, 0),
        connectionOptions,
      },
    };
  const database = text(raw.database, '数据库名称', 1024, provider !== 'mysql');
  if (provider === 'postgres' || provider === 'mysql')
    return {
      name,
      config: {
        provider,
        host: address,
        port,
        username,
        database,
        connectionOptions,
      },
    };
  const authSource = text(raw.authSource, 'MongoDB 认证数据库', 63);
  for (const value of [database, authSource])
    if (
      /[\s/\\.\0"$]/u.test(value) ||
      new TextEncoder().encode(value).length > 63
    )
      throw new Error('MongoDB 数据库名称无效');
  const uri = buildConnectionSource({
    provider,
    host: address,
    port,
    username,
    password: '',
    database,
    connectionOptions,
    mongo: raw.mongo as MongoConnectionConfig['mongo'],
  }).text;
  const mongo =
    raw.mongo === undefined
      ? undefined
      : parseConnectionSource(uri, 'mongodb').fields.mongo;
  if (
    mongo &&
    (host(mongo.hosts[0].host) !== address || mongo.hosts[0].port !== port)
  )
    throw new Error('MongoDB 主机列表与主连接地址不一致');
  if (mongo?.authSource && mongo.authSource !== authSource)
    throw new Error('MongoDB 认证数据库存在两处冲突设置');
  return {
    name,
    config: {
      provider,
      host: address,
      port,
      username,
      database,
      authSource,
      connectionOptions,
      ...(mongo ? { mongo } : {}),
    },
  };
}

/** Reconstruct known public fields. Even accidental request-shaped input cannot leak secrets. */
export function snapshotTransferConnection(
  entry: TransferConnection,
): TransferConnection {
  const source = entry.config;
  if (source.provider === 'sqlite')
    return validateTransferConnection({
      name: entry.name,
      config: { provider: source.provider, path: source.path },
    });
  const config = {
    provider: source.provider,
    host: source.host,
    port: source.port,
    username: source.username,
    database: source.database,
    connectionOptions: publicConnectionOptions(
      source.provider,
      source.connectionOptions,
    ),
    ...(source.provider === 'mongodb'
      ? { authSource: source.authSource, mongo: source.mongo }
      : {}),
  };
  return validateTransferConnection({ name: entry.name, config });
}

export function createConnectionConfigBundle(
  connections: readonly TransferConnection[],
  now = new Date(),
): ConnectionConfigBundle {
  return validateConnectionConfigBundle({
    format: 'fouc-connection-config',
    version: 1,
    exportedAt: now.toISOString(),
    connections: connections.map(snapshotTransferConnection),
  });
}
export function validateConnectionConfigBundle(
  value: unknown,
): ConnectionConfigBundle {
  const raw = object(value, '配置文件');
  keys(raw, ['format', 'version', 'exportedAt', 'connections'], '配置文件');
  if (raw.format !== 'fouc-connection-config' || raw.version !== 1)
    throw new Error('仅支持当前 Fouc 配置文件格式与版本');
  const exportedAt = text(raw.exportedAt, '导出时间', 40);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(exportedAt) ||
    Number.isNaN(Date.parse(exportedAt)) ||
    new Date(exportedAt).toISOString() !== exportedAt
  )
    throw new Error('配置文件导出时间无效');
  if (
    !Array.isArray(raw.connections) ||
    raw.connections.length < 1 ||
    raw.connections.length > CONNECTION_CONFIG_LIMITS.connections
  )
    throw new Error('配置文件须包含 1–500 个连接');
  const connections = raw.connections.map((entry, index) => {
    try {
      return validateTransferConnection(entry);
    } catch (error) {
      throw new Error(
        `第 ${index + 1} 个连接：${error instanceof Error ? error.message : '配置无效'}`,
      );
    }
  });
  const bundle: ConnectionConfigBundle = {
    format: 'fouc-connection-config',
    version: 1,
    exportedAt,
    connections,
  };
  if (
    new TextEncoder().encode(JSON.stringify(bundle)).length >
    CONNECTION_CONFIG_LIMITS.plainBytes
  )
    throw new Error('公开连接配置超过 2 MiB 限制');
  return bundle;
}
export function parseConnectionConfigBundle(
  source: string,
): ConnectionConfigBundle {
  if (
    new TextEncoder().encode(source).length >
    CONNECTION_CONFIG_LIMITS.plainBytes
  )
    throw new Error('公开配置文件不能超过 2 MiB');
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('配置文件不是有效 JSON');
  }
  return validateConnectionConfigBundle(value);
}
