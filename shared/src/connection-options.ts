/** Native connection options. PEM material belongs to connection requests, never saved profiles. */
export type NativeNetworkProvider = 'postgres' | 'mysql' | 'redis' | 'mongodb';
export type ConnectionTlsVersion = 'TLSv1.2' | 'TLSv1.3';
export type DatabaseConnectionTls = {
  enabled: boolean;
  serverName: string;
  minVersion: ConnectionTlsVersion;
  caRequired: boolean;
  clientCertificateRequired: boolean;
};
export type DatabaseConnectionOptions = {
  connectTimeoutMs: number;
  queryTimeoutMs: number;
  idleTimeoutMs: number | null;
  tls: DatabaseConnectionTls;
};
export type DatabaseConnectionTlsSecrets = {
  caPem?: string;
  certificatePem?: string;
  privateKeyPem?: string;
  privateKeyPassphrase?: string;
};
export type DatabaseConnectionOptionsInput = Omit<
  Partial<DatabaseConnectionOptions>,
  'tls'
> & { tls?: Partial<DatabaseConnectionTls> & DatabaseConnectionTlsSecrets };
export type ResolvedDatabaseConnectionOptions = DatabaseConnectionOptions & {
  tls: DatabaseConnectionTls & DatabaseConnectionTlsSecrets;
};
export const CONNECTION_OPTIONS_LIMITS = {
  connectMin: 1000,
  connectMax: 300_000,
  queryMin: 1000,
  queryMax: 3_600_000,
  idleMin: 1000,
  idleMax: 3_600_000,
  pemBytes: 262_144,
  passphraseCharacters: 4096,
} as const;
export function defaultConnectionOptions(
  provider: NativeNetworkProvider,
  tls = false,
): DatabaseConnectionOptions {
  return {
    connectTimeoutMs: 10_000,
    queryTimeoutMs: provider === 'redis' ? 10_000 : 30_000,
    idleTimeoutMs:
      provider === 'redis' ? null : provider === 'mongodb' ? 60_000 : 30_000,
    tls: {
      enabled: tls,
      serverName: '',
      minVersion: 'TLSv1.2',
      caRequired: false,
      clientCertificateRequired: false,
    },
  };
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
/** Shared validation gives the form and native adapter the same bounded contract. */
export function resolveConnectionOptions(
  provider: NativeNetworkProvider,
  value: unknown,
  defaultTls = false,
  requireSecrets = true,
): ResolvedDatabaseConnectionOptions {
  const defaults = defaultConnectionOptions(provider, defaultTls);
  if (value === undefined) return defaults;
  if (!record(value)) throw new Error('高级连接参数无效');
  for (const key of Object.keys(value))
    if (
      !['connectTimeoutMs', 'queryTimeoutMs', 'idleTimeoutMs', 'tls'].includes(
        key,
      )
    )
      throw new Error(`不支持的连接参数：${key}`);
  if (
    provider === 'redis' &&
    value.idleTimeoutMs !== undefined &&
    value.idleTimeoutMs !== null
  )
    throw new Error('Redis 持久会话不支持连接池空闲回收超时');
  const duration = (
    name: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ) => {
    const raw = value[name];
    if (raw === undefined) return fallback;
    if (
      typeof raw !== 'number' ||
      !Number.isInteger(raw) ||
      raw < minimum ||
      raw > maximum
    )
      throw new Error(
        `${name === 'connectTimeoutMs' ? '连接' : name === 'queryTimeoutMs' ? '查询' : '空闲'}超时必须为 ${minimum / 1000}–${maximum / 1000} 秒`,
      );
    return raw;
  };
  const tls: ResolvedDatabaseConnectionOptions['tls'] = { ...defaults.tls };
  if (value.tls !== undefined) {
    if (!record(value.tls)) throw new Error('TLS 参数无效');
    const raw = value.tls;
    for (const key of Object.keys(raw))
      if (
        ![
          'enabled',
          'serverName',
          'minVersion',
          'caRequired',
          'clientCertificateRequired',
          'caPem',
          'certificatePem',
          'privateKeyPem',
          'privateKeyPassphrase',
        ].includes(key)
      )
        throw new Error(`不支持的 TLS 参数：${key}`);
    for (const key of [
      'enabled',
      'caRequired',
      'clientCertificateRequired',
    ] as const)
      if (raw[key] !== undefined) {
        if (typeof raw[key] !== 'boolean') throw new Error('TLS 开关参数无效');
        tls[key] = raw[key];
      }
    if (raw.serverName !== undefined) {
      if (
        typeof raw.serverName !== 'string' ||
        raw.serverName.length > 253 ||
        /[\s\0/@?#:\\]/u.test(raw.serverName)
      )
        throw new Error('TLS 服务器名称须为有效 DNS 名称');
      if (raw.serverName) {
        try {
          const normalized = new URL(`https://${raw.serverName}`).hostname;
          if (
            !/^(?=.{1,253}\.?$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.?$/.test(
              normalized,
            ) ||
            /^\d+\.\d+\.\d+\.\d+$/.test(normalized)
          )
            throw new Error();
          tls.serverName = normalized;
        } catch {
          throw new Error('TLS 服务器名称须为有效 DNS 名称，而非 IP 或 URL');
        }
      } else tls.serverName = '';
    }
    if (raw.minVersion !== undefined) {
      if (raw.minVersion !== 'TLSv1.2' && raw.minVersion !== 'TLSv1.3')
        throw new Error('最低 TLS 版本只支持 1.2 或 1.3');
      tls.minVersion = raw.minVersion;
    }
    for (const key of ['caPem', 'certificatePem', 'privateKeyPem'] as const)
      if (raw[key] !== undefined) {
        const text = raw[key];
        if (
          typeof text !== 'string' ||
          new TextEncoder().encode(text).length >
            CONNECTION_OPTIONS_LIMITS.pemBytes ||
          text.includes('\0')
        )
          throw new Error('PEM 文件须为不超过 256 KiB 的文本');
        if (text) {
          const pattern =
            key === 'privateKeyPem'
              ? /^\s*-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----[\s\S]+-----END (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----\s*$/
              : /^\s*-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/;
          if (!pattern.test(text))
            throw new Error(
              key === 'privateKeyPem'
                ? '客户端私钥须为 PEM 私钥文件'
                : 'CA 与客户端证书须为 PEM CERTIFICATE 文件',
            );
          tls[key] = text;
        }
      }
    if (raw.privateKeyPassphrase !== undefined) {
      if (
        typeof raw.privateKeyPassphrase !== 'string' ||
        raw.privateKeyPassphrase.length >
          CONNECTION_OPTIONS_LIMITS.passphraseCharacters ||
        raw.privateKeyPassphrase.includes('\0')
      )
        throw new Error('私钥口令无效');
      if (raw.privateKeyPassphrase)
        tls.privateKeyPassphrase = raw.privateKeyPassphrase;
    }
    if (requireSecrets && !!tls.certificatePem !== !!tls.privateKeyPem)
      throw new Error('客户端证书与私钥必须同时提供');
    if (requireSecrets && tls.privateKeyPassphrase && !tls.privateKeyPem)
      throw new Error('私钥口令需要同时提供客户端私钥');
    if (requireSecrets && tls.enabled && tls.caRequired && !tls.caPem)
      throw new Error('此连接需要重新提供 CA 证书文件');
    if (
      requireSecrets &&
      tls.enabled &&
      tls.clientCertificateRequired &&
      (!tls.certificatePem || !tls.privateKeyPem)
    )
      throw new Error('此连接需要重新提供客户端证书与私钥文件');
    if (
      !tls.enabled &&
      (tls.caPem ||
        tls.certificatePem ||
        tls.privateKeyPem ||
        tls.privateKeyPassphrase ||
        tls.serverName ||
        tls.caRequired ||
        tls.clientCertificateRequired)
    )
      throw new Error('请启用 TLS 后再提供证书、私钥或服务器名称');
  }
  return {
    connectTimeoutMs: duration(
      'connectTimeoutMs',
      defaults.connectTimeoutMs,
      CONNECTION_OPTIONS_LIMITS.connectMin,
      CONNECTION_OPTIONS_LIMITS.connectMax,
    ),
    queryTimeoutMs: duration(
      'queryTimeoutMs',
      defaults.queryTimeoutMs,
      CONNECTION_OPTIONS_LIMITS.queryMin,
      CONNECTION_OPTIONS_LIMITS.queryMax,
    ),
    idleTimeoutMs:
      provider === 'redis'
        ? null
        : duration(
            'idleTimeoutMs',
            defaults.idleTimeoutMs!,
            CONNECTION_OPTIONS_LIMITS.idleMin,
            CONNECTION_OPTIONS_LIMITS.idleMax,
          ),
    tls,
  };
}
/** Construct an allowlisted profile, rather than deleting secrets from a copy of request input. */
export function publicConnectionOptions(
  provider: NativeNetworkProvider,
  value: unknown,
  defaultTls = false,
): DatabaseConnectionOptions {
  const resolved = resolveConnectionOptions(provider, value, defaultTls, false);
  return {
    connectTimeoutMs: resolved.connectTimeoutMs,
    queryTimeoutMs: resolved.queryTimeoutMs,
    idleTimeoutMs: resolved.idleTimeoutMs,
    tls: {
      enabled: resolved.tls.enabled,
      serverName: resolved.tls.serverName,
      minVersion: resolved.tls.minVersion,
      caRequired: resolved.tls.caRequired || !!resolved.tls.caPem,
      clientCertificateRequired:
        resolved.tls.clientCertificateRequired ||
        !!resolved.tls.certificatePem ||
        !!resolved.tls.privateKeyPem,
    },
  };
}
