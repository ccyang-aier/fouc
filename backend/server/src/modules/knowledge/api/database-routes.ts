import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';
import {
  createDatabaseInputSchema, createRowInputSchema, pageScopeSchema,
  queryDatabaseInputSchema, updateDatabaseColumnsInputSchema, updatePropertiesInputSchema,
} from '@fouc/shared/knowledge/contracts';
import { databaseDefinition, page, pageAcl } from '../../../platform/database/workspace/schema';
import {
  createAuthorizedDatabase, createAuthorizedRow, listDatabaseRows,
  updateAuthorizedDatabaseColumns, updateAuthorizedRowProperties,
} from '../databases/service';
import { FoucDatabaseError } from '../databases/errors';
import { expandRequestPrincipals, lockPermissionWorkspace } from '../permissions';
import { principal } from '@fouc/shared/knowledge/contracts';
import { knowledgeMutation, knowledgeQuery } from './procedures';
import { requirePageAccess, requirePageDestination, refreshPagePermissions } from './page-route-guards';

async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof FoucDatabaseError) throw new TRPCError({ code: error.code.endsWith('_NOT_FOUND') ? 'NOT_FOUND' : 'BAD_REQUEST' });
    throw error;
  }
}

export const knowledgeDatabaseRouterRecord = {
  create: knowledgeMutation({
    input: createDatabaseInputSchema, scopes: ['read', 'write'],
    resolve: ({ ctx, input }) => guarded(() => ctx.withTenant(async (db, authority) => {
      await lockPermissionWorkspace(db, input.workspaceId);
      const [existing] = await db.select({ id: page.id }).from(page).where(and(eq(page.workspaceId, input.workspaceId), eq(page.id, input.id)));
      if (existing) await requirePageAccess(db, authority.userId, { workspaceId: input.workspaceId, pageId: input.id }, 'edit');
      else await requirePageDestination(db, authority.userId, input);
      const result = await createAuthorizedDatabase(db, input, authority.userId);
      if (!existing) await db.insert(pageAcl).values({ workspaceId: input.workspaceId, pageId: input.id, principal: principal('user', authority.userId), level: 'full', inherited: false });
      await refreshPagePermissions(db, { workspaceId: input.workspaceId, pageId: input.id });
      return result;
    })),
  }),
  getColumns: knowledgeQuery({
    input: pageScopeSchema, scopes: ['read'],
    resolve: ({ ctx, input }) => guarded(() => ctx.withTenant(async (db, authority) => {
      await requirePageAccess(db, authority.userId, input, 'view');
      const [record] = await db.select({ columns: databaseDefinition.properties }).from(databaseDefinition)
        .innerJoin(page, and(eq(page.workspaceId, databaseDefinition.workspaceId), eq(page.id, databaseDefinition.pageId)))
        .where(and(eq(databaseDefinition.workspaceId, input.workspaceId), eq(databaseDefinition.pageId, input.pageId), isNull(page.deletedAt)));
      if (!record) throw new TRPCError({ code: 'NOT_FOUND' });
      return { ...input, columns: record.columns };
    })),
  }),
  listRows: knowledgeQuery({
    input: queryDatabaseInputSchema, scopes: ['read'],
    resolve: ({ ctx, input }) => guarded(() => ctx.withTenant(async (db, authority) => {
      await requirePageAccess(db, authority.userId, { workspaceId: input.workspaceId, pageId: input.databaseId }, 'view');
      const viewer = await expandRequestPrincipals(db, input.workspaceId, authority.userId);
      return listDatabaseRows(db, { ...input, viewer });
    })),
  }),
  createRow: knowledgeMutation({
    input: createRowInputSchema, scopes: ['read', 'write'],
    resolve: ({ ctx, input }) => guarded(() => ctx.withTenant(async (db, authority) => {
      await lockPermissionWorkspace(db, input.workspaceId);
      await requirePageAccess(db, authority.userId, { workspaceId: input.workspaceId, pageId: input.databaseId }, 'edit');
      const [existing] = await db.select({ id: page.id }).from(page).where(and(eq(page.workspaceId, input.workspaceId), eq(page.id, input.id)));
      if (existing) await requirePageAccess(db, authority.userId, { workspaceId: input.workspaceId, pageId: input.id }, 'edit');
      const result = await createAuthorizedRow(db, input, authority.userId);
      await refreshPagePermissions(db, { workspaceId: input.workspaceId, pageId: input.id });
      return result;
    })),
  }),
  updateRowProperties: knowledgeMutation({
    input: updatePropertiesInputSchema, scopes: ['read', 'write'],
    resolve: ({ ctx, input }) => guarded(() => ctx.withTenant(async (db, authority) => {
      await requirePageAccess(db, authority.userId, input, 'edit');
      return updateAuthorizedRowProperties(db, input);
    })),
  }),
  updateColumns: knowledgeMutation({
    input: updateDatabaseColumnsInputSchema, scopes: ['read', 'write'],
    resolve: ({ ctx, input }) => guarded(() => ctx.withTenant(async (db, authority) => {
      await requirePageAccess(db, authority.userId, input, 'full');
      return updateAuthorizedDatabaseColumns(db, input);
    })),
  }),
};
