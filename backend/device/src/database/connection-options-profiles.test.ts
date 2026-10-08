import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { savedConnectionRoutes } from '../api/saved-connection-routes';
import { defaultConnectionOptions } from '@fouc/shared/connection-options';
import { RelationalConnectionRepository } from './relational-connections';
import { mongoConfig } from './mongo-connections';
import { mongoConnection } from './mongo-input';
import { redisConfig } from './redis-input';

const directory = mkdtempSync(path.join(tmpdir(), 'fouc-options-profiles-'));
afterAll(() => {
  const absolute = path.resolve(directory);
  if (
    !absolute.startsWith(path.resolve(tmpdir()) + path.sep) ||
    !path.basename(absolute).startsWith('fouc-options-profiles-')
  )
    throw new Error('Invalid test cleanup scope');
  rmSync(absolute, { recursive: true });
});

test('all saved native profiles use public option allowlists, Mongo preserves actual discovery topology', () => {
  const options = {
    tls: {
      enabled: true,
      caPem: '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----',
      privateKeyPassphrase: 'ephemeral-only',
    },
  };
  const redis = redisConfig({
    provider: 'redis',
    host: 'localhost',
    port: 6379,
    username: '',
    database: 0,
    password: 'do-not-save',
    connectionOptions: options,
  });
  expect(redis.connectionOptions.tls.caRequired).toBe(true);
  expect(JSON.stringify(redis)).not.toContain('ephemeral-only');
  expect(JSON.stringify(redis)).not.toContain('do-not-save');
  const mongo = mongoConfig({
    provider: 'mongodb',
    host: 'db1.example',
    port: 27017,
    username: 'dev',
    database: 'app',
    authSource: 'admin',
    password: 'do-not-save',
    mongo: {
      srv: false,
      hosts: [
        { host: 'db1.example', port: 27017 },
        { host: 'db2.example', port: 27018 },
      ],
      replicaSet: 'rs0',
      parameters: { w: 'majority' },
    },
    connectionOptions: options,
  });
  expect(mongo.mongo?.hosts).toHaveLength(2);
  expect(mongo.mongo?.replicaSet).toBe('rs0');
  expect(
    mongoConnection({ ...mongo, password: 'actual-request' }).uri,
  ).toContain('db1.example:27017,db2.example:27018');
  expect(
    mongoConnection({ ...mongo, password: 'actual-request' }).uri,
  ).not.toContain('directConnection=true');
  expect(JSON.stringify(mongo)).not.toContain('ephemeral-only');
  expect(JSON.stringify(mongo)).not.toContain('do-not-save');
  const repository = new RelationalConnectionRepository(directory);
  const saved = repository.save({
    name: 'Test',
    config: {
      provider: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'dev',
      database: 'app',
      password: 'do-not-save',
      connectionOptions: options,
    },
  });
  expect(
    saved.config.provider === 'postgres' &&
      saved.config.connectionOptions.tls.caRequired,
  ).toBe(true);
  expect(JSON.stringify(repository.list())).not.toContain(
    'ephemeral-only',
  );
  expect(() =>
    mongoConfig({ ...mongo, uri: 'mongodb://dev:secret@db/app' }),
  ).toThrow('主机参数');
  expect(() => redisConfig({ ...redis, tls: false })).toThrow('统一');
  expect(() =>
    mongoConfig({ ...mongo, mongo: { srv: false, hosts: [], secret: 'bad' } }),
  ).toThrow('不支持');
});

test('saved-connection connect forwards only request password and options, never arbitrary host overrides', async () => {
  const repository = new RelationalConnectionRepository(directory);
  const entry = repository.save({
    name: 'Verified',
    config: {
      provider: 'postgres',
      host: 'original.example',
      port: 5432,
      username: 'dev',
      database: 'app',
      connectionOptions: defaultConnectionOptions('postgres'),
    },
  });
  let request: unknown;
  const app = savedConnectionRoutes(
    '/connections',
    repository,
    async (input, connectionId) => {
      request = input;
      return { connectionId };
    },
  );
  const material = { tls: { enabled: true, caPem: 'request-only' } };
  const response = await app.request(
    `/connections/${entry.id}/connect`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        password: 'request-password',
        connectionOptions: material,
        host: 'attacker.example',
        uri: 'mongodb://bad',
      }),
    },
  );
  expect(response.status).toBe(201);
  expect(request).toEqual({
    ...entry.config,
    password: 'request-password',
    connectionOptions: material,
  });
  expect(JSON.stringify(repository.list())).not.toContain(
    'request-only',
  );
  expect(JSON.stringify(repository.list())).not.toContain(
    'request-password',
  );
});
