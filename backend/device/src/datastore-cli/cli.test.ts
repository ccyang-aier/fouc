import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseDatastoreCliArgs } from './args';
import { formatCliCsv, formatCliResult, formatCliTable } from './format';
import { DatastoreHttpClient } from './http';
import { withCliSession } from './connections';
import { runCliSql } from './execution';
import { writeCliOutput } from './output';
import type { SqlExecutionSnapshot } from '@fouc/shared';

const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(() => { for (const server of servers.splice(0)) server.stop(true); });
function server(handler: (request: Request) => Response | Promise<Response>) {
  const running = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: handler });
  servers.push(running);
  return running.url.origin;
}
const json = (data: unknown) => Response.json({ ok: true, data });

test('CLI accepts explicit scoped targets and rejects secret/write flags and ambiguous arguments', () => {
  const parsed = parseDatastoreCliArgs(['query', '--workspace', 'space-a', '--connection=id', '--query', 'SELECT 1', '--timeout=2m', '--json']);
  expect(parsed.workspace).toBe('space-a'); expect(parsed.timeout).toBe(120_000); expect(parsed.format).toBe('json');
  for (const args of [
    ['query', '--password=secret'], ['query', '--write'], ['query', '--connection=a', '--session=b'],
    ['query', '--query=SELECT 1', '--file=x.sql'], ['query', '--limit=5001'], ['query', '--json', '--csv'],
    ['query', '--url=http://user:secret@localhost:8710'], ['query', '--url=http://localhost:8710/api'],
    ['query', '--workspace=a', '--workspace=b'], ['query', '--offset=-1'],
  ]) expect(() => parseDatastoreCliArgs(args)).toThrow();
  expect(parseDatastoreCliArgs(['query'], { FOUC_WORKSPACE_ID: 'space-b' }).workspace).toBe('space-b');
});

test('CSV preserves precision, duplicate headers and NULL versus empty while terminal controls are escaped', () => {
  const grid = { columns: ['v', 'v', 'text'], rows: [['9007199254740993', '1.2300000000000000001', '中文,"quote"\nnext'], [null, '', '\u001b[31m']] };
  expect(formatCliCsv(grid)).toBe('v,v,text\r\n9007199254740993,1.2300000000000000001,"中文,""quote""\nnext"\r\n,"",\u001b[31m\r\n');
  expect(formatCliTable(grid)).not.toContain('\u001b');
  const result = { command: 'query', data: grid, grids: [grid] };
  expect(JSON.parse(formatCliResult(result, 'json')).data).toEqual(grid);
  expect(() => formatCliResult({ ...result, grids: [grid, grid] }, 'csv')).toThrow('exactly one');
});

test('HTTP authenticates the requested scope and rejects denied and malformed native envelopes', async () => {
  const origin = server(request => {
    expect(request.headers.get('authorization')).toBe('Bearer private-token');
    if (new URL(request.url).pathname === '/denied') return new Response('', { status: 403 });
    return new Response('invalid', { headers: { 'content-type': 'application/json' } });
  });
  const client = new DatastoreHttpClient(origin, { FOUC_DEVICE_TOKEN: 'private-token' }, 1000);
  await expect(client.request('/denied')).rejects.toMatchObject({ exitCode: 3, code: 'authentication_failed' });
  await expect(client.request('/invalid')).rejects.toThrow('non-JSON');
});

test('implicitly opened sessions close after failed action; borrowed sessions are left with their owner', async () => {
  const requests: Array<{ method: string; route: string }> = [];
  const origin = server(request => {
    const route = new URL(request.url).pathname;
    requests.push({ method: request.method, route });
    if (route.endsWith('/connections')) return json([{ id: 'saved', workspaceId: 'space-a', name: 'sqlite', updatedAt: 1, config: { provider: 'sqlite', path: 'fixture.sqlite' } }]);
    if (route.endsWith('/connect')) return json({ id: 'owned', workspaceId: 'space-a', provider: 'sqlite', database: 'fixture.sqlite' });
    return json(null);
  });
  const options = parseDatastoreCliArgs(['query', '--workspace=space-a', '--connection=saved', '--provider=sqlite']);
  const client = new DatastoreHttpClient(origin, {}, 1000);
  await expect(withCliSession(client, options, {}, async () => { throw new Error('native rejected'); })).rejects.toThrow('native rejected');
  expect(requests.at(-1)).toEqual({ method: 'DELETE', route: '/api/database/workspaces/space-a/relational/sessions/owned' });
  const before = requests.length;
  const borrowed = parseDatastoreCliArgs(['query', '--workspace=space-a', '--session=borrowed', '--provider=sqlite']);
  expect(await withCliSession(client, borrowed, {}, async session => session.id)).toBe('borrowed');
  expect(requests.length).toBe(before);
});

test('interrupt requests registered SQL cancellation even though the original request signal is aborted', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const execution: SqlExecutionSnapshot = { id: 'execution', status: 'running', database: 'main', schema: null, statements: [], currentIndex: 0, completedCount: 0, startedAt: 1, finishedAt: null, revision: 1 };
  const origin = server(request => {
    const route = new URL(request.url).pathname;
    if (route.endsWith('/cancel')) { cancelled = true; return json({ ...execution, status: 'cancelled' }); }
    if (route.endsWith('/executions')) { setTimeout(() => controller.abort(), 15); return json(execution); }
    return json({ revision: 1, execution: null });
  });
  const options = parseDatastoreCliArgs(['query', '--workspace=space-a', '--session=borrowed', '--provider=sqlite', '--query=SELECT 1']);
  const session = { id: 'borrowed', provider: 'sqlite' as const, database: 'main', root: '', base: '/scoped/sessions/borrowed', owned: false, raw: null };
  await expect(runCliSql(new DatastoreHttpClient(origin, {}, 1000, controller.signal), session, options, 'SELECT 1', controller.signal)).rejects.toMatchObject({ exitCode: 130 });
  expect(cancelled).toBe(true);
});

test('output publishes the complete file and requires explicit overwrite to replace existing content', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'fouc-cli-p0-'));
  const target = path.join(directory, 'result.csv');
  try {
    await writeCliOutput(target, 'exact\n9007199254740993\n', false);
    await expect(writeCliOutput(target, 'other', false)).rejects.toMatchObject({ code: 'output_exists' });
    expect(await readFile(target, 'utf8')).toBe('exact\n9007199254740993\n');
    await writeCliOutput(target, 'confirmed replacement', true);
    expect(await readFile(target, 'utf8')).toBe('confirmed replacement');
  } finally {
    if (path.dirname(path.resolve(directory)) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('fouc-cli-p0-')) throw new Error('Unexpected test directory');
    await rm(directory, { recursive: true, force: true });
  }
});
