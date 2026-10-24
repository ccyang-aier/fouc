import { and, eq, inArray } from 'drizzle-orm';
import type { Pool } from 'pg';
import { addChannelAgentSchema, addChannelMembersSchema, channelMemberScopeSchema, setChannelMemberRoleSchema } from '@fouc/shared/chats';
import { authUser } from '../../platform/database/identity/schema';
import { projectMember } from '../../platform/database/resources/schema/projects';
import { chatChannelMember } from '../../platform/database/resources/schema/chats';
import type { ResourceTransaction } from '../../platform/database/resources/transaction';
import type { FoucIdentity } from '../../platform/identity/identity';
import { parseInput, ResourceRequestError } from '../../platform/resources/errors';
import { requireChannelCapability, requireChannelManager } from './policy';
import { channelSnapshot, memberWhere, withChannel } from './store';

export async function addProjectUsers(db: ResourceTransaction, projectId: string, channelId: string, userIds: string[]) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  const users = await db.select({ userId: projectMember.userId, name: authUser.name, image: authUser.image }).from(projectMember)
    .innerJoin(authUser, eq(authUser.id, projectMember.userId)).where(and(eq(projectMember.projectId, projectId), inArray(projectMember.userId, ids)));
  if (users.length !== ids.length) throw new ResourceRequestError('INVALID_INPUT', '只能添加当前项目中的成员。', 400);
  const existing = await db.select().from(chatChannelMember).where(and(memberWhere(projectId, channelId), eq(chatChannelMember.kind, 'user'), inArray(chatChannelMember.userId, ids)));
  for (const user of users) {
    const row = existing.find(item => item.userId === user.userId);
    if (row) {
      if (!row.active) await db.update(chatChannelMember).set({ active: true, name: user.name, image: user.image, role: 'member' }).where(and(memberWhere(projectId, channelId), eq(chatChannelMember.id, row.id)));
    } else await db.insert(chatChannelMember).values({ projectId, channelId, id: crypto.randomUUID(), userId: user.userId, name: user.name, image: user.image });
  }
}
export function createChannelMemberActions(pool: Pool) {
  return {
    async addMembers(identity: FoucIdentity, input: unknown) {
      const value = parseInput(addChannelMembersSchema, input);
      return withChannel(pool, identity, value.projectId, value.channelId, true, async context => {
        requireChannelCapability(context.role, context.channel.permissions, 'invite');
        await addProjectUsers(context.db, value.projectId, value.channelId, value.userIds);
        return channelSnapshot(context);
      });
    },
    async addAgent(identity: FoucIdentity, input: unknown) {
      const value = parseInput(addChannelAgentSchema, input);
      return withChannel(pool, identity, value.projectId, value.channelId, true, async context => {
        const [existing] = await context.db.select().from(chatChannelMember).where(and(memberWhere(value.projectId, value.channelId), eq(chatChannelMember.userId, identity.userId), eq(chatChannelMember.kind, 'agent'), eq(chatChannelMember.installationId, value.installationId)));
        const image = value.image && (value.image.startsWith('/') && !value.image.startsWith('//') || /^https:\/\//.test(value.image)) ? value.image : null;
        if (existing) await context.db.update(chatChannelMember).set({ active: true, name: value.name, image }).where(and(memberWhere(value.projectId, value.channelId), eq(chatChannelMember.id, existing.id)));
        else await context.db.insert(chatChannelMember).values({ projectId: value.projectId, channelId: value.channelId, id: crypto.randomUUID(), userId: identity.userId, name: value.name, image, kind: 'agent', installationId: value.installationId });
        return channelSnapshot(context);
      });
    },
    async removeMember(identity: FoucIdentity, input: unknown) {
      const value = parseInput(channelMemberScopeSchema, input);
      return withChannel(pool, identity, value.projectId, value.channelId, true, async context => {
        const [target] = await context.db.select().from(chatChannelMember).where(and(memberWhere(value.projectId, value.channelId), eq(chatChannelMember.id, value.memberId)));
        if (!target?.active) throw new ResourceRequestError('MEMBER_NOT_FOUND', '频道成员不存在。', 404);
        if (target.role === 'owner') throw new ResourceRequestError('FORBIDDEN', '频道所有者不能退出；可删除频道。', 403);
        if (target.userId !== identity.userId) {
          requireChannelManager(context.role);
          if (context.role === 'admin' && target.role === 'admin') throw new ResourceRequestError('FORBIDDEN', '只有所有者可以移除频道管理员。', 403);
        }
        await context.db.update(chatChannelMember).set({ active: false, role: 'member' }).where(and(memberWhere(value.projectId, value.channelId), target.kind === 'user' ? eq(chatChannelMember.userId, target.userId) : eq(chatChannelMember.id, target.id)));
        // A leaving user loses access immediately; do not attempt to read the now-private snapshot.
        if (target.kind === 'user' && target.userId === identity.userId) return { ok: true as const };
        return channelSnapshot(context);
      });
    },
    async setMemberRole(identity: FoucIdentity, input: unknown) {
      const value = parseInput(setChannelMemberRoleSchema, input);
      return withChannel(pool, identity, value.projectId, value.channelId, true, async context => {
        if (context.role !== 'owner') throw new ResourceRequestError('FORBIDDEN', '只有频道所有者可以调整管理员。', 403);
        const [target] = await context.db.select().from(chatChannelMember).where(and(memberWhere(value.projectId, value.channelId), eq(chatChannelMember.id, value.memberId)));
        if (!target?.active) throw new ResourceRequestError('MEMBER_NOT_FOUND', '频道成员不存在。', 404);
        if (target.kind !== 'user' || target.role === 'owner') throw new ResourceRequestError('FORBIDDEN', '不能调整该成员的角色。', 403);
        await context.db.update(chatChannelMember).set({ role: value.role }).where(and(memberWhere(value.projectId, value.channelId), eq(chatChannelMember.id, value.memberId)));
        return channelSnapshot(context);
      });
    },
  };
}
