import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { principal } from '@fouc/shared/knowledge/contracts';
import type { PageScope, PermissionLevel } from '@fouc/shared/knowledge/contracts';
import { member, page } from '../../../platform/database/workspace/schema';
import type { WorkspaceTenantTransaction } from '../../../platform/database/workspace/tenant';
import { readTeamspacePermissionRoot } from '../organization/teamspaces';
import { authorizePageAccess, expandRequestPrincipals } from '../permissions';
import { rebuildPermissionSubtree } from '../permissions/rebuild';

export async function requirePageAccess(db: WorkspaceTenantTransaction, userId: string, scope: PageScope, required: PermissionLevel) {
  const result = await authorizePageAccess(db, { userId, scope: { workspaceId: scope.workspaceId, pageId: scope.pageId }, required });
  if (result.decision !== 'allow') throw new TRPCError({ code: 'FORBIDDEN' });
}

export async function requirePageDestination(db: WorkspaceTenantTransaction, userId: string, input: { workspaceId: string; teamspaceId: string; parentId: string | null }) {
  if (input.parentId) return requirePageAccess(db, userId, { workspaceId: input.workspaceId, pageId: input.parentId }, 'edit');
  const root = await readTeamspacePermissionRoot(db, { workspaceId: input.workspaceId, teamspaceId: input.teamspaceId });
  const [membership] = await db.select({ role: member.role }).from(member).where(and(eq(member.workspaceId, input.workspaceId), eq(member.userId, userId)));
  if (membership?.role === 'owner' || membership?.role === 'admin') return;
  const principals = await expandRequestPrincipals(db, input.workspaceId, userId);
  if ((root.defaultAccess !== 'edit' && root.defaultAccess !== 'full') || !principals.includes(principal('workspace', input.workspaceId))) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
}

export async function refreshPagePermissions(db: WorkspaceTenantTransaction, scope: PageScope) {
  const [record] = await db.select({ revision: page.aclRevision }).from(page).where(and(eq(page.workspaceId, scope.workspaceId), eq(page.id, scope.pageId)));
  if (record) await rebuildPermissionSubtree(db, { topic: 'acl.changed', workspaceId: scope.workspaceId, rootPageId: scope.pageId, revision: record.revision });
}
