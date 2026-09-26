import { and, eq } from 'drizzle-orm';
import { pageScopeSchema, workspaceScopeSchema } from '@fouc/shared/knowledge/contracts';
import type { PageScope, TeamspaceScope } from '@fouc/shared/knowledge/contracts';
import { page, teamspace, workspace } from '../../database/knowledge/schema';
import type { KnowledgeTenantTransaction } from '../../database/knowledge/tenant';
import { KnowledgePermissionError } from './errors';

/**
 * Shared write protocol: workspace -> teamspace -> page. P03 must acquire this
 * lock BEFORE rechecking authority and changing ACLs/tree/content projections.
 * It is deliberately not an authorization check. Never hold it over network I/O.
 */
export async function lockPermissionWorkspace(db: KnowledgeTenantTransaction, workspaceId: string) {
  if (!workspaceScopeSchema.safeParse({ workspaceId }).success) throw new KnowledgePermissionError('INVALID_PERMISSION_INPUT');
  const [record] = await db.select({ id: workspace.id }).from(workspace).where(eq(workspace.id, workspaceId)).for('update');
  if (!record) throw new KnowledgePermissionError('PERMISSION_SCOPE_NOT_FOUND');
}

export async function lockPermissionTeamspace(db: KnowledgeTenantTransaction, scope: TeamspaceScope) {
  const [record] = await db.select().from(teamspace).where(and(eq(teamspace.workspaceId, scope.workspaceId), eq(teamspace.id, scope.teamspaceId))).for('update');
  if (!record) throw new KnowledgePermissionError('PERMISSION_SCOPE_NOT_FOUND');
  return record;
}

/** Called only after the workspace lock. A missing (hard-deleted) job root is a no-op. */
export async function lockPermissionPage(db: KnowledgeTenantTransaction, scope: PageScope) {
  if (!pageScopeSchema.safeParse(scope).success) throw new KnowledgePermissionError('INVALID_PERMISSION_INPUT');
  const predicate = and(eq(page.workspaceId, scope.workspaceId), eq(page.id, scope.pageId));
  const [location] = await db.select({ teamspaceId: page.teamspaceId }).from(page).where(predicate);
  if (!location) return undefined;
  await lockPermissionTeamspace(db, { workspaceId: scope.workspaceId, teamspaceId: location.teamspaceId });
  const [record] = await db.select().from(page).where(predicate).for('update');
  return record;
}
