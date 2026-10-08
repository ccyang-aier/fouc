import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DeviceConnectionRepository } from '../database/connection-repository';
import { savedConnectionRoutes } from './saved-connection-routes';

type Config = { provider: 'mysql' | 'sqlite'; host?: string; path?: string };
const directories: string[] = [];
const base = '/connections';
function repository() {
  const directory = mkdtempSync(path.join(tmpdir(), 'fouc-connection-route-'));
  directories.push(directory);
  return new DeviceConnectionRepository<Config>(directory, value => value as Config);
}
afterEach(() => {
  for (const directory of directories.splice(0)) {
    if (path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith('fouc-connection-route-'))
      throw new Error('Unexpected test directory');
    rmSync(directory, { recursive: true, force: true });
  }
});
const options = (body: unknown, method = 'POST') => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('direct open revalidates SQLite and only reuses verified secrets for their saved network target', async () => {
  const connections = repository();
  const sqlite = connections.save({ name: 'local', config: { provider: 'sqlite', path: '/demo.sqlite' } });
  const network = connections.save({ name: 'network', config: { provider: 'mysql', host: 'demo' } });
  const other = connections.save({ name: 'other', config: { provider: 'mysql', host: 'demo' } });
  const inputs: Record<string, unknown>[] = [];
  let offline = false;
  const app = savedConnectionRoutes(base, connections, async input => {
    inputs.push(input as Record<string, unknown>);
    if (offline) throw new Error('Unavailable');
    return { id: 'session' };
  });
  app.onError((error, c) => c.json({ ok: false, message: error.message }, 502));
  expect((await app.request(`${base}/${sqlite.id}/connect`, options({}))).status).toBe(201);
  expect((await app.request(`${base}/${network.id}/connect`, options({}))).status).toBe(409);
  const secrets = { password: 'test-password', connectionOptions: { tls: { clientKeyPem: 'test-key' } } };
  expect((await app.request(`${base}/${network.id}/connect`, options(secrets))).status).toBe(201);
  expect((await app.request(`${base}/${network.id}/connect`, options({}))).status).toBe(201);
  expect(inputs.at(-1)).toMatchObject({ provider: 'mysql', host: 'demo', ...secrets });
  expect((await app.request(`${base}/${other.id}/connect`, options({}))).status).toBe(409);
  const catalog = await (await app.request(base)).text();
  expect(catalog).not.toContain('test-password');
  expect(catalog).not.toContain('test-key');
  offline = true;
  expect((await app.request(`${base}/${network.id}/connect`, options({}))).status).toBe(502);
  expect(connections.get(network.id).status?.kind).toBe('failed');
  expect((await app.request(`${base}/${network.id}/connect`, options({}))).status).toBe(409);
});

test('configuration changes, deletion and a fresh device runtime invalidate cached credentials', async () => {
  const connections = repository();
  const config: Config = { provider: 'mysql', host: 'original' };
  const saved = connections.save({ name: 'demo', config });
  const removed: string[] = [];
  const connector = async () => ({ id: 'session' });
  const app = savedConnectionRoutes(base, connections, connector, id => { removed.push(id); });
  await app.request(`${base}/${saved.id}/connect`, options({ password: 'secret' }));
  await app.request(`${base}/${saved.id}`, options({ name: 'renamed', config }, 'PUT'));
  expect((await app.request(`${base}/${saved.id}/connect`, options({}))).status).toBe(201);
  await app.request(`${base}/${saved.id}`, options({ name: 'changed', config: { ...config, host: 'another' } }, 'PUT'));
  expect(connections.get(saved.id).status).toBeUndefined();
  expect((await app.request(`${base}/${saved.id}/connect`, options({}))).status).toBe(409);
  await app.request(`${base}/${saved.id}/connect`, options({ password: 'new-secret' }));
  const restarted = savedConnectionRoutes(base, connections, connector);
  const missing = await restarted.request(`${base}/${saved.id}/connect`, options({}));
  expect(missing.status).toBe(409);
  expect((await missing.json() as { error: { code: string } }).error.code).toBe('connection_credentials_required');
  expect(connections.get(saved.id).status?.kind).toBe('passed');
  await app.request(`${base}/${saved.id}`, { method: 'DELETE' });
  expect(removed).toEqual([saved.id]);
  expect(connections.list()).toHaveLength(0);
});

test('a delayed validation cannot cache secrets or restore status after its target changes', async () => {
  const connections = repository();
  const saved = connections.save({ name: 'demo', config: { provider: 'mysql', host: 'original' } });
  let release!: () => void, started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const app = savedConnectionRoutes(base, connections, async () => { started(); await blocked; return { id: 'session' }; });
  const pending = app.request(`${base}/${saved.id}/connect`, options({ password: 'old-target-secret' }));
  await entered;
  await app.request(`${base}/${saved.id}`, options({ name: 'demo', config: { provider: 'mysql', host: 'changed' } }, 'PUT'));
  release();
  expect((await pending).status).toBe(201);
  expect(connections.get(saved.id).status).toBeUndefined();
  expect((await app.request(`${base}/${saved.id}/connect`, options({}))).status).toBe(409);
});
