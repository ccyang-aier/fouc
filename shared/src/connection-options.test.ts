import { describe, expect, test } from 'bun:test';
import {
  defaultConnectionOptions,
  publicConnectionOptions,
  resolveConnectionOptions,
} from './connection-options';
import { buildConnectionSource, parseConnectionSource } from './connection-options-url';

const certificate = '-----BEGIN CERTIFICATE-----\nVEVTVA==\n-----END CERTIFICATE-----';
const privateKey = '-----BEGIN PRIVATE KEY-----\nVEVTVA==\n-----END PRIVATE KEY-----';

describe('native connection options P0', () => {
  test('secrets never enter public profiles and required material is re-requested', () => {
    const publicValue = publicConnectionOptions('postgres', {
      tls: {
        enabled: true,
        caPem: certificate,
        certificatePem: certificate,
        privateKeyPem: privateKey,
        privateKeyPassphrase: 'request-only',
      },
    });
    expect(Object.keys(publicValue.tls).sort()).toEqual([
      'caRequired',
      'clientCertificateRequired',
      'enabled',
      'minVersion',
      'serverName',
    ]);
    expect(publicValue.tls.caRequired).toBe(true);
    expect(publicValue.tls.clientCertificateRequired).toBe(true);
    expect(JSON.stringify(publicValue)).not.toContain('request-only');
    expect(JSON.stringify(publicValue)).not.toContain('VEVTVA');
    expect(() => resolveConnectionOptions('postgres', publicValue)).toThrow('重新提供 CA');
    expect(() =>
      resolveConnectionOptions('postgres', {
        tls: { enabled: true, certificatePem: certificate },
      }),
    ).toThrow('同时提供');
    expect(() =>
      resolveConnectionOptions('postgres', {
        tls: { enabled: true, privateKeyPassphrase: 'secret' },
      }),
    ).toThrow('同时提供');
  });

  test('all waits bounded, Redis has no fabricated pool idle option, TLS cannot bypass validation', () => {
    expect(defaultConnectionOptions('redis').idleTimeoutMs).toBeNull();
    expect(() => resolveConnectionOptions('redis', { idleTimeoutMs: 1000 })).toThrow('不支持');
    expect(() => resolveConnectionOptions('mysql', { queryTimeoutMs: 0 })).toThrow('超时');
    expect(() => resolveConnectionOptions('mysql', { connectTimeoutMs: 300_001 })).toThrow('超时');
    expect(() =>
      resolveConnectionOptions('postgres', {
        tls: { enabled: true, rejectUnauthorized: false },
      }),
    ).toThrow('不支持');
    expect(() =>
      resolveConnectionOptions('postgres', {
        tls: { enabled: false, caPem: certificate },
      }),
    ).toThrow('启用 TLS');
    expect(
      resolveConnectionOptions('postgres', {
        tls: {
          enabled: true,
          serverName: 'DB.Example.COM',
          minVersion: 'TLSv1.3',
        },
      }).tls.serverName,
    ).toBe('db.example.com');
    expect(() =>
      resolveConnectionOptions('postgres', {
        tls: { enabled: true, serverName: '127.0.0.1' },
      }),
    ).toThrow('DNS');
    expect(() =>
      resolveConnectionOptions('postgres', {
        tls: { enabled: true, serverName: 'db.example.com\\evil' },
      }),
    ).toThrow('DNS');
  });

  test('URL encodings, IPv6 and password omission round-trip without silent coercion', () => {
    const parsed = parseConnectionSource(
      'postgresql://u%40ser:p%3Aa%2Fss@[2001:db8::1]:5440/my%2Fdb?sslmode=verify-full&connect_timeout=15&options=-c%20statement_timeout%3D45000',
      'postgres',
    );
    expect(parsed.fields.host).toBe('2001:db8::1');
    expect(parsed.fields.port).toBe(5440);
    expect(parsed.fields.username).toBe('u@ser');
    expect(parsed.fields.password).toBe('p:a/ss');
    expect(parsed.fields.database).toBe('my/db');
    expect(parsed.fields.connectionOptions.queryTimeoutMs).toBe(45000);
    const safe = buildConnectionSource(parsed.fields);
    expect(safe.containsPassword).toBe(false);
    expect(safe.text).not.toContain('p%3Aa');
    expect(parseConnectionSource(safe.text).fields.password).toBe('');
    const withPassword = parseConnectionSource(
      buildConnectionSource(parsed.fields, 'url', true).text,
    );
    expect(withPassword.fields.password).toBe('p:a/ss');
    expect(withPassword.fields.connectionOptions.connectTimeoutMs).toBe(15000);
    expect(() => parseConnectionSource('postgresql://u:p%ZZ@localhost/db')).toThrow('转义');
    expect(() => parseConnectionSource('postgresql://localhost/db#sslmode=disable')).toThrow(
      '片段',
    );
  });

  test('quoted libpq DSN and JDBC query credentials are actual supported inputs', () => {
    const parsed = parseConnectionSource(
      "host='db.example' port=5433 user='a b' password='quote\\\' and \\\\ slash' dbname='my db' sslmode=verify-full options='-c statement_timeout=60s'",
      'postgres',
    );
    expect(parsed.fields.password).toBe("quote' and \\ slash");
    expect(
      parseConnectionSource("host=localhost password='secret://value' dbname=app", 'postgres')
        .fields.password,
    ).toBe('secret://value');
    expect(parsed.fields.connectionOptions.queryTimeoutMs).toBe(60000);
    expect(
      parseConnectionSource(buildConnectionSource(parsed.fields, 'dsn', true).text).fields,
    ).toEqual(parsed.fields);
    expect(
      parseConnectionSource(
        'jdbc:mysql://localhost:3307/app?user=dev&password=p%26ss&connectTimeout=12000&sslMode=VERIFY_IDENTITY',
      ).fields.password,
    ).toBe('p&ss');
    expect(() => parseConnectionSource('jdbc:mysql://dev@localhost/app?user=duplicate')).toThrow(
      '两处',
    );
    expect(() => parseConnectionSource('host=localhost host=other')).toThrow('重复');
    expect(() => parseConnectionSource("host='unclosed")).toThrow('未闭合');
  });

  test('unsupported and insecure parameters surface errors before any settings are applied', () => {
    for (const source of [
      'postgresql://localhost/db?sslmode=require',
      'mysql://localhost/db?sslMode=VERIFY_CA',
      'mongodb://localhost/db?tlsAllowInvalidCertificates=true',
      'rediss://localhost/0?tls=false',
      'postgresql://localhost/db?sslrootcert=C%3A%2Fca.pem',
      'mysql://localhost/db?unknownFlag=yes',
      'mysql://localhost/db?connectTimeout=10000&connectTimeoutMS=11000',
      'mysql://localhost/db?sslMode=DISABLED&tls=true',
    ])
      expect(() => parseConnectionSource(source)).toThrow();
    expect(
      parseConnectionSource('mongodb://localhost/db?tls=true&tlsAllowInvalidCertificates=false')
        .warnings[0].message,
    ).toContain('始终开启');
    expect(() => parseConnectionSource('mysql://localhost/db', 'postgres')).toThrow('不一致');
  });

  test('Redis index and command timeout never collapse invalid values to database zero', () => {
    const parsed = parseConnectionSource(
      'rediss://default:p%40ss@[::1]:6380/12?commandTimeout=25000&connectTimeout=15000',
    );
    expect(parsed.fields.database).toBe('12');
    expect(parsed.fields.connectionOptions.tls?.enabled).toBe(true);
    expect(parsed.fields.connectionOptions.queryTimeoutMs).toBe(25000);
    expect(parseConnectionSource(buildConnectionSource(parsed.fields).text).fields.password).toBe(
      '',
    );
    for (const index of ['-1', 'not-a-number', '2147483647', '1.5'])
      expect(() => parseConnectionSource(`redis://localhost/${index}`)).toThrow('索引');
    expect(() => parseConnectionSource('redis://localhost/0 --tls --insecure')).toThrow('命令行');
  });

  test('MongoDB host lists, SRV defaults and native URI parameters stay intact', () => {
    const parsed = parseConnectionSource(
      'mongodb://dev:pw@db1.example:27018,db2.example:27019/app?authSource=admin&replicaSet=rs0&retryWrites=true&w=majority&readPreference=secondaryPreferred&socketTimeoutMS=20000',
    );
    expect(parsed.fields.mongo?.hosts).toEqual([
      { host: 'db1.example', port: 27018 },
      { host: 'db2.example', port: 27019 },
    ]);
    expect(parsed.warnings).toHaveLength(1);
    const roundTrip = parseConnectionSource(buildConnectionSource(parsed.fields, 'url', true).text);
    expect(roundTrip.fields.mongo).toEqual(parsed.fields.mongo);
    expect(roundTrip.fields.password).toBe('pw');
    const srv = parseConnectionSource('mongodb+srv://dev@cluster.example/app?retryWrites=true');
    expect(srv.fields.connectionOptions.tls?.enabled).toBe(true);
    expect(buildConnectionSource(srv.fields).text).toStartWith(
      'mongodb+srv://dev@cluster.example/',
    );
    for (const source of [
      'mongodb+srv://cluster.example:27017/app',
      'mongodb+srv://127.0.0.1/app',
      'mongodb+srv://cluster.example/app?directConnection=true',
      'mongodb://db1.example,db2.example/app?directConnection=true',
    ])
      expect(() => parseConnectionSource(source)).toThrow();
  });

  test('generation reports settings a native URL cannot represent', () => {
    const fields = parseConnectionSource('mysql://localhost/app').fields;
    fields.connectionOptions = {
      queryTimeoutMs: 40000,
      idleTimeoutMs: 50000,
      tls: {
        enabled: true,
        minVersion: 'TLSv1.3',
        caRequired: true,
        serverName: 'db.example',
      },
    };
    const built = buildConnectionSource(fields);
    expect(built.warnings).toHaveLength(5);
    expect(built.text).not.toContain('caRequired');
    expect(() =>
      buildConnectionSource(
        {
          ...fields,
          provider: 'postgres',
          connectionOptions: { connectTimeoutMs: 12345 },
        },
        'dsn',
      ),
    ).toThrow('整秒');
  });
});
