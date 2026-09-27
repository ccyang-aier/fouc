import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { request as nodeRequest } from 'node:http';
import { TRPCClientError } from '@trpc/client';
import { createApiTestServer, deferred, heldOperation, privateErrorCanary, within } from './http-test-fixture';
import type { ApiTestServer } from './http-test-fixture';
import { knowledgeApiLimits } from './transport';

let fixture: ApiTestServer;
beforeAll(async () => { fixture = await createApiTestServer(); }, 30_000);
afterAll(async () => { if (fixture) await fixture.close(); }, 30_000);

function headers(cookie = fixture.alpha.cookie) { return { cookie, origin: fixture.server.webOrigin }; }
function raw(path: string, options: { input?: unknown; body?: string; method?: string; headers?: Record<string, string>; workspaceId?: string } = {}) {
  return fetch(`${fixture.url(options.workspaceId)}/${path}${options.input === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify(options.input))}`}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: { ...headers(), ...options.headers }, body: options.body,
  });
}
async function error(response: Response, code: string) {
  const body = await response.json() as { error: { message: string; code: number; data: { code: string; httpStatus: number; requestId: string | null } } };
  expect(body.error.data.code).toBe(code);
  expect(Object.keys(body.error)).toEqual(['message', 'code', 'data']);
  expect(Object.keys(body.error.data)).toEqual(['code', 'httpStatus', 'requestId']);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-request-id')).toMatch(/^[a-f0-9-]{36}$/);
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  return body;
}

describe('Hono + tRPC over real HTTP and isolated PostgreSQL', () => {
  test('tRPC mount does not steal sibling organization routes regardless of registration order', async () => {
    const response = await fetch(`${fixture.server.origin}/api/workspaces`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ handledBy: 'later-organization-router' });
    expect(response.headers.has('x-request-id')).toBe(false);
    await error(await raw('', { workspaceId: 'invalid' }), 'BAD_REQUEST');
    await error(await fetch(`${fixture.server.origin}/api/knowledge/invalid/trpc`), 'BAD_REQUEST');
  });

  test('typed client authenticates a verified session and a PAT without leaking credential identifiers', async () => {
    const input = { workspaceId: fixture.alpha.workspaceId };
    const session = await fixture.client(headers()).access.query(input);
    expect(session).toEqual({ ...input, userId: fixture.alpha.userId, role: 'owner', actor: { kind: 'human', userId: fixture.alpha.userId }, credentialKind: 'session', scopes: ['read', 'write'] });
    const pat = await fixture.createToken();
    const authority = await fixture.client({ authorization: `Bearer ${pat.token}` }).access.query(input);
    expect(authority.credentialKind).toBe('pat');
    expect(authority.scopes).toEqual(['read']);
    expect(JSON.stringify(authority)).not.toContain(pat.token);
    expect(JSON.stringify(authority)).not.toContain(pat.metadata.id);
    const response = await raw('access', { input });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-allow-origin')).toBe(fixture.server.webOrigin);
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });

  test('anonymous, malformed Bearer and explicit invalid Bearer never fall back to valid cookies', async () => {
    const input = { workspaceId: fixture.alpha.workspaceId };
    await error(await raw('access', { input, headers: { cookie: '' } }), 'UNAUTHORIZED');
    for (const authorization of ['', 'Basic untrusted', 'Bearer invalid', 'Bearer a, Bearer b']) {
      const response = await raw('access', { input, headers: { authorization } });
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toContain('Bearer');
      await error(response, 'UNAUTHORIZED');
    }
  });

  test('request scope is a strict validated input matching the authenticated route workspace', async () => {
    const client = fixture.client(headers());
    const betaInput = { workspaceId: fixture.beta.workspaceId };
    // The user actually belongs to Beta: mismatch rejection is not merely a missing membership result.
    expect((await fixture.client(headers(), fixture.beta.workspaceId).access.query(betaInput)).workspaceId).toBe(fixture.beta.workspaceId);
    await expect(client.access.query(betaInput)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    for (const input of [{}, { workspaceId: 'not-a-uuid' }, { workspaceId: fixture.alpha.workspaceId, userId: fixture.beta.userId, kind: 'agent', taskId: randomUUID() }]) {
      expect((await raw('access', { input })).status).toBe(400);
    }
    await error(await raw('access', { input: { workspaceId: fixture.alpha.workspaceId }, workspaceId: 'not-a-uuid' }), 'BAD_REQUEST');
    const pat = await fixture.createToken();
    await expect(fixture.client({ authorization: `Bearer ${pat.token}` }, fixture.beta.workspaceId).access.query(betaInput))
      .rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } });
  });

  test('ignored spoofing headers cannot change the server actor, request ID or tenant', async () => {
    const response = await raw('access', { input: { workspaceId: fixture.alpha.workspaceId }, headers: {
      'x-user-id': fixture.beta.userId, 'x-workspace-id': fixture.beta.workspaceId, 'x-actor-kind': 'agent', 'x-task-id': randomUUID(), 'x-request-id': 'attacker-trace',
    } });
    const body = await response.json() as { result: { data: { actor: unknown; workspaceId: string } } };
    expect(body.result.data.actor).toEqual({ kind: 'human', userId: fixture.alpha.userId });
    expect(body.result.data.workspaceId).toBe(fixture.alpha.workspaceId);
    expect(response.headers.get('x-request-id')).not.toBe('attacker-trace');
  });

  test('read and write PAT capabilities are explicit, non-transitive, and live per operation', async () => {
    const read = await fixture.createToken(['read']);
    const write = await fixture.createToken(['write']);
    const input = { workspaceId: fixture.alpha.workspaceId };
    const readClient = fixture.client({ authorization: `Bearer ${read.token}` });
    const writeClient = fixture.client({ authorization: `Bearer ${write.token}` });
    await expect(readClient.writeScope.mutate(input)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    await expect(writeClient.access.query(input)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    expect((await writeClient.writeScope.mutate(input)).actor.userId).toBe(fixture.alpha.userId);
    await fixture.server.database.admin.query("UPDATE knowledge.personal_access_token SET scopes=ARRAY['read'] WHERE workspace_id=$1 AND id=$2", [fixture.alpha.workspaceId, write.metadata.id]);
    await expect(writeClient.writeScope.mutate(input)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    expect((await writeClient.access.query(input)).scopes).toEqual(['read']);
  });

  test('revocation, expiry, unverified user and membership loss reject subsequent HTTP calls', async () => {
    const input = { workspaceId: fixture.alpha.workspaceId };
    for (const change of ['revoked_at=clock_timestamp()', "expires_at=clock_timestamp()-interval '1 second'"]) {
      const pat = await fixture.createToken();
      const client = fixture.client({ authorization: `Bearer ${pat.token}` });
      await client.access.query(input);
      await fixture.server.database.admin.query(`UPDATE knowledge.personal_access_token SET ${change} WHERE workspace_id=$1 AND id=$2`, [fixture.alpha.workspaceId, pat.metadata.id]);
      await expect(client.access.query(input)).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } });
    }
    const pat = await fixture.createToken();
    const client = fixture.client({ authorization: `Bearer ${pat.token}` });
    await fixture.server.database.admin.query('UPDATE auth."user" SET email_verified=false WHERE id=$1', [fixture.alpha.userId]);
    try { await expect(client.access.query(input)).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } }); }
    finally { await fixture.server.database.admin.query('UPDATE auth."user" SET email_verified=true WHERE id=$1', [fixture.alpha.userId]); }
    await fixture.server.database.admin.query('DELETE FROM knowledge.member WHERE workspace_id=$1 AND user_id=$2', [fixture.alpha.workspaceId, fixture.alpha.userId]);
    try {
      await expect(client.access.query(input)).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } });
      await expect(fixture.client(headers()).access.query(input)).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } });
    } finally {
      await fixture.server.database.admin.query("INSERT INTO knowledge.member(workspace_id,user_id,role) VALUES($1,$2,'owner')", [fixture.alpha.workspaceId, fixture.alpha.userId]);
    }
  });

  test('a batch revalidates every procedure, including revocation after shared context creation', async () => {
    const pat = await fixture.createToken();
    const operationId = randomUUID();
    const gate = { entered: deferred(), release: deferred() };
    fixture.inputGates.set(operationId, gate);
    const before = fixture.requests.length;
    const client = fixture.batchClient({ authorization: `Bearer ${pat.token}` });
    const results = Promise.allSettled([
      client.access.query({ workspaceId: fixture.alpha.workspaceId }),
      client.delayedRead.query({ workspaceId: fixture.alpha.workspaceId, operationId }),
    ]);
    await within(gate.entered.promise);
    await fixture.server.database.admin.query('UPDATE knowledge.personal_access_token SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND id=$2', [fixture.alpha.workspaceId, pat.metadata.id]);
    gate.release.resolve();
    const settled = await results;
    expect(fixture.requests.slice(before)).toHaveLength(1);
    expect(fixture.requests[before]).toContain('batch=1');
    expect(settled[1]?.status).toBe('rejected');
    const failed = settled[1] as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(TRPCClientError);
    expect(failed.reason.data.code).toBe('UNAUTHORIZED');
    fixture.inputGates.delete(operationId);
  });

  test('a later tenant transaction refreshes authority instead of trusting the earlier handler context', async () => {
    const pat = await fixture.createToken();
    const operationId = randomUUID();
    const gate = { entered: deferred(), release: deferred() };
    fixture.inputGates.set(operationId, gate);
    const results = Promise.allSettled([fixture.client({ authorization: `Bearer ${pat.token}` }).laterTransaction.query({ workspaceId: fixture.alpha.workspaceId, operationId })]);
    await within(gate.entered.promise);
    await fixture.server.database.admin.query("UPDATE knowledge.personal_access_token SET scopes=ARRAY['write'] WHERE workspace_id=$1 AND id=$2", [fixture.alpha.workspaceId, pat.metadata.id]);
    gate.release.resolve();
    const [result] = await within(results);
    expect(result!.status).toBe('rejected');
    expect((result as PromiseRejectedResult).reason).toMatchObject({ data: { code: 'FORBIDDEN' } });
    fixture.inputGates.delete(operationId);
  });

  test('the tenant callback receives a newly checked membership role, not the old handler snapshot', async () => {
    const operationId = randomUUID();
    const gate = { entered: deferred(), release: deferred() };
    fixture.inputGates.set(operationId, gate);
    const result = fixture.client(headers()).laterTransaction.query({ workspaceId: fixture.alpha.workspaceId, operationId });
    await within(gate.entered.promise);
    try {
      await fixture.server.database.admin.query("UPDATE knowledge.member SET role='guest' WHERE workspace_id=$1 AND user_id=$2", [fixture.alpha.workspaceId, fixture.alpha.userId]);
      gate.release.resolve();
      expect(await within(result)).toBe('guest');
    } finally {
      gate.release.resolve();
      await fixture.server.database.admin.query("UPDATE knowledge.member SET role='owner' WHERE workspace_id=$1 AND user_id=$2", [fixture.alpha.workspaceId, fixture.alpha.userId]);
      fixture.inputGates.delete(operationId);
    }
  });

  test('exact Origin, cookie CSRF and narrow preflight are enforced, while non-browser Bearer works', async () => {
    const input = { workspaceId: fixture.alpha.workspaceId };
    for (const origin of ['https://evil.example', 'null', `${fixture.server.webOrigin}.evil`, '']) {
      const response = await raw('access', { input, headers: { origin } });
      expect(response.headers.has('access-control-allow-origin')).toBe(false);
      await error(response, 'FORBIDDEN');
    }
    const noOriginCookie = await fetch(`${fixture.url()}/writeScope`, { method: 'POST', headers: { cookie: fixture.alpha.cookie, 'content-type': 'application/json' }, body: JSON.stringify(input) });
    await error(noOriginCookie, 'FORBIDDEN');
    const trusted = await raw('writeScope', { body: JSON.stringify(input), headers: { 'content-type': 'application/json' } });
    expect(trusted.status).toBe(200);
    const preflight = await raw('access', { method: 'OPTIONS', headers: { 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type, authorization', cookie: '' } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('cache-control')).toBe('no-store');
    expect(preflight.headers.get('access-control-allow-origin')).toBe(fixture.server.webOrigin);
    expect(preflight.headers.get('access-control-allow-methods')).toBe('GET, POST');
    await error(await raw('access', { method: 'OPTIONS', headers: { 'access-control-request-method': 'DELETE' } }), 'FORBIDDEN');
    await error(await raw('access', { method: 'OPTIONS', headers: { 'access-control-request-method': 'POST', 'access-control-request-headers': 'x-user-id' } }), 'FORBIDDEN');
  });

  test('wrong methods, streaming/multipart and malformed JSON return sanitized protocol errors', async () => {
    const input = { workspaceId: fixture.alpha.workspaceId };
    await error(await raw('access', { method: 'DELETE' }), 'METHOD_NOT_SUPPORTED');
    await error(await raw('writeScope', { input }), 'METHOD_NOT_SUPPORTED');
    await error(await raw('access', { body: JSON.stringify(input), headers: { 'content-type': 'application/json' } }), 'METHOD_NOT_SUPPORTED');
    await error(await raw('writeScope', { body: '{secret-invalid-json', headers: { 'content-type': 'application/json' } }), 'BAD_REQUEST');
    await error(await raw('writeScope', { body: 'private-multipart', headers: { 'content-type': 'multipart/form-data' } }), 'UNSUPPORTED_MEDIA_TYPE');
    await error(await raw('access', { input, headers: { 'trpc-accept': 'application/jsonl' } }), 'UNSUPPORTED_MEDIA_TYPE');
    await error(await raw('private-procedure-canary', { input }), 'NOT_FOUND');
  });

  test('JSON and URL caps and bounded batching reject excessive requests before resolvers', async () => {
    await error(await raw('writeScope', { body: ' '.repeat(knowledgeApiLimits.bodyBytes + 1), headers: { 'content-type': 'application/json' } }), 'PAYLOAD_TOO_LARGE');
    await error(await raw('access', { input: { workspaceId: fixture.alpha.workspaceId, excess: 'x'.repeat(knowledgeApiLimits.urlBytes) } }), 'PAYLOAD_TOO_LARGE');
    const response = await fetch(`${fixture.url()}/${Array.from({ length: 11 }, () => 'access').join(',')}?batch=1&input=${encodeURIComponent(JSON.stringify(Object.fromEntries(Array.from({ length: 11 }, (_, index) => [index, { workspaceId: fixture.alpha.workspaceId }]))))}`, { headers: headers() });
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).not.toContain('stack');
    expect(body).toContain('BAD_REQUEST');
    // No Content-Length: the actual chunked bytes are still capped by our Fetch boundary.
    const chunked = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const request = nodeRequest(`${fixture.url()}/writeScope`, { method: 'POST', headers: { ...headers(), 'content-type': 'application/json' } }, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => resolve({ status: response.statusCode!, body: Buffer.concat(chunks).toString() }));
      });
      request.on('error', reject);
      request.write(' '.repeat(knowledgeApiLimits.bodyBytes));
      request.end(' ');
    });
    expect(chunked.status).toBe(413);
    expect(chunked.body).toContain('PAYLOAD_TOO_LARGE');
  });

  test('concurrent HTTP transactions keep distinct tenant settings and clear every reused connection', async () => {
    const tenants = [fixture.alpha, fixture.beta];
    const results = await Promise.all(Array.from({ length: 16 }, (_, index) => {
      const tenant = tenants[index % 2]!;
      return fixture.client(headers(tenant.cookie), tenant.workspaceId).probe.query({ workspaceId: tenant.workspaceId, delayMs: 25 });
    }));
    const pids = new Set<number>();
    for (const [index, result] of results.entries()) {
      const tenant = tenants[index % 2]!;
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({ workspaceId: tenant.workspaceId, name: tenant.name, tenant: tenant.workspaceId, identity: '' });
      expect(result.actor).toEqual({ kind: 'human', userId: tenant.userId });
      pids.add(result.rows[0]!.pid);
    }
    expect(pids.size).toBeGreaterThan(1);
    const connections = await Promise.all(Array.from({ length: 4 }, () => fixture.pool.connect()));
    try {
      for (const connection of connections) {
        const result = await connection.query("SELECT current_setting('app.workspace_id',true) AS tenant,current_setting('app.auth_session_id',true) AS identity");
        expect(result.rows[0]).toEqual({ tenant: '', identity: '' });
      }
    } finally { for (const connection of connections) connection.release(); }
    expect(fixture.successfulSignals.every((signal) => !signal.aborted)).toBe(true);
  });

  test('unexpected resolver errors roll back, redact protocol/diagnostics and leave the pool usable', async () => {
    const response = await raw('failure', { body: JSON.stringify({ workspaceId: fixture.alpha.workspaceId }), headers: { 'content-type': 'application/json' } });
    expect(response.status).toBe(500);
    const body = await error(response, 'INTERNAL_SERVER_ERROR');
    expect(JSON.stringify(body)).not.toContain(privateErrorCanary);
    expect(JSON.stringify(fixture.diagnostics)).not.toContain(privateErrorCanary);
    expect(JSON.stringify(fixture.diagnostics)).not.toContain('observer-private-canary');
    expect(fixture.diagnostics.every((event) => Object.keys(event).join(',') === 'requestId,code,status')).toBe(true);
    const probe = await fixture.client(headers()).probe.query({ workspaceId: fixture.alpha.workspaceId });
    expect(probe.rows[0]?.name).toBe(fixture.alpha.name);
  });

  test('aborting a real typed HTTP request propagates to the callback and rolls back before COMMIT', async () => {
    const operationId = randomUUID();
    const control = heldOperation();
    fixture.held.set(operationId, control);
    const controller = new AbortController();
    const results = Promise.allSettled([fixture.client(headers()).hold.mutate({ workspaceId: fixture.alpha.workspaceId, operationId }, { signal: controller.signal })]);
    const signal = await within(control.started.promise);
    expect(signal.aborted).toBe(false);
    controller.abort();
    const [result] = await within(results);
    expect(result!.status).toBe('rejected');
    expect((result as PromiseRejectedResult).reason).toBeInstanceOf(TRPCClientError);
    await within(control.finished.promise);
    expect(signal.aborted).toBe(true);
    const probe = await fixture.client(headers()).probe.query({ workspaceId: fixture.alpha.workspaceId });
    expect(probe.rows[0]?.name).toBe(fixture.alpha.name);
    expect(fixture.diagnostics.at(-1)?.code).toBe('CLIENT_CLOSED_REQUEST');
    fixture.held.delete(operationId);
  });

  test('role shutdown cancels active work, rejects new requests and does not close the injected pool', async () => {
    const operationId = randomUUID();
    const control = heldOperation();
    fixture.held.set(operationId, control);
    const results = Promise.allSettled([fixture.client(headers()).hold.mutate({ workspaceId: fixture.alpha.workspaceId, operationId })]);
    await within(control.started.promise);
    fixture.shutdown.abort();
    const [result] = await within(results);
    expect(result!.status).toBe('rejected');
    expect((result as PromiseRejectedResult).reason).toMatchObject({ data: { code: 'SERVICE_UNAVAILABLE' } });
    await within(control.finished.promise);
    const response = await raw('access', { input: { workspaceId: fixture.alpha.workspaceId } });
    expect(response.status).toBe(503);
    await error(response, 'SERVICE_UNAVAILABLE');
    expect((await fixture.pool.query('SELECT 1 AS alive')).rows[0].alive).toBe(1);
    const restored = await fixture.server.database.admin.query('SELECT name FROM knowledge.workspace WHERE workspace_id=$1', [fixture.alpha.workspaceId]);
    expect(restored.rows[0].name).toBe(fixture.alpha.name);
    fixture.held.delete(operationId);
  });
});
