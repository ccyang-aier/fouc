import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { defaultSqlEditorPreferences, type SqlEditorPreferences } from '@fouc/shared';
import { createApp } from './server';
import { DatabaseCapabilityRegistry } from '../database/capability-registry';
import { RelationalSessionManager } from '../database/relational-session';
import { RelationalConnectionRepository } from '../database/relational-connections';

function snapshot(preferences = defaultSqlEditorPreferences()) {
  const { updatedAt: _updatedAt, ...input } = preferences;
  return input;
}

async function preferencePayload(response: Response): Promise<SqlEditorPreferences> {
  return ((await response.json()) as { data: SqlEditorPreferences }).data;
}

test('editor preference API authenticates first and routes saved/live sessions to the owning resource', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fouc-sql-preferences-api-')), dbFile = path.join(directory, 'fixture.sqlite');
  const fixture = new DatabaseSync(dbFile);
  fixture.exec('CREATE TABLE items(id INTEGER)');
  fixture.close();
  const sessions = new RelationalSessionManager(new DatabaseCapabilityRegistry()), connections = new RelationalConnectionRepository(directory);
  const app = createApp({ registry: {} as never, supervisor: {} as never, connectors: {} as never,
    relationalSessions: sessions, relationalConnections: connections, token: 'frontend-token', internalToken: 'native-only-token' }).app;
  const headers = { authorization: 'Bearer frontend-token', 'content-type': 'application/json' }, root = '/api/database/workspaces/w/relational';
  const saved = connections.save('w', { name: 'SQLite source', config: { provider: 'sqlite', path: dbFile } });
  const library = `${root}/connections/${saved.id}/sql-library/preferences`;
  const send = (route: string, body: unknown) => app.request(route, { method: 'PUT', headers, body: JSON.stringify(body) });
  const read = (route: string) => app.request(route, { headers });
  try {
    for (const route of [library, `${root}/sessions/missing/preferences`]) {
      expect((await app.request(route)).status).toBe(401);
      expect((await app.request(route, { method: 'PUT', body: '{}' })).status).toBe(401);
    }
    expect((await read(library.replace('/workspaces/w/', '/workspaces/foreign/'))).status).toBe(400);
    const initial = await read(library);
    expect(initial.status).toBe(200);
    expect(await preferencePayload(initial)).toEqual(defaultSqlEditorPreferences());
    const savedReply = await send(library, { ...snapshot(), formatOnSave: true });
    expect(savedReply.status).toBe(200);
    const preferences = await preferencePayload(savedReply);
    const live = await sessions.connect('w', { provider: 'sqlite', path: dbFile }, { id: saved.id, name: saved.name });
    const liveRoute = `${root}/sessions/${live.id}/preferences`;
    expect(await preferencePayload(await read(liveRoute))).toEqual(preferences);
    const updatedReply = await send(liveRoute, { ...snapshot(preferences), formatOnSave: false });
    expect(updatedReply.status).toBe(200);
    const updated = await preferencePayload(updatedReply);
    expect(await preferencePayload(await read(library))).toEqual(updated);
    expect((await send(library, snapshot(preferences))).status).toBe(400);
    expect((await send(library, { ...snapshot(updated), snippets: [{ id: 'bad' }] })).status).toBe(400);
    expect(await preferencePayload(await read(library))).toEqual(updated);
    expect((await read(liveRoute.replace('/workspaces/w/', '/workspaces/foreign/'))).status).toBe(400);
    const transient = await sessions.connect('w', { provider: 'sqlite', path: dbFile });
    const transientRoute = `${root}/sessions/${transient.id}/preferences`;
    expect(await preferencePayload(await read(transientRoute))).toEqual(defaultSqlEditorPreferences());
    expect((await send(transientRoute, { ...snapshot(), snippets: [] })).status).toBe(200);
    expect(await preferencePayload(await read(library))).toEqual(updated);
    await sessions.disconnect('w', transient.id);
    expect((await read(transientRoute)).status).toBe(400);
    const reconnected = await sessions.connect('w', { provider: 'sqlite', path: dbFile });
    expect(sessions.editorPreferences('w', reconnected.id)).toEqual(defaultSqlEditorPreferences());
    expect((await app.request(`${root}/connections/${saved.id}`, { method: 'DELETE', headers })).status).toBe(200);
    expect((await read(library)).status).toBe(400);
    expect((await read(liveRoute)).status).toBe(400);
    expect(sessions.sqlRepository.editorPreferences('w', saved.id)).toEqual(defaultSqlEditorPreferences());
  } finally {
    await sessions.shutdown();
    Bun.gc(true);
    const target = path.resolve(directory);
    if (!target.startsWith(path.resolve(tmpdir()) + path.sep + 'fouc-sql-preferences-api-')) throw new Error('Unexpected editor preferences API cleanup target');
    rmSync(target, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
});
