import { describe, expect, test } from 'bun:test';
import { generateKeyPairSync } from 'node:crypto';
import { rootCertificates } from 'node:tls';
import {
  mongoNativeConnectionOptions,
  mysqlNativeConnectionOptions,
  nativeConnectionOptions,
  postgresNativeConnectionOptions,
  redisNativeConnectionOptions,
} from './connection-options';

describe('native verified TLS options P0', () => {
  test('all native adapters keep certificate and hostname verification enabled', () => {
    const input = {
      tls: { enabled: true, caPem: rootCertificates[0], minVersion: 'TLSv1.3' },
    };
    const pg = postgresNativeConnectionOptions(input, 'db.example');
    expect(pg.options.ssl?.rejectUnauthorized).toBe(true);
    expect(pg.options.ssl?.minVersion).toBe('TLSv1.3');
    expect(typeof pg.options.ssl?.checkServerIdentity).toBe('function');
    const mysql = mysqlNativeConnectionOptions(input, 'db.example', 3306);
    expect(mysql.options.ssl?.rejectUnauthorized).toBe(true);
    expect(mysql.options.ssl?.verifyIdentity).toBe(true);
    const redis = redisNativeConnectionOptions(input, 'db.example');
    expect(redis.options.tls?.rejectUnauthorized).toBe(true);
    expect(typeof redis.options.tls?.checkServerIdentity).toBe('function');
    expect(redis.settings.idleTimeoutMs).toBeNull();
    const mongo = mongoNativeConnectionOptions(
      { connectionOptions: input },
      'mongodb://db.example/app?tls=true',
    );
    expect(mongo.options.rejectUnauthorized).toBe(true);
    expect(typeof mongo.options.checkServerIdentity).toBe('function');
    expect(mongo.options.secureContext).toBeDefined();
  });

  test('timeouts reach actual provider option keys and URI partial settings retain the rest', () => {
    const input = {
      connectTimeoutMs: 12000,
      queryTimeoutMs: 45000,
      idleTimeoutMs: 15000,
    };
    const pg = postgresNativeConnectionOptions(input, 'localhost');
    expect(pg.options.connectionTimeoutMillis).toBe(12000);
    expect(pg.options.query_timeout).toBe(45000);
    expect(pg.options.idleTimeoutMillis).toBe(15000);
    expect(
      mysqlNativeConnectionOptions(input, 'localhost', 3306).options
        .connectTimeout,
    ).toBe(12000);
    const redis = redisNativeConnectionOptions(
      { connectTimeoutMs: 12000, queryTimeoutMs: 45000 },
      'localhost',
    );
    expect(redis.options.commandTimeout).toBe(45000);
    const mongo = mongoNativeConnectionOptions(
      { connectionOptions: { connectTimeoutMs: 12000 } },
      'mongodb://localhost/app?socketTimeoutMS=45000&maxIdleTimeMS=15000',
    );
    expect(mongo.options.connectTimeoutMS).toBe(12000);
    expect(mongo.options.socketTimeoutMS).toBe(45000);
    expect(mongo.options.maxIdleTimeMS).toBe(15000);
    expect(() =>
      mongoNativeConnectionOptions(
        { connectionOptions: { tls: { enabled: false } } },
        'mongodb://localhost/app?tls=true',
      ),
    ).toThrow('冲突');
    expect(() =>
      mongoNativeConnectionOptions(
        { connectionOptions: { tls: 'invalid' } },
        'mongodb://localhost/app',
      ),
    ).toThrow('TLS 参数无效');
  });

  test('custom verified names respect actual driver SNI behavior', () => {
    const input = { tls: { enabled: true, serverName: 'db.example' } };
    const pg = postgresNativeConnectionOptions(input, '127.0.0.1');
    expect(pg.options.ssl?.servername).toBe('db.example');
    expect(() =>
      postgresNativeConnectionOptions(input, 'different.example'),
    ).toThrow('IP / 隧道');
    const mysql = mysqlNativeConnectionOptions(input, '127.0.0.1', 3306);
    expect(mysql.options.host).toBe('db.example');
    expect(typeof mysql.options.stream).toBe('function');
    expect(
      redisNativeConnectionOptions(input, '127.0.0.1').options.tls?.servername,
    ).toBe('db.example');
    expect(() =>
      mongoNativeConnectionOptions(
        {},
        'mongodb://localhost/app?tlsInsecure=true',
      ),
    ).toThrow('关闭');
  });

  test('PEM is parsed by crypto, private keys must match the client certificate', () => {
    expect(() =>
      nativeConnectionOptions('mysql', {
        tls: {
          enabled: true,
          caPem:
            '-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----',
        },
      }),
    ).toThrow('TLS 文件不可用');
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    expect(() =>
      nativeConnectionOptions('mysql', {
        tls: {
          enabled: true,
          certificatePem: rootCertificates[0],
          privateKeyPem: pem,
        },
      }),
    ).toThrow('不匹配');
    const encrypted = privateKey
      .export({
        type: 'pkcs8',
        format: 'pem',
        cipher: 'aes-256-cbc',
        passphrase: 'only-test',
      })
      .toString();
    expect(() =>
      nativeConnectionOptions('mysql', {
        tls: {
          enabled: true,
          certificatePem: rootCertificates[0],
          privateKeyPem: encrypted,
          privateKeyPassphrase: 'wrong',
        },
      }),
    ).toThrow('TLS 文件不可用');
  });
});
