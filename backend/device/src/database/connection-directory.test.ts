import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { savedConnectionRoutes } from '../api/saved-connection-routes';
import { DeviceConnectionRepository } from './connection-repository';
import { DatabaseInputError } from './input-error';

const directory = mkdtempSync(path.join(tmpdir(), 'fouc-connection-directory-'));
afterAll(() => {
  const absolute = path.resolve(directory);
  if (!absolute.startsWith(path.resolve(tmpdir()) + path.sep) ||
    !path.basename(absolute).startsWith('fouc-connection-directory-'))
    throw new Error('Invalid test cleanup scope');
  rmSync(absolute, { recursive: true });
});
const repository = new DeviceConnectionRepository(directory, (value) => {
  if (!value || typeof value !== 'object' || typeof (value as { path?: unknown }).path !== 'string')
    throw new DatabaseInputError('Invalid config');
  return { path: (value as { path: string }).path };
});
const save = (workspace: string, name: string, target: string, id?: string) =>
  repository.save(workspace, { name, config: { path: target } }, id);
const patch = (workspace: string, id: string, value: unknown) => new Request(
  `http://localhost/workspaces/${workspace}/connections/${id}/directory`,
  { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) },
);

test('directory patches are scoped, whitelisted and persist partial organization without configuration edits', async () => {
  const entry = save('directory-a', 'SQLite', '/first.sqlite');
  expect(entry.directory).toEqual({ favorite: false, projectIds: [], tags: [] });
  const app = savedConnectionRoutes('/workspaces/:workspaceId/connections', repository, async () => ({ id: 'session' }));
  app.onError((error, c) => c.json({ error: error.message }, 400));
  expect((await app.request(patch('directory-a', entry.id, {
    favorite: true, projectIds: ['project-a', 'project-b'], tags: [' 本机 ', 'dev'],
  }))).status).toBe(200);
  expect(repository.get('directory-a', entry.id).directory).toEqual({
    favorite: true, projectIds: ['project-a', 'project-b'], tags: ['本机', 'dev'],
  });
  await app.request(patch('directory-a', entry.id, { favorite: false }));
  expect(repository.get('directory-a', entry.id).directory?.tags).toEqual(['本机', 'dev']);
  expect((await app.request(patch('directory-b', entry.id, { favorite: true }))).status).toBe(400);
  expect(repository.list('directory-b')).toEqual([]);
  expect((await app.request(patch('directory-a', 'missing', { favorite: true }))).status).toBe(400);
  for (const invalid of [
    null, [], { favorite: 1 }, { projectIds: [1] }, { tags: [''] },
    { projectIds: ['same', 'same'] }, { tags: ['x', ' x '] },
    { projectIds: Array.from({ length: 21 }, (_, i) => `p-${i}`) },
    { tags: Array.from({ length: 13 }, (_, i) => `t-${i}`) },
    { projectIds: ['x'.repeat(129)] }, { tags: ['x'.repeat(33)] },
    { id: 'other' }, { workspaceId: 'directory-b' }, { config: { path: '/other.sqlite' } },
    { status: { kind: 'passed', checkedAt: 0 } },
  ]) {
    expect((await app.request(patch('directory-a', entry.id, invalid))).status).toBe(400);
  }
  const current = repository.get('directory-a', entry.id);
  expect(current.config).toEqual({ path: '/first.sqlite' });
  expect(current.status).toBeUndefined();
  const copied = repository.save('directory-a', {
    name: 'Copy', config: current.config,
    directory: { ...current.directory, favorite: false },
  });
  expect(copied.directory).toEqual(current.directory);
  expect(() => repository.save('directory-a', {
    name: 'Invalid copy', config: current.config, directory: { status: 'passed' },
  })).toThrow();
});

test('last native connect outcome persists only status and configuration edits invalidate it', async () => {
  const entry = save('status-a', 'Native', '/native.sqlite');
  let fail = false;
  let receivedPassword = '';
  const app = savedConnectionRoutes('/workspaces/:workspaceId/connections', repository,
    async (_workspace, input) => {
      receivedPassword = (input as { password: string }).password;
      if (fail) throw new Error('private-password and credential-bearing exception');
      return { id: 'native-session' };
    });
  app.onError((_error, c) => c.json({ error: 'Connection failed' }, 400));
  const connect = () => app.request(`/workspaces/status-a/connections/${entry.id}/connect`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'private-password' }),
  });
  expect((await connect()).status).toBe(201);
  expect(receivedPassword).toBe('private-password');
  expect(repository.get('status-a', entry.id).status?.kind).toBe('passed');
  expect(repository.get('status-a', entry.id).status?.checkedAt).toBeGreaterThan(0);
  repository.updateDirectory('status-a', entry.id, { favorite: true });
  expect(repository.get('status-a', entry.id).status?.kind).toBe('passed');
  fail = true;
  expect((await connect()).status).toBe(400);
  expect(repository.get('status-a', entry.id).status?.kind).toBe('failed');
  const updated = save('status-a', 'Changed target', '/next.sqlite', entry.id);
  expect(updated.status).toBeUndefined();
  expect(updated.directory?.favorite).toBe(true);
  const persisted = readdirSync(directory).map((name) => readFileSync(path.join(directory, name), 'utf8')).join('');
  expect(persisted).not.toContain('private-password');
  expect(persisted).not.toContain('credential-bearing');
});

test('in-flight connect result cannot restore removed entries or mark a newly configured target', async () => {
  const entry = save('race-a', 'Racing', '/before.sqlite');
  let resolveConnect: (() => void) | undefined;
  let notifyStarted: (() => void) | undefined;
  let started = new Promise<void>((resolve) => { notifyStarted = resolve; });
  const app = savedConnectionRoutes('/workspaces/:workspaceId/connections', repository, async () => {
    notifyStarted?.();
    await new Promise<void>((resolve) => { resolveConnect = resolve; });
    return { id: 'session' };
  });
  const begin = () => app.request(`/workspaces/race-a/connections/${entry.id}/connect`, { method: 'POST' });
  const connecting = begin();
  await started;
  save('race-a', 'New target', '/after.sqlite', entry.id);
  resolveConnect?.();
  expect((await connecting).status).toBe(201);
  expect(repository.get('race-a', entry.id).status).toBeUndefined();
  started = new Promise<void>((resolve) => { notifyStarted = resolve; });
  const deletedConnect = begin();
  await started;
  repository.remove('race-a', entry.id);
  resolveConnect?.();
  expect((await deletedConnect).status).toBe(201);
  expect(repository.list('race-a')).toEqual([]);
});
