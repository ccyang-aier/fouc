import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { Pool } from 'pg';
import { createGroupInputSchema, groupMemberInputSchema, listGroupMembersInputSchema, listOrganizationInputSchema, removeGroupInputSchema, renameGroupInputSchema } from '@fouc/shared/knowledge/contracts';
import { group, groupMember, member } from '../../database/knowledge/schema';
import type { KnowledgeTenantTransaction } from '../../database/knowledge/tenant';
import type { FoucIdentity } from '../../identity/identity';
import { inWorkspace, pageOf, requireDirectory, requireManager } from './context';
import { OrganizationError, parseInput } from './errors';

async function existingGroup(db: KnowledgeTenantTransaction, workspaceId: string, groupId: string) {
  const [record] = await db.select().from(group).where(and(eq(group.workspaceId, workspaceId), eq(group.id, groupId)));
  if (!record) throw new OrganizationError('GROUP_NOT_FOUND', 'Workspace group was not found.', 404);
  return record;
}

export function groupOperations(pool: Pool) {
  return {
    async listGroups(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(listOrganizationInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, false, async ({ db, role }) => {
        requireDirectory(role);
        const rows = await db.select({ workspaceId: group.workspaceId, id: group.id, name: group.name }).from(group)
          .where(and(eq(group.workspaceId, parsed.workspaceId), parsed.cursor ? gt(group.id, parsed.cursor) : undefined)).orderBy(asc(group.id)).limit(parsed.limit + 1);
        return pageOf(rows, parsed.limit, (row) => row.id);
      });
    },
    async createGroup(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(createGroupInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, true, async ({ db, role }) => {
        requireManager(role);
        const record = { ...parsed, id: randomUUID() };
        await db.insert(group).values(record);
        return record;
      });
    },
    async renameGroup(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(renameGroupInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, true, async ({ db, role }) => {
        requireManager(role);
        await existingGroup(db, parsed.workspaceId, parsed.id);
        await db.update(group).set({ name: parsed.name }).where(and(eq(group.workspaceId, parsed.workspaceId), eq(group.id, parsed.id)));
        return parsed;
      });
    },
    async removeGroup(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(removeGroupInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, true, async ({ db, role }) => {
        requireManager(role);
        await existingGroup(db, parsed.workspaceId, parsed.groupId);
        await db.delete(group).where(and(eq(group.workspaceId, parsed.workspaceId), eq(group.id, parsed.groupId)));
        return { removed: true as const };
      });
    },
    async listGroupMembers(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(listGroupMembersInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, false, async ({ db, role }) => {
        requireDirectory(role);
        await existingGroup(db, parsed.workspaceId, parsed.groupId);
        const rows = await db.select().from(groupMember).where(and(eq(groupMember.workspaceId, parsed.workspaceId), eq(groupMember.groupId, parsed.groupId), parsed.cursor ? gt(groupMember.userId, parsed.cursor) : undefined))
          .orderBy(asc(groupMember.userId)).limit(parsed.limit + 1);
        return pageOf(rows, parsed.limit, (row) => row.userId);
      });
    },
    async addGroupMember(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(groupMemberInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, true, async ({ db, role }) => {
        requireManager(role);
        await existingGroup(db, parsed.workspaceId, parsed.groupId);
        const [membership] = await db.select().from(member).where(and(eq(member.workspaceId, parsed.workspaceId), eq(member.userId, parsed.userId)));
        if (!membership) throw new OrganizationError('MEMBER_NOT_FOUND', 'Workspace member was not found.', 404);
        await db.insert(groupMember).values(parsed).onConflictDoNothing();
        return parsed;
      });
    },
    async removeGroupMember(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(groupMemberInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, true, async ({ db, role }) => {
        requireManager(role);
        await existingGroup(db, parsed.workspaceId, parsed.groupId);
        await db.delete(groupMember).where(and(eq(groupMember.workspaceId, parsed.workspaceId), eq(groupMember.groupId, parsed.groupId), eq(groupMember.userId, parsed.userId)));
        return { removed: true as const };
      });
    },
  };
}
