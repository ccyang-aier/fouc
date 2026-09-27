import { and, asc, count, eq, gt } from 'drizzle-orm';
import type { Pool } from 'pg';
import { changeMemberRoleInputSchema, listOrganizationInputSchema, removeMemberInputSchema } from '@fouc/shared/knowledge/contracts';
import { member } from '../../database/knowledge/schema';
import { authUser } from '../../database/identity/schema';
import type { KnowledgeTenantTransaction } from '../../database/knowledge/tenant';
import type { FoucIdentity } from '../../identity/identity';
import { inWorkspace, pageOf, requireDirectory, requireRoleAuthority } from './context';
import { OrganizationError, parseInput } from './errors';

async function protectLastOwner(db: KnowledgeTenantTransaction, workspaceId: string) {
  const [owners] = await db.select({ total: count() }).from(member).where(and(eq(member.workspaceId, workspaceId), eq(member.role, 'owner')));
  if (owners!.total <= 1) throw new OrganizationError('LAST_OWNER', 'The workspace must retain at least one owner.', 409);
}

export function memberOperations(pool: Pool) {
  return {
    async listMembers(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(listOrganizationInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, false, async ({ db, role }) => {
        requireDirectory(role);
        // Only identities attached to this authorized tenant can be discovered.
        const rows = await db.select({ workspaceId: member.workspaceId, userId: member.userId, role: member.role, name: authUser.name, email: authUser.email })
          .from(member).innerJoin(authUser, eq(authUser.id, member.userId))
          .where(and(eq(member.workspaceId, parsed.workspaceId), parsed.cursor ? gt(member.userId, parsed.cursor) : undefined))
          .orderBy(asc(member.userId)).limit(parsed.limit + 1);
        return pageOf(rows, parsed.limit, (row) => row.userId);
      });
    },
    async changeMemberRole(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(changeMemberRoleInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, true, async ({ db, role }) => {
        requireRoleAuthority(role, parsed.role);
        const target = and(eq(member.workspaceId, parsed.workspaceId), eq(member.userId, parsed.userId));
        const [existing] = await db.select().from(member).where(target);
        if (!existing) throw new OrganizationError('MEMBER_NOT_FOUND', 'Workspace member was not found.', 404);
        requireRoleAuthority(role, existing.role);
        if (existing.role === 'owner' && parsed.role !== 'owner') await protectLastOwner(db, parsed.workspaceId);
        const [updated] = await db.update(member).set({ role: parsed.role }).where(target).returning();
        return { workspaceId: updated!.workspaceId, userId: updated!.userId, role: updated!.role };
      });
    },
    async removeMember(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(removeMemberInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, true, async ({ db, actor, role }) => {
        const target = and(eq(member.workspaceId, parsed.workspaceId), eq(member.userId, parsed.userId));
        const [existing] = await db.select().from(member).where(target);
        if (!existing) throw new OrganizationError('MEMBER_NOT_FOUND', 'Workspace member was not found.', 404);
        if (actor.userId !== parsed.userId) requireRoleAuthority(role, existing.role);
        if (existing.role === 'owner') await protectLastOwner(db, parsed.workspaceId);
        await db.delete(member).where(target);
        return { removed: true as const };
      });
    },
  };
}
