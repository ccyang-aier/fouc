import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Hono } from 'hono';
import { createTransport } from 'nodemailer';
import { createTenantTestDatabase } from '../../database/knowledge/tenant-test-database';
import { createKnowledgeAuth } from './service';
import { createKnowledgeAuthRoutes } from './http';
import { createVerificationEmailTransport } from './email';
import type { AuthEmailTransport } from './email';
import { validateKnowledgeAuthConfig } from './config';
import { requireKnowledgeIdentity } from './identity';

export const testPassword = 'correct-horse-battery-94';

/** Real Node HTTP socket + ordinary PostgreSQL role; only email delivery is captured. */
export async function createAuthTestServer(options: { crossSite?: boolean; email?: AuthEmailTransport } = {}) {
  const database = await createTenantTestDatabase();
  const captured: { to: { address: string }[]; text: string }[] = [];
  const diagnostics: string[] = [];
  const transport = createTransport({ jsonTransport: true });
  const email = options.email ?? createVerificationEmailTransport('fouc@example.test', async (message) => {
    const sent = await transport.sendMail(message);
    if (typeof sent.message !== 'string') throw new Error('Expected a JSON test transport message');
    captured.push(JSON.parse(sent.message));
  });
  const app = new Hono();
  const server = createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) for (const item of value) headers.append(key, item);
        else if (value !== undefined) headers.set(key, value);
      }
      const body = Buffer.concat(chunks);
      const input = new Request(`http://${request.headers.host}${request.url}`, { method: request.method, headers, body: body.length ? body : undefined });
      const result = await app.fetch(input, { clientAddress: request.socket.remoteAddress });
      response.writeHead(result.status, [...result.headers].filter(([key]) => key !== 'set-cookie').concat(result.headers.getSetCookie().map((value) => ['set-cookie', value])).flat());
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      response.writeHead(500);
      response.end('Test HTTP adapter failed');
    }
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const webOrigin = options.crossSite ? 'https://app.example.test' : 'http://127.0.0.1:3000';
  const config = validateKnowledgeAuthConfig({
    baseUrl: options.crossSite ? 'https://auth.example.test' : origin,
    secret: randomBytes(48).toString('base64'),
    trustedOrigins: options.crossSite ? [webOrigin, 'tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'] : [webOrigin],
    cookieMode: options.crossSite ? 'cross-site' : 'same-site',
  });
  const auth = createKnowledgeAuth({ pool: database.pool, config, email, onDiagnostic: (event) => diagnostics.push(event) });
  app.route('/', createKnowledgeAuthRoutes(auth, (context) => context.env.clientAddress as string));
  app.get('/test/identity', requireKnowledgeIdentity(auth), (context) => context.json(context.get('identity')));
  app.post('/test/identity', requireKnowledgeIdentity(auth), (context) => context.json(context.get('identity')));
  return {
    database, auth, origin, webOrigin, captured, diagnostics,
    request(path: string, body?: unknown, cookie?: string, extra: Record<string, string> = {}) {
      return fetch(`${origin}/api/auth${path}`, { method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
        headers: { origin: webOrigin, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}), ...extra },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    },
    verificationPath(address: string) {
      const message = [...captured].reverse().find((item) => item.to.some((recipient) => recipient.address === address));
      const url = message?.text.match(/https?:\/\/\S+/)?.[0];
      if (!url) throw new Error('Expected a captured verification email');
      const parsed = new URL(url);
      return parsed.pathname.replace('/api/auth', '') + parsed.search;
    },
    async close() {
      await new Promise<void>((resolve, reject) => { server.close((error) => error ? reject(error) : resolve()); server.closeAllConnections(); });
      transport.close();
      await database.dispose();
    },
  };
}

export type AuthTestServer = Awaited<ReturnType<typeof createAuthTestServer>>;
export const responseCookie = (response: Response) => response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
