import { TRPCError } from '@trpc/server';
import { entityIdSchema } from '@fouc/shared/knowledge/contracts';
import type { Pool } from 'pg';
import type { KnowledgeRequestAuthenticator, KnowledgeRequestContext, KnowledgeTokenScope } from '../../knowledge/access';
import { withKnowledgeTenant } from '../../database/knowledge/tenant';
import type { KnowledgeTenantTransaction } from '../../database/knowledge/tenant';
import { assertRequestActive } from './lifetime';

export interface KnowledgeApiContext {
  readonly requestId: string;
  readonly signal: AbortSignal;
}

/** Credential scopes are not page ACL. P03 must authorize page operations inside the tenant callback. */
export interface KnowledgeProcedureContext extends KnowledgeApiContext {
  readonly authority: KnowledgeRequestContext;
  withTenant<T>(operation: (db: KnowledgeTenantTransaction, authority: KnowledgeRequestContext) => Promise<T>): Promise<T>;
}

const contexts = new WeakMap<KnowledgeApiContext, {
  authenticator: KnowledgeRequestAuthenticator;
  authority: KnowledgeRequestContext;
  pool: Pool;
}>();

export async function createKnowledgeApiContext(options: {
  request: Request;
  workspaceId: string;
  requestId: string;
  signal: AbortSignal;
  authenticator: KnowledgeRequestAuthenticator;
  pool: Pool;
}): Promise<KnowledgeApiContext> {
  assertRequestActive(options.signal);
  const authority = await options.authenticator.authenticate(options.request, options.workspaceId);
  assertRequestActive(options.signal);
  const context = Object.freeze({ requestId: options.requestId, signal: options.signal });
  contexts.set(context, { authenticator: options.authenticator, pool: options.pool, authority });
  return context;
}

export async function authorizeKnowledgeProcedure(context: KnowledgeApiContext, workspaceId: string, scopes: readonly KnowledgeTokenScope[]): Promise<KnowledgeProcedureContext> {
  const state = contexts.get(context);
  if (!state) throw new TRPCError({ code: 'UNAUTHORIZED' });
  assertRequestActive(context.signal);
  const target = entityIdSchema.safeParse(workspaceId);
  if (!target.success) throw new TRPCError({ code: 'BAD_REQUEST' });
  if (target.data.toLowerCase() !== state.authority.workspaceId) throw new TRPCError({ code: 'FORBIDDEN' });
  // Batch calls share a transport, not a permission snapshot. Refresh each call independently.
  const authority = await state.authenticator.refresh(state.authority, scopes);
  assertRequestActive(context.signal);
  return Object.freeze({
    ...context, authority,
    async withTenant<T>(operation: (db: KnowledgeTenantTransaction, authority: KnowledgeRequestContext) => Promise<T>): Promise<T> {
      assertRequestActive(context.signal);
      // A handler may perform a second operation later; refresh before every new transaction too.
      const current = await state.authenticator.refresh(authority, scopes);
      assertRequestActive(context.signal);
      return withKnowledgeTenant(state.pool, current.workspaceId, async (db) => {
        assertRequestActive(context.signal);
        const result = await operation(db, current);
        // Cancellation observed before COMMIT rolls back. Already committed writes cannot be undone.
        assertRequestActive(context.signal);
        return result;
      });
    },
  });
}
