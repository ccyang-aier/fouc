import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { DatastoreCliError, type CliEnvironment } from '../datastore-cli/types';
import { createDatastoreMcpServer } from './server';
import { loadDatastoreMcpPolicy, safeMcpMessage } from './policy';
import { validateDatastoreMcpHttpRequest, type DatastoreMcpHttpConfig } from './http-config';

type Runtime = ReturnType<typeof createDatastoreMcpServer>;
type Client = { id: string; runtime: Runtime; transport: StreamableHTTPServerTransport; lastSeen: number; requests: number; closing: Promise<void> | null };
const MAX_CLIENTS = 8;
const MAX_BODY_BYTES = 1024 * 1024;
const IDLE_MS = 10 * 60_000;

function respond(response: ServerResponse, status: number, code: string, message: string) {
  if (response.headersSent) { response.destroy(); return; }
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(status === 401 ? { 'www-authenticate': 'Bearer realm="fouc-datastore"' } : {}) });
  response.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message, data: { code } } }));
}

async function body(request: IncomingMessage): Promise<unknown> {
  if (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity') throw new DatastoreCliError('Compressed MCP request bodies are unsupported', 2, 'invalid_body');
  const declared = request.headers['content-length'];
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) throw new DatastoreCliError('MCP body exceeds 1 MiB', 2, 'body_too_large');
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) throw new DatastoreCliError('MCP POST requires application/json', 2, 'invalid_body');
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw new DatastoreCliError('MCP body exceeds 1 MiB', 2, 'body_too_large');
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
  catch { throw new DatastoreCliError('MCP body is not valid UTF-8 JSON', 2, 'invalid_body'); }
}

/** HTTP is explicitly launched and authenticated; it never mounts into the ordinary device API. */
export async function startDatastoreMcpHttp(environment: CliEnvironment, config: DatastoreMcpHttpConfig, report: (message: string) => void = () => undefined) {
  loadDatastoreMcpPolicy(environment); // Validate the fixed process policy before opening a socket.
  const clients = new Map<string, Client>();
  const pending = new Set<Client>();
  let stopping = false;
  let port = config.port;
  let closing: Promise<void> | null = null;
  async function closeClient(client: Client) {
    client.closing ??= (async () => {
      clients.delete(client.id); pending.delete(client);
      await client.runtime.close();
    })();
    await client.closing;
  }
  const listener = createServer((request, response) => {
    void handle(request, response).catch(reason => {
      report(safeMcpMessage(reason, environment));
      respond(response, 500, 'transport_failed', 'MCP transport failed; inspect the local runtime log');
    });
  });
  listener.maxConnections = 64;
  listener.requestTimeout = 30_000;
  listener.headersTimeout = 10_000;
  async function handle(request: IncomingMessage, response: ServerResponse) {
    if (stopping) { respond(response, 503, 'closing', 'MCP listener is closing'); return; }
    if (request.url !== '/mcp') { respond(response, 404, 'not_found', 'MCP endpoint is /mcp'); return; }
    const preflight = request.method === 'OPTIONS';
    const denied = validateDatastoreMcpHttpRequest(request.headers, port, config, !preflight);
    if (denied) { respond(response, denied.status, denied.code, denied.message); return; }
    const origin = request.headers.origin;
    if (origin) {
      response.setHeader('access-control-allow-origin', origin);
      response.setHeader('vary', 'Origin');
      response.setHeader('access-control-expose-headers', 'Mcp-Session-Id,Mcp-Protocol-Version');
    }
    if (preflight) {
      if (!origin || !['POST', 'GET', 'DELETE'].includes(request.headers['access-control-request-method'] ?? '')) { respond(response, 403, 'preflight_denied', 'An exact granted browser origin and MCP method are required'); return; }
      response.writeHead(204, { 'access-control-allow-methods': 'POST, GET, DELETE', 'access-control-allow-headers': 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-Id', 'access-control-max-age': '300' });
      response.end(); return;
    }
    if (!['POST', 'GET', 'DELETE'].includes(request.method ?? '')) { respond(response, 405, 'invalid_method', 'Use MCP POST, GET or DELETE'); return; }
    let parsed: unknown;
    if (request.method === 'POST') {
      try { parsed = await body(request); }
      catch (reason) { respond(response, reason instanceof DatastoreCliError && reason.code === 'body_too_large' ? 413 : 400, reason instanceof DatastoreCliError ? reason.code : 'invalid_body', safeMcpMessage(reason, environment)); return; }
    }
    const id = request.headers['mcp-session-id'];
    let client = typeof id === 'string' ? clients.get(id) : undefined;
    const fresh = id === undefined && request.method === 'POST' && isInitializeRequest(parsed);
    if (!client && !fresh) { respond(response, id === undefined ? 400 : 404, 'session_unknown', 'Initialize a new authenticated MCP session first'); return; }
    if (fresh) {
      if (clients.size + pending.size >= MAX_CLIENTS) { respond(response, 429, 'session_limit', 'MCP client session limit reached'); return; }
      const runtime = createDatastoreMcpServer(environment, report);
      const entry: Client = { id: '', runtime, transport: null as unknown as StreamableHTTPServerTransport, lastSeen: Date.now(), requests: 0, closing: null };
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(), enableJsonResponse: true, maxRequestBodySize: MAX_BODY_BYTES,
        onsessioninitialized: sessionId => { entry.id = sessionId; pending.delete(entry); clients.set(sessionId, entry); },
        onsessionclosed: () => { void closeClient(entry).catch(reason => report(safeMcpMessage(reason, environment))); },
      });
      entry.transport = transport;
      pending.add(entry);
      try { await runtime.server.connect(transport); }
      catch (reason) { await closeClient(entry); throw reason; }
      client = entry;
    }
    if (!client || client.closing) { respond(response, 404, 'session_unknown', 'MCP session is closed'); return; }
    if (client.requests >= 4) { respond(response, 429, 'request_limit', 'Four MCP requests are already active'); return; }
    client.lastSeen = Date.now();
    if (request.method === 'POST') client.requests++;
    try { await client.transport.handleRequest(request, response, parsed); }
    finally {
      if (request.method === 'POST') client.requests--;
      if (fresh && !client.id) await closeClient(client);
    }
  }
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(config.port, '127.0.0.1', () => { listener.off('error', reject); resolve(); });
  });
  const address = listener.address();
  if (!address || typeof address === 'string') throw new DatastoreCliError('MCP listener address is unavailable');
  port = address.port;
  const idle = setInterval(() => {
    for (const client of clients.values()) if (!client.requests && Date.now() - client.lastSeen >= IDLE_MS) void closeClient(client).catch(reason => report(safeMcpMessage(reason, environment)));
  }, 30_000);
  idle.unref();
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    close: async () => {
      closing ??= (async () => {
        stopping = true; clearInterval(idle);
        const listenerClosed = new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
        await Promise.allSettled([...clients.values(), ...pending].map(client => closeClient(client)));
        listener.closeAllConnections();
        await listenerClosed;
      })();
      await closing;
    },
  };
}
