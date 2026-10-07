import { expect, test } from 'bun:test';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { SqlExecutionSnapshot } from '@fouc/shared';
import { DatastoreMcpAccess, loadDatastoreMcpPolicy } from './policy';
import { DatastoreMcpResults } from './results';
import { boundedMcpResult, createDatastoreMcpServer } from './server';
import { DatastoreMcpBridge } from './bridge';
import { parseDatastoreCliArgs } from '../datastore-cli/args';
import { resolveCliConnection } from '../datastore-cli/connections';
import { DatastoreHttpClient } from '../datastore-cli/http';

test('MCP fixes exact connection/schema/table grants and denies narrowing a whole-connection SQL grant', () => {
  const environment = { FOUC_DATASTORE_MCP_POLICY: JSON.stringify({ connections: [{ connectionId: 'saved', schemas: ['main'], tables: [{ schema: 'main', table: 'allowed' }] }] }) };
  const access = new DatastoreMcpAccess(loadDatastoreMcpPolicy(environment), environment);
  expect(() => access.table('saved', 'main', 'allowed')).not.toThrow();
  expect(() => access.connection('other')).toThrow('allowlist');
  expect(() => access.table('saved', 'other', 'allowed')).toThrow('Schema');
  expect(() => access.table('saved', 'main', 'private')).toThrow('Table');
  expect(() => access.sql('saved')).toThrow('SQL is disabled');
  expect(() => access.mongo('saved', 'db', 'items')).toThrow('namespace');
  expect(() => access.redis('saved')).toThrow('explicitly granted');
  expect(() => loadDatastoreMcpPolicy({ FOUC_DATASTORE_MCP_POLICY: JSON.stringify({ connections: [{ connectionId: 'saved', allowSql: true, schemas: ['main'] }] }) })).toThrow('whole connection');
  expect(access.options(['rows'], 'saved').connection).toBe('saved');
});

test('immutable result paging preserves exact values, NULL/empty and surrogate boundaries with connection ownership', () => {
  const execution: SqlExecutionSnapshot = { id: 'native', status: 'completed', database: 'main', schema: 'main', currentIndex: null, completedCount: 1, startedAt: 1, finishedAt: 2, revision: 2, statements: [{ from: 0, to: 8, sql: 'SELECT 1', status: 'succeeded', error: null, startedAt: 1, finishedAt: 2, result: { columns: ['integer', 'text', 'null', 'empty'], columnTypes: [], columnSortables: [], rows: [['9007199254740993', 'a😀中文', null, '']], affectedRows: 0, executionTimeMs: 1, truncated: false, sessionId: null, hasMore: false, messages: [] } }] };
  const results = new DatastoreMcpResults();
  const id = results.capture('saved', execution)!;
  execution.statements[0].result!.rows[0][0] = 'changed';
  const window = { statement: 0, rowOffset: 0, rowLimit: 1, cellOffset: 0, cellLimit: 200 };
  const value = results.read('saved', id, window);
  expect('rows' in value && value.rows?.[0]).toEqual(['9007199254740993', 'a😀中文', null, '']);
  const unicode = results.read('saved', id, { ...window, cellOffset: 2, cellLimit: 2 });
  expect('rows' in unicode && unicode.rows?.[0][1]).toMatchObject({ kind: 'string-window', text: '😀中', utf16Offset: 1 });
  expect(() => results.read('other', id, window)).toThrow('another connection');
  results.clearConnection('saved');
  expect(() => results.read('saved', id, window)).toThrow('expired');
});

test('standard MCP client initializes, discovers explicit readonly tools/resources and receives scope errors without native IO', async () => {
  const environment = { FOUC_DATASTORE_MCP_POLICY: JSON.stringify({ connections: [], tools: ['fouc_list_connections', 'fouc_execute_query'] }) };
  const runtime = createDatastoreMcpServer(environment);
  const client = new Client({ name: 'fouc-p0', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await runtime.server.connect(serverTransport); await client.connect(clientTransport);
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(['fouc_list_connections', 'fouc_execute_query']);
    const listed = await client.callTool({ name: 'fouc_list_connections', arguments: {} });
    expect(listed.isError).toBeUndefined();
    expect(listed.structuredContent).toEqual({ ok: true, data: { connections: [] } });
    const denied = await client.callTool({ name: 'fouc_execute_query', arguments: { connectionId: 'not-granted', sql: 'SELECT 1' } });
    expect(denied.isError).toBe(true);
    expect(denied.structuredContent).toMatchObject({ ok: false, error: { code: 'scope_denied' } });
    const resource = (await client.listResources()).resources.find(item => item.name === 'datastore-policy')!;
    const policyContent = (await client.readResource({ uri: resource.uri })).contents[0];
    if (!('text' in policyContent)) throw new Error('MCP policy must be a text resource');
    expect(JSON.parse(policyContent.text).access).toBe('readonly');
    expect((await client.listPrompts()).prompts[0].name).toBe('explore-datastore');
    await expect(client.callTool({ name: 'fouc_execute_query', arguments: { connectionId: 'x', sql: 'SELECT 1', unexpected: true } })).resolves.toMatchObject({ isError: true });
  } finally { await client.close(); await runtime.close(); }
});

test('MCP tool responses enforce their own text/structured output budget', () => {
  expect(() => boundedMcpResult({ text: 'x'.repeat(300_000) })).toThrow('256 KiB');
  expect(boundedMcpResult({ value: '9007199254740993' }).structuredContent).toEqual({ ok: true, data: { value: '9007199254740993' } });
});

test('MCP rejects a deleted granted ID even when an ungranted connection adopts its name, including pinned-open races', async () => {
  const replacement = { id: 'private-id', name: 'granted-id', config: { provider: 'sqlite', database: 'main' }, updatedAt: 1 };
  const original = { ...replacement, id: 'granted-id', name: 'Original' };
  let relationalReads = 0, connects = 0, pinnedRace = false, exactVisible = false;
  const http = createServer((request, response) => {
    const path = new URL(request.url!, 'http://localhost').pathname;
    let data: unknown = [];
    if (path.endsWith('/relational/connections')) {
      relationalReads++;
      data = exactVisible || (pinnedRace && relationalReads === 1) ? [original, replacement] : [replacement];
    } else if (path.endsWith('/connect')) { connects++; data = { id: 'unauthorized-session' }; }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, data }));
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = http.address() as { port: number };
  const environment = { FOUC_DEVICE_URL: `http://127.0.0.1:${address.port}`, FOUC_DATASTORE_MCP_POLICY: JSON.stringify({ connections: [{ connectionId: 'granted-id', allowSql: true }] }) };
  const bridge = new DatastoreMcpBridge(loadDatastoreMcpPolicy(environment), environment);
  const signal = new AbortController().signal;
  try {
    for (const [tool, args] of [
      ['fouc_list_databases', {}],
      ['fouc_list_schema_objects', { schema: 'main' }],
      ['fouc_execute_query', { sql: 'SELECT 1' }],
    ] as const) {
      await expect(bridge.invoke(tool, { connectionId: 'granted-id', ...args }, signal)).rejects.toMatchObject({ code: 'connection_not_found' });
    }
    expect(connects).toBe(0);
    // Pinned open lists the directory before connecting. Removing A between the
    // two reads must not cause its grant to be attached to the same-named B.
    relationalReads = 0; pinnedRace = true;
    await expect(bridge.invoke('fouc_open_session', { connectionId: 'granted-id' }, signal)).rejects.toMatchObject({ code: 'connection_not_found' });
    expect(relationalReads).toBe(2);
    expect(connects).toBe(0);
    pinnedRace = false;
    const options = bridge.access.options([], 'granted-id', { session: 'browser-session', connectionResolution: undefined });
    expect(options.session).toBeNull();
    expect(options.connectionResolution).toBe('id');
    await expect(bridge.sessions.open('granted-id', { ...options, session: 'browser-session' })).rejects.toMatchObject({ code: 'session_denied' });
    expect(connects).toBe(0);
    // Human CLI callers retain unique display-name selection; exact IDs win.
    const cli = new DatastoreHttpClient(environment.FOUC_DEVICE_URL, {}, 1000);
    const named = parseDatastoreCliArgs(['--connection', 'granted-id']);
    expect((await resolveCliConnection(cli, named)).id).toBe('private-id');
    exactVisible = true;
    expect((await resolveCliConnection(cli, options)).id).toBe('granted-id');
  } finally { await bridge.close(); await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve())); }
});
