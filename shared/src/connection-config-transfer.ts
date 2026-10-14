import {
  validationIssueFromError,
  validationIssue,
  validationValue,
  ValidationError,
  type ValidationIssue,
  type ValidationValue,
} from './validation-issue';
import { publicConnectionOptions, type DatabaseConnectionOptions } from './connection-options';
import { buildConnectionSource, parseConnectionSource } from './connection-options-url';
import type { RelationalConnectionConfig } from './relational';
import type { RedisConnectionConfig } from './redis';
import type { MongoConnectionConfig } from './mongo-connections';
export type TransferConnectionConfig =
  RelationalConnectionConfig | RedisConnectionConfig | MongoConnectionConfig;
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
  plainBytes: 2097152,
  fileBytes: 3145728,
  nameCharacters: 120,
} as const;
function object(value: unknown, label: ValidationValue): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ValidationError(
      validationIssue('connection-config-transfer.mustBeAnObject', '{p0}须为对象', {
        p0: validationValue(label),
      }),
    );
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[], label: ValidationValue) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      throw new ValidationError(
        validationIssue(
          'connection-config-transfer.containsUnsupportedFields',
          '{p0}包含不支持的字段：{p1}',
          { p0: validationValue(label), p1: validationValue(key) },
        ),
      );
}
function text(value: unknown, label: ValidationValue, maximum: number, required = true): string {
  if (
    typeof value !== 'string' ||
    value.length > maximum ||
    /[\r\n\0]/u.test(value) ||
    (required && !value.trim())
  )
    throw new ValidationError(
      validationIssue('connection-config-transfer.invalid', '{p0}无效', {
        p0: validationValue(label),
      }),
    );
  return value;
}
function host(value: unknown): string {
  const raw = text(value, validationIssue('connection-config-transfer.host', '主机'), 253);
  if (/[\s/@?#\\]/u.test(raw))
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer.theHostMustBeADnsOrIp',
        '主机须为 DNS 或 IP 地址',
      ),
    );
  try {
    const normalized = new URL(
      `http://${raw.includes(':') && !raw.startsWith('[') ? `[${raw}]` : raw}`,
    ).hostname.replace(/^\[|\]$/g, '');
    if (!normalized.includes(':') && !/^[a-zA-Z0-9_.-]+$/.test(normalized)) throw new Error();
    return normalized;
  } catch {
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer.theHostMustBeAValidDnsOr',
        '主机须为有效 DNS 或 IP 地址',
      ),
    );
  }
}
function integer(value: unknown, label: ValidationValue, maximum: number, minimum = 1): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum)
    throw new ValidationError(
      validationIssue('connection-config-transfer.invalid', '{p0}无效', {
        p0: validationValue(label),
      }),
    );
  return value;
}
function publicOptions(
  provider: 'postgres' | 'mysql' | 'redis' | 'mongodb',
  value: unknown,
): DatabaseConnectionOptions {
  const options = object(
    value,
    validationIssue('connection-config-transfer.advancedConnectionParameters', '高级连接参数'),
  );
  keys(
    options,
    ['connectTimeoutMs', 'queryTimeoutMs', 'idleTimeoutMs', 'tls'],
    validationIssue('connection-config-transfer.advancedConnectionParameters', '高级连接参数'),
  );
  for (const key of ['connectTimeoutMs', 'queryTimeoutMs', 'idleTimeoutMs', 'tls'])
    if (!(key in options))
      throw new ValidationError(
        validationIssue(
          'connection-config-transfer.advancedConnectionParametersAreMissing',
          '高级连接参数缺少 {p0}',
          { p0: validationValue(key) },
        ),
      );
  const tls = object(
    options.tls,
    validationIssue('connection-config-transfer.tlsParameters', 'TLS 参数'),
  );
  const publicKeys = [
    'enabled',
    'serverName',
    'minVersion',
    'caRequired',
    'clientCertificateRequired',
  ];
  keys(
    tls,
    publicKeys,
    validationIssue(
      'connection-config-transfer.publicTlsParametersCertificatesPrivateKeysAndPasswords',
      '公开 TLS 参数（不接受证书、私钥或口令）',
    ),
  );
  for (const key of publicKeys)
    if (!(key in tls))
      throw new ValidationError(
        validationIssue('connection-config-transfer.tlsParametersAreMissing', 'TLS 参数缺少 {p0}', {
          p0: validationValue(key),
        }),
      );
  return publicConnectionOptions(provider, options);
}
/** Current schema only: importing secrets/URIs or silently adapting old shapes is forbidden. */
export function validateTransferConnection(value: unknown): TransferConnection {
  const entry = object(
    value,
    validationIssue('connection-config-transfer.connectionEntry', '连接条目'),
  );
  keys(
    entry,
    ['name', 'config'],
    validationIssue('connection-config-transfer.connectionEntry', '连接条目'),
  );
  const name = text(
    entry.name,
    validationIssue('connection-config-transfer.connectionName', '连接名称'),
    CONNECTION_CONFIG_LIMITS.nameCharacters,
  ).trim();
  const raw = object(
      entry.config,
      validationIssue('connection-config-transfer.connectionConfiguration', '连接配置'),
    ),
    provider = raw.provider;
  if (provider === 'sqlite') {
    keys(
      raw,
      ['provider', 'path'],
      validationIssue('connection-config-transfer.sqliteConfiguration', 'SQLite 配置'),
    );
    const path = text(
      raw.path,
      validationIssue('connection-config-transfer.sqliteFilePath', 'SQLite 文件路径'),
      4096,
    );
    if (!/^(?:[a-zA-Z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+|\/)/.test(path))
      throw new ValidationError(
        validationIssue(
          'connection-config-transfer.sqliteFilePathsMustBeAbsolute',
          'SQLite 文件路径须为绝对路径',
        ),
      );
    return { name, config: { provider, path } };
  }
  if (
    provider !== 'postgres' &&
    provider !== 'mysql' &&
    provider !== 'redis' &&
    provider !== 'mongodb'
  )
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer.configurationContainsANativeConnectionTypeThatIs',
        '配置包含当前未支持的原生连接类型',
      ),
    );
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
    validationIssue(
      'connection-config-transfer.publicConnectionConfigurationPasswordsAndUrisAreNot',
      '公开连接配置（不接受密码或 URI）',
    ),
  );
  const address = host(raw.host),
    port = integer(raw.port, validationIssue('connection-config-transfer.port', '端口'), 65535),
    username = text(
      raw.username,
      validationIssue('connection-config-transfer.username', '用户名'),
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
        database: integer(
          raw.database,
          validationIssue('connection-config-transfer.redisDatabaseIndex', 'Redis 数据库索引'),
          2147483646,
          0,
        ),
        connectionOptions,
      },
    };
  const database = text(
    raw.database,
    validationIssue('connection-config-transfer.databaseName', '数据库名称'),
    1024,
    provider !== 'mysql',
  );
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
  const authSource = text(
    raw.authSource,
    validationIssue(
      'connection-config-transfer.mongodbAuthenticationDatabase',
      'MongoDB 认证数据库',
    ),
    63,
  );
  for (const value of [database, authSource])
    if (/[\s/\\.\0"$]/u.test(value) || new TextEncoder().encode(value).length > 63)
      throw new ValidationError(
        validationIssue(
          'connection-config-transfer.invalidMongodbDatabaseName',
          'MongoDB 数据库名称无效',
        ),
      );
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
    raw.mongo === undefined ? undefined : parseConnectionSource(uri, 'mongodb').fields.mongo;
  if (mongo && (host(mongo.hosts[0].host) !== address || mongo.hosts[0].port !== port))
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer.mongodbHostListDoesNotMatchThePrimary',
        'MongoDB 主机列表与主连接地址不一致',
      ),
    );
  if (mongo?.authSource && mongo.authSource !== authSource)
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer.mongodbAuthenticationDatabaseHasTwoConflictingSettings',
        'MongoDB 认证数据库存在两处冲突设置',
      ),
    );
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
export function snapshotTransferConnection(entry: TransferConnection): TransferConnection {
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
    connectionOptions: publicConnectionOptions(source.provider, source.connectionOptions),
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
export function validateConnectionConfigBundle(value: unknown): ConnectionConfigBundle {
  const raw = object(
    value,
    validationIssue('connection-config-transfer.configurationFile', '配置文件'),
  );
  keys(
    raw,
    ['format', 'version', 'exportedAt', 'connections'],
    validationIssue('connection-config-transfer.configurationFile', '配置文件'),
  );
  if (raw.format !== 'fouc-connection-config' || raw.version !== 1)
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer.onlyTheCurrentFoucConfigurationFileFormatAnd',
        '仅支持当前 Fouc 配置文件格式与版本',
      ),
    );
  const exportedAt = text(
    raw.exportedAt,
    validationIssue('connection-config-transfer.exportTime', '导出时间'),
    40,
  );
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(exportedAt) ||
    Number.isNaN(Date.parse(exportedAt)) ||
    new Date(exportedAt).toISOString() !== exportedAt
  )
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer.invalidConfigurationFileExportTime',
        '配置文件导出时间无效',
      ),
    );
  if (
    !Array.isArray(raw.connections) ||
    raw.connections.length < 1 ||
    raw.connections.length > CONNECTION_CONFIG_LIMITS.connections
  )
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer.configurationFilesMustContainConnections',
        '配置文件须包含 1–500 个连接',
      ),
    );
  const connections = raw.connections.map((entry, index) => {
    try {
      return validateTransferConnection(entry);
    } catch (error) {
      throw new ValidationError(
        validationIssue('connection-config-transfer.connection', '第 {p0} 个连接：{p1}', {
          p0: validationValue(index + 1),
          p1: validationValue(validationIssueFromError(error)),
        }),
      );
    }
  });
  const bundle: ConnectionConfigBundle = {
    format: 'fouc-connection-config',
    version: 1,
    exportedAt,
    connections,
  };
  if (new TextEncoder().encode(JSON.stringify(bundle)).length > CONNECTION_CONFIG_LIMITS.plainBytes)
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer.publicConnectionConfigurationExceedsTheMibLimit',
        '公开连接配置超过 2 MiB 限制',
      ),
    );
  return bundle;
}
export function parseConnectionConfigBundle(source: string): ConnectionConfigBundle {
  if (new TextEncoder().encode(source).length > CONNECTION_CONFIG_LIMITS.plainBytes)
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer.publicConfigurationFilesMustNotExceedMib',
        '公开配置文件不能超过 2 MiB',
      ),
    );
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer.configurationFileIsNotValidJson',
        '配置文件不是有效 JSON',
      ),
    );
  }
  return validateConnectionConfigBundle(value);
}
