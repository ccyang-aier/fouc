import { describe, expect, test } from 'bun:test';
import { defaultConnectionOptions } from './connection-options';
import {
  createConnectionConfigBundle,
  parseConnectionConfigBundle,
  validateConnectionConfigBundle,
  type TransferConnection,
} from './connection-config-transfer';
import {
  decodeConnectionConfigFile,
  encryptConnectionConfig,
} from './connection-config-transfer-crypto';
import {
  defaultConnectionImportChoices,
  prepareConnectionImport,
  type ExistingTransferConnection,
} from './connection-config-transfer-plan';

function connection(name = 'Primary'): TransferConnection {
  return {
    name,
    config: {
      provider: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'dev',
      database: 'app',
      connectionOptions: defaultConnectionOptions('postgres'),
    },
  };
}
function existing(
  name = 'Primary',
  id = 'existing',
): ExistingTransferConnection {
  return { ...connection(name), id, updatedAt: 1 };
}

describe('public connection config transfer P0', () => {
  test('snapshots reconstruct public fields and never export secrets or internal source fields', () => {
    const base = connection();
    if (base.config.provider === 'sqlite') throw new Error();
    const secret =
      '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----';
    const source = {
      ...base,
      id: 'private-id',
      internalAnchor: 'private-anchor',
      config: {
        ...base.config,
        password: 'temporary-password',
        uri: 'postgres://dev:password@localhost/app',
        connectionOptions: {
          ...base.config.connectionOptions,
          tls: {
            ...base.config.connectionOptions.tls,
            enabled: true,
            caPem: secret,
            certificatePem: secret,
            privateKeyPem:
              '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----',
            privateKeyPassphrase: 'private-passphrase',
          },
        },
      },
    };
    const bundle = createConnectionConfigBundle([source]),
      text = JSON.stringify(bundle);
    for (const material of [
      'private-id',
      'private-anchor',
      'temporary-password',
      'postgres://',
      'private-passphrase',
      'BEGIN CERTIFICATE',
      'BEGIN PRIVATE KEY',
    ])
      expect(text).not.toContain(material);
    const config = bundle.connections[0].config;
    expect(
      config.provider !== 'sqlite' && config.connectionOptions.tls.caRequired,
    ).toBe(true);
    expect(
      config.provider !== 'sqlite' &&
        config.connectionOptions.tls.clientCertificateRequired,
    ).toBe(true);
    expect(parseConnectionConfigBundle(text)).toEqual(bundle);
  });

  test('strict current schema rejects unknown/credential fields and incomplete or invalid later records', () => {
    const bundle = createConnectionConfigBundle([connection()]);
    expect(() =>
      validateConnectionConfigBundle({ ...bundle, version: 2 }),
    ).toThrow('版本');
    expect(() =>
      validateConnectionConfigBundle({ ...bundle, unexpected: 'foreign' }),
    ).toThrow('字段');
    expect(() =>
      validateConnectionConfigBundle({
        ...bundle,
        connections: [
          {
            ...connection(),
            config: { ...connection().config, password: 'secret' },
          },
        ],
      }),
    ).toThrow('密码');
    expect(() =>
      validateConnectionConfigBundle({
        ...bundle,
        connections: [
          connection(),
          {
            ...connection('Invalid'),
            config: { ...connection().config, port: 65536 },
          },
        ],
      }),
    ).toThrow('第 2');
    expect(() =>
      validateConnectionConfigBundle({
        ...bundle,
        connections: [
          {
            ...connection(),
            config: {
              ...connection().config,
              connectionOptions: { tls: { enabled: false } },
            },
          },
        ],
      }),
    ).toThrow('缺少');
    expect(() => parseConnectionConfigBundle('[]')).toThrow('对象');
    expect(() =>
      validateConnectionConfigBundle({
        ...bundle,
        connections: [
          {
            name: 'SQLite',
            config: { provider: 'sqlite', path: 'relative.db' },
          },
        ],
      }),
    ).toThrow('绝对');
    expect(() =>
      validateConnectionConfigBundle({
        ...bundle,
        connections: [
          {
            name: 'Redis',
            config: {
              provider: 'redis',
              host: 'localhost',
              port: 6379,
              username: '',
              database: -1,
              connectionOptions: defaultConnectionOptions('redis'),
            },
          },
        ],
      }),
    ).toThrow('索引');
  });

  test('preview handles repeated names, explicit replacement and exact target validation', () => {
    const bundle = createConnectionConfigBundle([connection(), connection()]);
    const choices = defaultConnectionImportChoices(bundle, [existing()]);
    expect(choices).toEqual([
      { mode: 'create', name: 'Primary (2)' },
      { mode: 'create', name: 'Primary (3)' },
    ]);
    expect(
      prepareConnectionImport(bundle, [existing()], choices).create,
    ).toBe(2);
    const update = prepareConnectionImport(
      bundle,
      [existing()],
      [{ mode: 'update', targetId: 'existing' }, { mode: 'skip' }],
    );
    expect(update.update).toBe(1);
    expect(update.skip).toBe(1);
    expect(update.operations[0].targetId).toBe('existing');
    expect(() =>
      prepareConnectionImport(
        bundle,
        [existing()],
        [{ mode: 'create', name: 'PRIMARY' }, { mode: 'skip' }],
      ),
    ).toThrow('冲突');
    expect(() =>
      prepareConnectionImport(
        bundle,
        [existing()],
        [
          { mode: 'update', targetId: 'existing' },
          { mode: 'update', targetId: 'existing' },
        ],
      ),
    ).toThrow('重复更新');
    expect(() =>
      prepareConnectionImport(
        bundle,
        [existing()],
        [{ mode: 'update', targetId: 'missing' }, { mode: 'skip' }],
      ),
    ).toThrow('更新目标无效');
    expect(() =>
      prepareConnectionImport(
        bundle,
        [existing('Changed')],
        [{ mode: 'update', targetId: 'existing' }, { mode: 'skip' }],
      ),
    ).toThrow('名称已变化');
  });

  test('AES-GCM round-trip authenticates data and metadata with independent random salt and IV', async () => {
    const bundle = createConnectionConfigBundle([connection()]),
      passphrase = 'correct-transfer-passphrase';
    const left = await encryptConnectionConfig(bundle, passphrase),
      right = await encryptConnectionConfig(bundle, passphrase);
    expect(left.salt).not.toBe(right.salt);
    expect(left.iv).not.toBe(right.iv);
    expect(left.data).not.toBe(right.data);
    expect(left.iterations).toBe(600000);
    expect(JSON.stringify(left)).not.toContain('localhost');
    expect(
      await decodeConnectionConfigFile(JSON.stringify(left), passphrase),
    ).toEqual(bundle);
    await expect(
      decodeConnectionConfigFile(
        JSON.stringify(left),
        'incorrect-transfer-passphrase',
      ),
    ).rejects.toThrow('解密失败');
    const tampered = {
      ...left,
      data: `${left.data[0] === 'A' ? 'B' : 'A'}${left.data.slice(1)}`,
    };
    await expect(
      decodeConnectionConfigFile(JSON.stringify(tampered), passphrase),
    ).rejects.toThrow('修改');
    await expect(
      decodeConnectionConfigFile(
        JSON.stringify({ ...left, iterations: 1 }),
        passphrase,
      ),
    ).rejects.toThrow('参数');
    await expect(
      decodeConnectionConfigFile(
        JSON.stringify({ ...left, iv: 'AA==' }),
        passphrase,
      ),
    ).rejects.toThrow('长度');
    await expect(encryptConnectionConfig(bundle, 'short')).rejects.toThrow(
      '12',
    );
    const controller = new AbortController();
    controller.abort();
    await expect(
      decodeConnectionConfigFile(
        JSON.stringify(left),
        passphrase,
        controller.signal,
      ),
    ).rejects.toThrow();
  });
});
