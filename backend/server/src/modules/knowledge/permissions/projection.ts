import { and, eq, sql } from 'drizzle-orm';
import type { PageScope, Principal } from '@fouc/shared/knowledge/contracts';
import { blockIndex } from '../../../platform/database/knowledge/schema';
import type { KnowledgeTenantTransaction } from '../../../platform/database/knowledge/tenant';
import { KnowledgePermissionError } from './errors';
import { lockPermissionPage, lockPermissionWorkspace } from './locking';
import { readMaterializedPagePermissions } from './queries';

export interface IndexPermissionProjection { principals: Principal[]; aclRevision: number }

/**
 * H01's short projection transaction. Parse/model work must happen before this
 * callback. Taking the SAME write lock prevents a late index insert from restoring
 * pre-revocation principals. No body/page authorization is implied by this helper.
 */
export async function withPermissionIndexWrite<T>(db: KnowledgeTenantTransaction, scope: PageScope, write: (projection: IndexPermissionProjection) => Promise<T>): Promise<T> {
  await lockPermissionWorkspace(db, scope.workspaceId);
  const record = await lockPermissionPage(db, scope);
  if (!record) throw new KnowledgePermissionError('PERMISSION_SCOPE_NOT_FOUND');
  const effective = await readMaterializedPagePermissions(db, scope);
  const principals = effective.status === 'ready' ? effective.permissions.view : [];
  const result = await write({ principals: [...principals], aclRevision: record.aclRevision });
  // Synchronize all this page's blocks even if a caller carried stale input.
  await db.update(blockIndex).set({ principals, aclRevision: record.aclRevision, updatedAt: sql`clock_timestamp()` })
    .where(and(eq(blockIndex.workspaceId, scope.workspaceId), eq(blockIndex.pageId, scope.pageId)));
  return result;
}
