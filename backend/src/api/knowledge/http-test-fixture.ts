import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { createTRPCClient, httpBatchLink, httpLink } from '@trpc/client';
import { TRPCError } from '@trpc/server';
import { workspaceScopeSchema } from '@fouc/shared/knowledge/contracts';
import { createAuthTestServer, responseCookie, testPassword } from '../../knowledge/auth/auth-test-server';
import { createKnowledgeTokenService } from '../../knowledge/auth';
import type { KnowledgeTokenScope } from '../../knowledge/auth';
import { createKnowledgeApiRoutes } from './http';
import { createKnowledgeRouter, knowledgeMutation, knowledgeQuery } from './procedures';
import { knowledgeApiRouter } from './router';
import type { KnowledgeApiDiagnostic } from './errors';

export const privateErrorCanary = 'private-postgres-password-and-SQL';
export function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}
export function heldOperation() {
  return { started: deferred<AbortSignal>(), release: deferred(), finished: deferred() };
}
export async function within<T>(promise: Promise<T>, milliseconds = 2_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Test gate timed out')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

/** Disposable DB + verified email/password flow + real Node HTTP. All extra procedures are test-only. */
export async function createApiTestServer() {
  const shutdown = new AbortController();
  const diagnostics: KnowledgeApiDiagnostic[] = [];
  const requests: string[] = [];
  const successfulSignals: AbortSignal[] = [];
  const held = new Map<string, ReturnType<typeof heldOperation>>();
  const inputGates = new Map<string, { entered: ReturnType<typeof deferred<void>>; release: ReturnType<typeof deferred<void>> }>();
  const router = createKnowledgeRouter({
    access: knowledgeApiRouter.access,
    probe: knowledgeQuery({
      input: workspaceScopeSchema.extend({ delayMs: z.number().int().min(0).max(100).default(0) }), scopes: ['read'],
      resolve: ({ input, ctx }) => ctx.withTenant(async (db, authority) => {
        if (input.delayMs) await db.execute(sql`SELECT pg_sleep(${input.delayMs / 1_000})`);
        const rows = await db.execute<{ workspaceId: string; name: string; pid: number; tenant: string; identity: string }>(sql`
          SELECT workspace_id AS "workspaceId", name, pg_backend_pid() AS pid,
            current_setting('app.workspace_id', true) AS tenant, current_setting('app.auth_session_id', true) AS identity
          FROM knowledge.workspace`);
        successfulSignals.push(ctx.signal);
        return { rows: rows.rows, actor: authority.actor, role: authority.role };
      }),
    }),
    writeScope: knowledgeMutation({
      input: workspaceScopeSchema, scopes: ['write'],
      resolve: ({ ctx }) => ({ actor: ctx.authority.actor, workspaceId: ctx.authority.workspaceId }),
    }),
    failure: knowledgeMutation({
      input: workspaceScopeSchema, scopes: ['write'],
      resolve: ({ ctx }) => ctx.withTenant(async (db) => {
        await db.execute(sql`UPDATE knowledge.workspace SET name='should-roll-back'`);
        throw new Error(privateErrorCanary);
      }),
    }),
    hold: knowledgeMutation({
      input: workspaceScopeSchema.extend({ operationId: z.uuid() }), scopes: ['write'],
      resolve: async ({ input, ctx }) => {
        const control = held.get(input.operationId);
        if (!control) throw new TRPCError({ code: 'BAD_REQUEST' });
        try {
          return await ctx.withTenant(async (db) => {
            await db.execute(sql`UPDATE knowledge.workspace SET name=${input.operationId}`);
            const release = () => control.release.resolve();
            ctx.signal.addEventListener('abort', release, { once: true });
            if (ctx.signal.aborted) release();
            control.started.resolve(ctx.signal);
            try { await within(control.release.promise); }
            finally { ctx.signal.removeEventListener('abort', release); }
            if (ctx.signal.aborted) throw new Error('private downstream abort reason');
            return { completed: true };
          });
        } finally { control.finished.resolve(); }
      },
    }),
    delayedRead: knowledgeQuery({
      input: workspaceScopeSchema.extend({ operationId: z.uuid() }).transform(async (input) => {
        const gate = inputGates.get(input.operationId);
        if (!gate) throw new TRPCError({ code: 'BAD_REQUEST' });
        gate.entered.resolve();
        await within(gate.release.promise);
        return input;
      }),
      scopes: ['read'], resolve: ({ ctx }) => ctx.authority.userId,
    }),
    laterTransaction: knowledgeQuery({
      input: workspaceScopeSchema.extend({ operationId: z.uuid() }), scopes: ['read'],
      resolve: async ({ input, ctx }) => {
        const gate = inputGates.get(input.operationId);
        if (!gate) throw new TRPCError({ code: 'BAD_REQUEST' });
        gate.entered.resolve();
        await within(gate.release.promise);
        return ctx.withTenant(async (_db, authority) => authority.role);
      },
    }),
  });
  let pool!: Pool;
  let tokens!: ReturnType<typeof createKnowledgeTokenService>;
  const server = await createAuthTestServer({ mount(app, { auth, database }) {
    // Multiple ordinary-role connections exercise simultaneous tenant transactions as well as reuse.
    pool = new Pool({ ...database.pool.options, max: 4 });
    pool.on('error', () => { diagnostics.push({ requestId: 'pool', code: 'SERVICE_UNAVAILABLE', status: 503 }); });
    tokens = createKnowledgeTokenService({ auth, pool });
    app.use('/api/knowledge/*', async (context, next) => { requests.push(context.req.url); await next(); });
    app.route('/', createKnowledgeApiRoutes({ auth, pool, router, signal: shutdown.signal, onDiagnostic(event) {
      diagnostics.push(event);
      throw new Error('observer-private-canary'); // Observer errors must not alter the safe response.
    } }));
    // Registered afterwards on purpose: the tRPC module must not own this sibling route.
    app.get('/api/knowledge/workspaces', (context) => context.json({ handledBy: 'later-organization-router' }));
  } });
  async function account(email: string) {
    const signup = await server.request('/sign-up/email', { name: email, email, password: testPassword });
    assert.equal(signup.status, 200);
    const { user } = await signup.json() as { user: { id: string } };
    assert.equal((await server.request(server.verificationPath(email))).status, 302);
    const login = await server.request('/sign-in/email', { email, password: testPassword });
    assert.equal(login.status, 200);
    return { userId: user.id, cookie: responseCookie(login) };
  }
  try {
    const alpha = { ...await account('api-alpha@example.test'), workspaceId: randomUUID(), name: 'API Alpha' };
    const beta = { ...await account('api-beta@example.test'), workspaceId: randomUUID(), name: 'API Beta' };
    await server.database.admin.query("INSERT INTO knowledge.workspace(workspace_id,name,kind) VALUES ($1,$2,'team'),($3,$4,'team')", [alpha.workspaceId, alpha.name, beta.workspaceId, beta.name]);
    await server.database.admin.query("INSERT INTO knowledge.member(workspace_id,user_id,role) VALUES ($1,$3,'owner'),($2,$4,'owner'),($2,$3,'member')", [alpha.workspaceId, beta.workspaceId, alpha.userId, beta.userId]);
    const url = (workspaceId: string = alpha.workspaceId) => `${server.origin}/api/knowledge/${workspaceId}/trpc`;
    return {
      server, alpha, beta, pool, shutdown, diagnostics, requests, successfulSignals, held, inputGates, router, url,
      client(headers: Record<string, string> = {}, workspaceId: string = alpha.workspaceId) {
        return createTRPCClient<typeof router>({ links: [httpLink({ url: url(workspaceId), headers })] });
      },
      batchClient(headers: Record<string, string>) {
        return createTRPCClient<typeof router>({ links: [httpBatchLink({ url: url(), headers, maxItems: 10 })] });
      },
      createToken(scopes: KnowledgeTokenScope[] = ['read'], tenant = alpha) {
        return tokens.create(new Request(`${server.origin}/test-token-setup`, { method: 'POST', headers: { origin: server.webOrigin, cookie: tenant.cookie } }),
          { workspaceId: tenant.workspaceId, name: 'HTTP test', scopes, expiresAt: null });
      },
      async close() {
        shutdown.abort();
        for (const control of held.values()) control.release.resolve();
        for (const gate of inputGates.values()) gate.release.resolve();
        await pool.end();
        await server.close();
      },
    };
  } catch (error) {
    await pool.end();
    await server.close();
    throw error;
  }
}

export type ApiTestServer = Awaited<ReturnType<typeof createApiTestServer>>;
