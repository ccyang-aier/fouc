import { expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { SqlExecutionSnapshot } from '@fouc/shared';
import { DatastoreMcpAccess, loadDatastoreMcpPolicy } from './policy';
import { DatastoreMcpResults } from './results';
import { boundedMcpResult, createDatastoreMcpServer } from './server';

test('MCP fixes exact connection/schema/table grants and denies narrowing a whole-connection SQL grant', () => {
  const environment = { FOUC_DATASTORE_MCP_POLICY: JSON.stringify({ workspaceId: 'space-a', connections: [{ connectionId: 'saved', schemas: ['main'], tables: [{ schema: 'main', table: 'allowed' }] }] }) };
  const access = new DatastoreMcpAccess(loadDatastoreMcpPolicy(environment), environment);
  expect(() => access.table('saved', 'main', 'allowed')).not.toThrow();
  expect(() => access.connection('other')).toThrow('allowlist');
  expect(() => access.table('saved', 'other', 'allowed')).toThrow('Schema');
  expect(() => access.table('saved', 'main', 'private')).toThrow('Table');
  expect(() => access.sql('saved')).toThrow('SQL is disabled');
  expect(() => access.mongo('saved', 'db', 'items')).toThrow('namespace');
  expect(() => access.redis('saved')).toThrow('explicitly granted');
  expect(() => loadDatastoreMcpPolicy({ FOUC_DATASTORE_MCP_POLICY: JSON.stringify({ workspaceId: 'a', connections: [{ connectionId: 'saved', allowSql: true, schemas: ['main'] }] }) })).toThrow('whole connection');
  expect(access.options(['rows'], 'saved').workspace).toBe('space-a');
});

test('immutable result paging preserves exact values, NULL/empty and surrogate boundaries with connection ownership', () => {
  const execution: SqlExecutionSnapshot = { id: 'native', status: 'completed', database: 'main', schema: 'main', currentIndex: null, completedCount: 1, startedAt: 1, finishedAt: 2, revision: 2, statements: [{ from: 0, to: 8, sql: 'SELECT 1', status: 'succeeded', error: null, startedAt: 1, finishedAt: 2, result: { columns: ['integer', 'text', 'null', 'empty'], columnTypes: [], columnSortables: [], rows: [['9007199254740993', 'a😀中文', null, '']], affectedRows: 0, executionTimeMs: 1, truncated: false, sessionId: null, hasMore: false, messages: [] } }] };
  const results = new DatastoreMcpResults();
  const id = results.capture('saved', execution)!;
  execution.statements[0].result!.rows[0][0] = 'changed';
  const window = { statement: 0, rowOffset: 0, rowLimit: 1, cellOffset: 0, cellLimit: 200 };
  const value = results.read('saved', id, window);
  expect('rows' in value && value.rows[0]).toEqual(['9007199254740993', 'a😀中文', null, '']);
  const unicode = results.read('saved', id, { ...window, cellOffset: 2, cellLimit: 2 });
  expect('rows' in unicode && unicode.rows[0][1]).toMatchObject({ kind: 'string-window', text: '😀中', utf16Offset: 1 });
  expect(() => results.read('other', id, window)).toThrow('another connection');
  results.clearConnection('saved');
  expect(() => results.read('saved', id, window)).toThrow('expired');
});

test('standard MCP client initializes, discovers explicit readonly tools/resources and receives scope errors without native IO', async () => {
  const environment = { FOUC_DATASTORE_MCP_POLICY: JSON.stringify({ workspaceId: 'empty', connections: [], tools: ['fouc_list_connections', 'fouc_execute_query'] }) };
  const runtime = createDatastoreMcpServer(environment);
  const client = new Client({ name: 'fouc-p0', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await runtime.server.connect(serverTransport); await client.connect(clientTransport);
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(['fouc_list_connections', 'fouc_execute_query']);
    const listed = await client.callTool({ name: 'fouc_list_connections', arguments: {} });
    expect(listed.isError).toBeUndefined();
    expect(listed.structuredContent).toEqual({ ok: true, data: { workspaceId: 'empty', connections: [] } });
    const denied = await client.callTool({ name: 'fouc_execute_query', arguments: { connectionId: 'not-granted', sql: 'SELECT 1' } });
    expect(denied.isError).toBe(true);
    expect(denied.structuredContent).toMatchObject({ ok: false, error: { code: 'scope_denied' } });
    const resource = (await client.listResources()).resources.find(item => item.name === 'datastore-policy')!;
    expect(JSON.parse((await client.readResource({ uri: resource.uri })).contents[0].text as string).access).toBe('readonly');
    expect((await client.listPrompts()).prompts[0].name).toBe('explore-datastore');
    await expect(client.callTool({ name: 'fouc_execute_query', arguments: { connectionId: 'x', sql: 'SELECT 1', workspaceId: 'b' } })).resolves.toMatchObject({ isError: true });
  } finally { await client.close(); await runtime.close(); }
});

test('MCP tool responses enforce their own text/structured output budget', () => {
  expect(() => boundedMcpResult({ text: 'x'.repeat(300_000) })).toThrow('256 KiB');
  expect(boundedMcpResult({ value: '9007199254740993' }).structuredContent).toEqual({ ok: true, data: { value: '9007199254740993' } });
});
