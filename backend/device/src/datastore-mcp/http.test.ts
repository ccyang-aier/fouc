import { expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { loadDatastoreMcpHttpConfig, validateDatastoreMcpHttpRequest } from './http-config';
import { startDatastoreMcpHttp } from './http-server';

test('HTTP requires a provisioned token, exact loopback Host and explicit browser Origin', () => {
  expect(() => loadDatastoreMcpHttpConfig({})).toThrow('32');
  expect(() => loadDatastoreMcpHttpConfig({ FOUC_DATASTORE_MCP_TOKEN: 'x'.repeat(32), FOUC_DATASTORE_MCP_ORIGINS: '["*"]' })).toThrow('exact');
  const config = loadDatastoreMcpHttpConfig({ FOUC_DATASTORE_MCP_TOKEN: 'x'.repeat(32), FOUC_DATASTORE_MCP_ORIGINS: '["http://localhost:3000"]' });
  expect(validateDatastoreMcpHttpRequest({ host: '127.0.0.1:8712', authorization: 'Bearer ' + config.token }, 8712, config)).toBeNull();
  expect(validateDatastoreMcpHttpRequest({ host: 'evil.example:8712', authorization: 'Bearer ' + config.token }, 8712, config)?.code).toBe('host_denied');
  expect(validateDatastoreMcpHttpRequest({ host: '127.0.0.1:8712', origin: 'null', authorization: 'Bearer ' + config.token }, 8712, config)?.code).toBe('origin_denied');
  expect(validateDatastoreMcpHttpRequest({ host: '127.0.0.1:8712', authorization: 'Bearer ' + 'y'.repeat(32) }, 8712, config)?.status).toBe(401);
});

test('real Streamable HTTP client initializes, reads scoped tools and terminates its isolated session', async () => {
  const token = crypto.randomUUID();
  const runtime = await startDatastoreMcpHttp({ FOUC_DATASTORE_MCP_POLICY: JSON.stringify({ workspaceId: 'p0-http', connections: [] }) }, { port: 0, token, origins: ['http://localhost:3000'] });
  const transport = new StreamableHTTPClientTransport(new URL(runtime.url), { requestInit: { headers: { authorization: 'Bearer ' + token } } });
  const client = new Client({ name: 'http-p0', version: '1.0.0' });
  try {
    expect((await fetch(runtime.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(401);
    expect((await fetch(runtime.url, { method: 'POST', headers: { authorization: 'Bearer ' + token, origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' })).status).toBe(403);
    const preflight = await fetch(runtime.url, { method: 'OPTIONS', headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'POST' } });
    expect(preflight.status).toBe(204); expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    await client.connect(transport);
    expect((await client.listTools()).tools.length).toBe(16);
    const result = await client.callTool({ name: 'fouc_list_connections', arguments: {} });
    expect(result.structuredContent).toEqual({ ok: true, data: { workspaceId: 'p0-http', connections: [] } });
    const id = transport.sessionId!; expect(id).toBeTruthy();
    const second = new Client({ name: 'http-p0-second', version: '1.0.0' });
    const other = new StreamableHTTPClientTransport(new URL(runtime.url), { requestInit: { headers: { authorization: 'Bearer ' + token } } });
    try { await second.connect(other); expect(other.sessionId).not.toBe(id); }
    finally { await other.terminateSession(); await second.close(); }
    await transport.terminateSession();
    const expired = await fetch(runtime.url, { method: 'DELETE', headers: { authorization: 'Bearer ' + token, 'mcp-session-id': id } });
    expect(expired.status).toBe(404);
  } finally { await client.close(); await runtime.close(); }
});
