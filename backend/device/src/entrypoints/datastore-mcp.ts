import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createDatastoreMcpServer } from '../datastore-mcp/server';
import { safeMcpMessage } from '../datastore-mcp/policy';
import { startDatastoreMcpHttp } from '../datastore-mcp/http-server';
import { loadDatastoreMcpHttpConfig } from '../datastore-mcp/http-config';

// stdout belongs exclusively to the SDK's JSON-RPC transport.
let runtime: ReturnType<typeof createDatastoreMcpServer> | null = null;
let http: Awaited<ReturnType<typeof startDatastoreMcpHttp>> | null = null;
let closing: Promise<void> | null = null;
async function close(): Promise<void> {
  closing ??= http?.close() ?? runtime?.close() ?? Promise.resolve();
  await closing;
}
try {
  process.once('SIGINT', () => { void close().then(() => { process.exitCode = 130; }); });
  process.once('SIGTERM', () => { void close(); });
  const transport = process.env.FOUC_DATASTORE_MCP_TRANSPORT ?? 'stdio';
  if (transport === 'http') {
    http = await startDatastoreMcpHttp(process.env, loadDatastoreMcpHttpConfig(process.env), message => process.stderr.write(message + '\n'));
    process.stderr.write('Fouc readonly MCP listening on ' + http.url + '\n');
  } else if (transport === 'stdio') {
    runtime = createDatastoreMcpServer(process.env, message => process.stderr.write(message + '\n'));
    process.stdin.once('end', () => { void close(); });
    await runtime.server.connect(new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 1024 * 1024 }));
  } else throw new Error('FOUC_DATASTORE_MCP_TRANSPORT must be stdio or explicit http');
} catch (reason) {
  process.stderr.write('MCP startup failed: ' + safeMcpMessage(reason, process.env) + '\n');
  process.exitCode = 2;
  await close();
}
