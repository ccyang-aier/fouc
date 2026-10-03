import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from './server';
import { DatabaseCapabilityRegistry } from '../database/capability-registry';
import { RelationalSessionManager } from '../database/relational-session';
import { RelationalConnectionRepository } from '../database/relational-connections';

test('SQL history and library API require device authentication before resource resolution', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fouc-sql-api-'));
  const sessions = new RelationalSessionManager(new DatabaseCapabilityRegistry());
  const connections = new RelationalConnectionRepository(directory);
  const app = createApp({ registry: {} as never, supervisor: {} as never, connectors: {} as never,
    relationalSessions: sessions, relationalConnections: connections, token: 'frontend-token', internalToken: 'native-only-token' }).app;
  const root = '/api/database/workspaces/w/relational', session = root + '/sessions/missing/history', library = root + '/connections/missing/sql-library';
  const routes: [string, string][] = [
    ['POST', root + '/history/search'], ['GET', root + '/history/missing'], ['DELETE', root + '/history/missing'],
    ['POST', session + '/search'], ['GET', session + '/missing'], ['DELETE', session + '/missing'], ['DELETE', session],
    ['GET', library], ['POST', library + '/folders'], ['PUT', library + '/folders/missing'], ['DELETE', library + '/folders/missing'],
    ['POST', library + '/files'], ['GET', library + '/files/missing'], ['POST', library + '/files/missing/open'],
    ['PUT', library + '/files/missing'], ['DELETE', library + '/files/missing'], ['PUT', library + '/order'],
    ['GET', library + '/drafts'], ['PUT', library + '/drafts'],
    ['GET', root + '/sessions/missing/schemas/public/tables/items/columns'],
  ];
  try {
    for (const [method, route] of routes) {
      const body = method === 'GET' ? undefined : JSON.stringify({ confirmed: true });
      expect((await app.request(route, { method, body })).status).toBe(401);
      expect((await app.request(route, { method, body, headers: { authorization: 'Bearer frontend-token', 'content-type': 'application/json' } })).status).toBe(route === root + '/history/search' ? 200 : 400);
    }
  } finally {
    await sessions.shutdown(); Bun.gc(true);
    const target = path.resolve(directory);
    if (!target.startsWith(path.resolve(tmpdir()) + path.sep + 'fouc-sql-api-')) throw new Error('Unexpected SQL API cleanup target');
    rmSync(target, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
});

test('deleting a saved connection while native opening is pending prevents a late session from surviving', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fouc-sql-api-')), dbFile = path.join(directory, 'fixture.sqlite');
  const fixture = new DatabaseSync(dbFile); fixture.exec('CREATE TABLE items(id INTEGER)'); fixture.close();
  const sessions = new RelationalSessionManager(new DatabaseCapabilityRegistry()), connections = new RelationalConnectionRepository(directory);
  const connection = connections.save('w', { name: 'SQLite source', config: { provider: 'sqlite', path: dbFile } });
  const nativeConnect = sessions.connect.bind(sessions);
  let release!: () => void, notify!: () => void, sessionId = '';
  const ready = new Promise<void>((resolve) => { notify = resolve; }), gate = new Promise<void>((resolve) => { release = resolve; });
  sessions.connect = async (...args) => { const session = await nativeConnect(...args); sessionId = session.id; notify(); await gate; return session; };
  const app = createApp({ registry: {} as never, supervisor: {} as never, connectors: {} as never,
    relationalSessions: sessions, relationalConnections: connections, token: 'frontend-token', internalToken: 'native-only-token' }).app;
  const route = `/api/database/workspaces/w/relational/connections/${connection.id}`, headers = { authorization: 'Bearer frontend-token', 'content-type': 'application/json' };
  try {
    const opening = app.request(route + '/connect', { method: 'POST', body: '{}', headers });
    await ready;
    expect((await app.request(route, { method: 'DELETE', headers })).status).toBe(200);
    release(); expect((await opening).status).toBe(400); expect(() => sessions.details('w', sessionId)).toThrow();
    expect(sessions.sqlRepository.search('w', {}).total).toBe(0);
  } finally {
    release(); await sessions.shutdown(); Bun.gc(true);
    const target = path.resolve(directory);
    if (!target.startsWith(path.resolve(tmpdir()) + path.sep + 'fouc-sql-api-')) throw new Error('Unexpected SQL API cleanup target');
    rmSync(target, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
});
