import {
  createPrivateKey,
  createPublicKey,
  X509Certificate,
} from 'node:crypto';
import { createConnection, isIP } from 'node:net';
import {
  checkServerIdentity,
  createSecureContext,
  type ConnectionOptions as TlsOptions,
} from 'node:tls';
import type { MongoClientOptions } from 'mongodb';
import {
  publicConnectionOptions,
  resolveConnectionOptions,
  type NativeNetworkProvider,
  type ResolvedDatabaseConnectionOptions,
} from '@fouc/shared/connection-options';
import { parseConnectionSource } from '@fouc/shared/connection-options-url';
import { DatabaseInputError } from './input-error';

export function publicNativeConnectionOptions(
  provider: NativeNetworkProvider,
  value: unknown,
  defaultTls = false,
) {
  try {
    return publicConnectionOptions(provider, value, defaultTls);
  } catch (error) {
    throw new DatabaseInputError(
      error instanceof Error ? error.message : '连接参数无效',
    );
  }
}

export function nativeConnectionOptions(
  provider: NativeNetworkProvider,
  value: unknown,
  defaultTls = false,
): ResolvedDatabaseConnectionOptions {
  let options: ResolvedDatabaseConnectionOptions;
  try {
    options = resolveConnectionOptions(provider, value, defaultTls);
  } catch (error) {
    throw new DatabaseInputError(
      error instanceof Error ? error.message : '连接参数无效',
    );
  }
  if (!options.tls.enabled) return options;
  try {
    const certificates = (text: string) => {
      const parts =
        text.match(
          /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
        ) ?? [];
      if (
        !parts.length ||
        text
          .replace(
            /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
            '',
          )
          .trim()
      )
        throw new Error('证书文件包含非 PEM CERTIFICATE 内容');
      return parts.map((part) => new X509Certificate(part));
    };
    if (options.tls.caPem) certificates(options.tls.caPem);
    if (options.tls.certificatePem && options.tls.privateKeyPem) {
      const certificate = certificates(options.tls.certificatePem)[0],
        key = createPrivateKey({
          key: options.tls.privateKeyPem,
          format: 'pem',
          passphrase: options.tls.privateKeyPassphrase,
        });
      const fromCertificate = certificate.publicKey.export({
          format: 'der',
          type: 'spki',
        }),
        fromKey = createPublicKey(key).export({ format: 'der', type: 'spki' });
      if (!fromCertificate.equals(fromKey))
        throw new Error('客户端证书与私钥不匹配');
    }
    createSecureContext({
      ca: options.tls.caPem,
      cert: options.tls.certificatePem,
      key: options.tls.privateKeyPem,
      passphrase: options.tls.privateKeyPassphrase,
      minVersion: options.tls.minVersion,
    });
  } catch (error) {
    throw new DatabaseInputError(
      `TLS 文件不可用：${error instanceof Error ? error.message : '证书或私钥无法读取'}`,
    );
  }
  return options;
}

function tlsOptions(
  options: ResolvedDatabaseConnectionOptions,
  expectedHost?: string,
): TlsOptions | undefined {
  if (!options.tls.enabled) return undefined;
  return {
    rejectUnauthorized: true,
    checkServerIdentity: (hostname, certificate) =>
      checkServerIdentity(
        options.tls.serverName || expectedHost || hostname,
        certificate,
      ),
    servername: options.tls.serverName || undefined,
    minVersion: options.tls.minVersion,
    ca: options.tls.caPem,
    cert: options.tls.certificatePem,
    key: options.tls.privateKeyPem,
    passphrase: options.tls.privateKeyPassphrase,
  };
}
export function postgresNativeConnectionOptions(value: unknown, host: string) {
  const settings = nativeConnectionOptions('postgres', value);
  // node-postgres derives SNI from DNS hosts; IP/tunnel addresses preserve explicit SNI.
  if (
    settings.tls.enabled &&
    settings.tls.serverName &&
    !isIP(host) &&
    settings.tls.serverName.toLowerCase().replace(/\.$/, '') !== host.toLowerCase().replace(/\.$/, '')
  )
    throw new DatabaseInputError(
      'PostgreSQL 自定义 TLS 服务器名称需要以 IP / 隧道地址连接，或与连接主机一致',
    );
  return {
    settings,
    options: {
      ssl: tlsOptions(settings, host),
      connectionTimeoutMillis: settings.connectTimeoutMs,
      idleTimeoutMillis: settings.idleTimeoutMs!,
      query_timeout: settings.queryTimeoutMs,
    },
  };
}
export function mysqlNativeConnectionOptions(
  value: unknown,
  host: string,
  port: number,
) {
  const settings = nativeConnectionOptions('mysql', value),
    serverHost =
      settings.tls.enabled && settings.tls.serverName
        ? settings.tls.serverName
        : host;
  return {
    settings,
    options: {
      host: serverHost,
      // mysql2 derives SNI from its host. A routed stream keeps TCP on the requested address.
      ...(serverHost !== host
        ? { stream: () => createConnection({ host, port }) }
        : {}),
      ssl: settings.tls.enabled
        ? {
            rejectUnauthorized: true,
            verifyIdentity: true,
            minVersion: settings.tls.minVersion,
            ca: settings.tls.caPem,
            cert: settings.tls.certificatePem,
            key: settings.tls.privateKeyPem,
            passphrase: settings.tls.privateKeyPassphrase,
          }
        : undefined,
      connectTimeout: settings.connectTimeoutMs,
      idleTimeout: settings.idleTimeoutMs!,
    },
  };
}
/** The Redis session owner owns the client and receives only actual ioredis option keys. */
export function redisNativeConnectionOptions(value: unknown, host: string) {
  const settings = nativeConnectionOptions('redis', value);
  return {
    settings,
    options: {
      tls: tlsOptions(settings, host),
      connectTimeout: settings.connectTimeoutMs,
      commandTimeout: settings.queryTimeoutMs,
    },
  };
}
export function mongoNativeConnectionOptions(value: unknown, uri: string) {
  let parsed: ReturnType<typeof parseConnectionSource>;
  try {
    parsed = parseConnectionSource(uri, 'mongodb');
  } catch (error) {
    throw new DatabaseInputError(
      error instanceof Error ? error.message : 'MongoDB URI 无效',
    );
  }
  const input =
      value && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {},
    requested = input.connectionOptions;
  const merged =
    requested && typeof requested === 'object' && !Array.isArray(requested)
      ? {
          ...parsed.fields.connectionOptions,
          ...requested,
          tls:
            'tls' in requested
              ? requested.tls &&
                typeof requested.tls === 'object' &&
                !Array.isArray(requested.tls)
                ? { ...parsed.fields.connectionOptions.tls, ...requested.tls }
                : requested.tls
              : parsed.fields.connectionOptions.tls,
        }
      : (requested ?? parsed.fields.connectionOptions);
  const settings = nativeConnectionOptions(
    'mongodb',
    merged,
    parsed.fields.mongo?.srv === true,
  );
  if (
    requested !== undefined &&
    parsed.fields.connectionOptions.tls?.enabled !== settings.tls.enabled &&
    /[?&](?:tls|ssl)=/i.test(uri)
  )
    throw new DatabaseInputError('MongoDB URI 与高级设置中的 TLS 开关冲突');
  const nodeTls = tlsOptions(settings),
    options: MongoClientOptions = {
      tls: settings.tls.enabled,
      serverSelectionTimeoutMS: settings.connectTimeoutMs,
      connectTimeoutMS: settings.connectTimeoutMs,
      socketTimeoutMS: settings.queryTimeoutMs,
      maxIdleTimeMS: settings.idleTimeoutMs!,
      ...(nodeTls
        ? {
            rejectUnauthorized: true,
            checkServerIdentity: nodeTls.checkServerIdentity,
            servername: nodeTls.servername,
            ca: nodeTls.ca,
            cert: nodeTls.cert,
            key: nodeTls.key,
            passphrase: nodeTls.passphrase,
            secureContext: createSecureContext({
              ca: nodeTls.ca,
              cert: nodeTls.cert,
              key: nodeTls.key,
              passphrase: nodeTls.passphrase,
              minVersion: settings.tls.minVersion,
            }),
          }
        : {}),
    };
  return { settings, options };
}
