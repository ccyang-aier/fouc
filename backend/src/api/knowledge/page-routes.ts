import { TRPCError } from '@trpc/server';
import { and, asc, eq, isNull, isNotNull, or, sql } from 'drizzle-orm';
import {
  createPageInputSchema, listPagesInputSchema, movePageInputSchema, pageSchema,
  recyclePageInputSchema, restorePageInputSchema, updatePageInputSchema, principal,
} from '@fouc/shared/knowledge/contracts';
import type { PageScope, PermissionLevel } from '@fouc/shared/knowledge/contracts';
import { page, pageAcl } from '../../database/knowledge/schema';
import type { KnowledgeTenantTransaction } from '../../database/knowledge/tenant';
import { readTeamspacePermissionRoot } from '../../knowledge/organization/teamspaces';
import { OrganizationError } from '../../knowledge/organization/errors';
import { authorizePageAccess, effectivePageAccessCondition, expandRequestPrincipals, lockPermissionWorkspace } from '../../knowledge/permissions';
import { rebuildPermissionSubtree } from '../../knowledge/permissions/rebuild';
import { createAuthorizedPage, moveAuthorizedPage, recycleAuthorizedPage, restoreAuthorizedPage, updateAuthorizedPage } from '../../knowledge/pages/tree';
import { KnowledgePageError } from '../../knowledge/pages/errors';
import { apiError } from './errors';
import { knowledgeMutation, knowledgeQuery } from './procedures';

async function requirePage(db: KnowledgeTenantTransaction, userId: string, scope: PageScope, required: PermissionLevel) {
  const result = await authorizePageAccess(db, { userId, scope: { workspaceId: scope.workspaceId, pageId: scope.pageId }, required });
  if (result.decision !== 'allow') throw new TRPCError({ code: 'FORBIDDEN' });
}

async function requireDestination(db: KnowledgeTenantTransaction, userId: string, input: { workspaceId: string; teamspaceId: string; parentId: string | null }) {
  if (input.parentId) return requirePage(db, userId, { workspaceId: input.workspaceId, pageId: input.parentId }, 'edit');
  const root = await readTeamspacePermissionRoot(db, { workspaceId: input.workspaceId, teamspaceId: input.teamspaceId });
  const principals = await expandRequestPrincipals(db, input.workspaceId, userId);
  const allowed = root.defaultAccess === 'edit' || root.defaultAccess === 'full';
  if (!allowed || !principals.includes(principal('workspace', input.workspaceId))) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
}

function serializePage(row: typeof page.$inferSelect) {
  const record = { ...row };
  Reflect.deleteProperty(record, 'aclRevision');
  return pageSchema.parse({ ...record, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null });
}

async function refreshPermissions(db: KnowledgeTenantTransaction, scope: PageScope) {
  const [record] = await db.select({ revision: page.aclRevision }).from(page).where(and(eq(page.workspaceId, scope.workspaceId), eq(page.id, scope.pageId)));
  if (record) await rebuildPermissionSubtree(db, { topic: 'acl.changed', workspaceId: scope.workspaceId, rootPageId: scope.pageId, revision: record.revision });
}

async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof KnowledgePageError) throw new TRPCError({ code: error.code === 'PAGE_NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST' });
    if (error instanceof OrganizationError) throw new TRPCError({ code: 'FORBIDDEN' });
    throw apiError(error);
  }
}

/** All writes authorize under the same workspace lock used by tree/ACL changes. */
export const knowledgePageRouterRecord = {
  list: knowledgeQuery({
    input: listPagesInputSchema, scopes: ['read'],
    resolve: ({ ctx, input }) => guarded(() => ctx.withTenant(async (db, authority) => {
      const principals = await expandRequestPrincipals(db, input.workspaceId, authority.userId);
      const rows = await db.select().from(page).where(and(
        or(effectivePageAccessCondition({ workspaceId: input.workspaceId, principals, required: 'view' }),
          and(eq(page.workspaceId, input.workspaceId), isNotNull(page.deletedAt), sql`exists (
            select 1 from ${pageAcl} where ${pageAcl.workspaceId} = ${page.workspaceId}
            and ${pageAcl.pageId} = ${page.id} and ${pageAcl.level} = 'full'
            and ${pageAcl.principal} = any(${sql.param(principals)}::text[])
          )`)),
        input.teamspaceId ? eq(page.teamspaceId, input.teamspaceId) : undefined,
        input.parentId === undefined ? undefined : input.parentId === null ? isNull(page.parentId) : eq(page.parentId, input.parentId),
      )).orderBy(asc(page.teamspaceId), asc(page.position), asc(page.id));
      return rows.map(serializePage);
    })),
  }),
  create: knowledgeMutation({
    input: createPageInputSchema, scopes: ['read', 'write'],
    resolve: ({ ctx, input }) => guarded(() => ctx.withTenant(async (db, authority) => {
      await lockPermissionWorkspace(db, input.workspaceId);
      const [existing] = await db.select().from(page).where(and(eq(page.workspaceId, input.workspaceId), eq(page.id, input.id)));
      if (existing) await requirePage(db, authority.userId, { workspaceId: input.workspaceId, pageId: input.id }, 'edit');
      else await requireDestination(db, authority.userId, input);
      const result = await createAuthorizedPage(db, input, authority.userId);
      if (!existing) await db.insert(pageAcl).values({ workspaceId: input.workspaceId, pageId: input.id, principal: principal('user', authority.userId), level: 'full', inherited: false });
      await refreshPermissions(db, { workspaceId: input.workspaceId, pageId: input.id });
      return result;
    })),
  }),
  update: knowledgeMutation({
    input: updatePageInputSchema, scopes: ['read', 'write'],
    resolve: ({ ctx, input }) => guarded(() => ctx.withTenant(async (db, authority) => {
      await lockPermissionWorkspace(db, input.workspaceId);
      await requirePage(db, authority.userId, input, 'edit');
      const { workspaceId, pageId, ...patch } = input;
      await updateAuthorizedPage(db, { workspaceId, pageId, patch });
      const [updated] = await db.select().from(page).where(and(eq(page.workspaceId, workspaceId), eq(page.id, pageId)));
      return serializePage(updated!);
    })),
  }),
  move: knowledgeMutation({
    input: movePageInputSchema, scopes: ['read', 'write'],
    resolve: ({ ctx, input }) => guarded(() => ctx.withTenant(async (db, authority) => {
      await lockPermissionWorkspace(db, input.workspaceId);
      await requirePage(db, authority.userId, input, 'edit');
      await requireDestination(db, authority.userId, input);
      const result = await moveAuthorizedPage(db, input);
      await refreshPermissions(db, input);
      return result;
    })),
  }),
  recycle: knowledgeMutation({
    input: recyclePageInputSchema, scopes: ['read', 'write'],
    resolve: ({ ctx, input }) => guarded(() => ctx.withTenant(async (db, authority) => {
      await lockPermissionWorkspace(db, input.workspaceId);
      await requirePage(db, authority.userId, input, 'full');
      const result = await recycleAuthorizedPage(db, input);
      await refreshPermissions(db, input);
      return result;
    })),
  }),
  restore: knowledgeMutation({
    input: restorePageInputSchema, scopes: ['read', 'write'],
    resolve: ({ ctx, input }) => guarded(() => ctx.withTenant(async (db, authority) => {
      await lockPermissionWorkspace(db, input.workspaceId);
      const [record] = await db.select().from(page).where(and(eq(page.workspaceId, input.workspaceId), eq(page.id, input.pageId)));
      if (!record) throw new TRPCError({ code: 'FORBIDDEN' });
      // Recycled pages intentionally have no effective ACL. The explicit full grant
      // and current destination rights must both still permit recovery.
      const principals = await expandRequestPrincipals(db, input.workspaceId, authority.userId);
      const grants = await db.select().from(pageAcl).where(and(eq(pageAcl.workspaceId, input.workspaceId), eq(pageAcl.pageId, input.pageId), eq(pageAcl.level, 'full')));
      if (!grants.some((grant) => principals.includes(grant.principal))) throw new TRPCError({ code: 'FORBIDDEN' });
      await requireDestination(db, authority.userId, record);
      const result = await restoreAuthorizedPage(db, input);
      await refreshPermissions(db, input);
      return result;
    })),
  }),
};
