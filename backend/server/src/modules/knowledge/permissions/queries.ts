import { and, eq, isNull, sql } from 'drizzle-orm';
import { pageScopeSchema, permissionLevelSchema, principalSchema, workspaceScopeSchema } from '@fouc/shared/knowledge/contracts';
import type { EffectivePermissions, PageScope, PermissionLevel, Principal } from '@fouc/shared/knowledge/contracts';
import { blockIndex, page, pageEffectiveAcl } from '../../../platform/database/workspace/schema';
import type { WorkspaceTenantTransaction } from '../../../platform/database/workspace/tenant';
import { KnowledgePermissionError } from './errors';

export type MaterializedPagePermissions =
  | { status: 'ready'; revision: number; permissions: EffectivePermissions }
  | { status: 'pending'; code: 'PERMISSIONS_REBUILDING'; retryable: true }
  | { status: 'unavailable' };

/** Internal input to P03, not an access decision or a page-existence HTTP oracle. */
export async function readMaterializedPagePermissions(db: WorkspaceTenantTransaction, scope: PageScope): Promise<MaterializedPagePermissions> {
  if (!pageScopeSchema.safeParse(scope).success) throw new KnowledgePermissionError('INVALID_PERMISSION_INPUT');
  const [record] = await db.select({ revision: page.aclRevision, effective: pageEffectiveAcl }).from(page)
    .leftJoin(pageEffectiveAcl, and(eq(pageEffectiveAcl.workspaceId, page.workspaceId), eq(pageEffectiveAcl.pageId, page.id)))
    .where(and(eq(page.workspaceId, scope.workspaceId), eq(page.id, scope.pageId), isNull(page.deletedAt)));
  if (!record) return { status: 'unavailable' };
  if (!record.effective || record.effective.revision !== record.revision) return { status: 'pending', code: 'PERMISSIONS_REBUILDING', retryable: true };
  const { view, comment, edit, full } = record.effective;
  return { status: 'ready', revision: record.revision, permissions: { view, comment, edit, full } };
}

interface AccessInput { workspaceId: string; principals: readonly Principal[] }

function subjects(input: AccessInput) {
  if (!workspaceScopeSchema.safeParse({ workspaceId: input.workspaceId }).success || !input.principals.every((value) => principalSchema.safeParse(value).success)) {
    throw new KnowledgePermissionError('INVALID_PERMISSION_INPUT');
  }
  return [...input.principals];
}

/**
 * SQL predicate for a query whose FROM includes `page`. Principals MUST be freshly
 * expanded from verified server authority; accepting request-body arrays is unsafe.
 * Apply before LIMIT/ranking. Stale revisions and recycled pages always fail closed.
 */
export function effectivePageAccessCondition(input: AccessInput & { required: PermissionLevel }) {
  const principals = subjects(input);
  if (!permissionLevelSchema.safeParse(input.required).success) throw new KnowledgePermissionError('INVALID_PERMISSION_INPUT');
  return and(eq(page.workspaceId, input.workspaceId), isNull(page.deletedAt), sql`exists (
    select 1 from ${pageEffectiveAcl}
    where ${pageEffectiveAcl.workspaceId} = ${page.workspaceId} and ${pageEffectiveAcl.pageId} = ${page.id}
      and ${pageEffectiveAcl.revision} = ${page.aclRevision}
      and ${pageEffectiveAcl[input.required]} && ${sql.param(principals)}::text[]
  )`)!;
}

/** Search predicate for FROM block_index; never trust two equally stale caches. */
export function indexedBlockAccessCondition(input: AccessInput) {
  const principals = subjects(input);
  return and(eq(blockIndex.workspaceId, input.workspaceId), sql`${blockIndex.principals} && ${sql.param(principals)}::text[]`, sql`exists (
    select 1 from ${page}, ${pageEffectiveAcl}
    where ${page.workspaceId} = ${blockIndex.workspaceId} and ${page.id} = ${blockIndex.pageId}
      and ${page.deletedAt} is null and ${blockIndex.aclRevision} = ${page.aclRevision}
      and ${pageEffectiveAcl.workspaceId} = ${page.workspaceId} and ${pageEffectiveAcl.pageId} = ${page.id}
      and ${pageEffectiveAcl.revision} = ${page.aclRevision}
      and ${pageEffectiveAcl.view} && ${sql.param(principals)}::text[]
  )`)!;
}
