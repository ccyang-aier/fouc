import { desc, eq } from 'drizzle-orm';
import type { Pool } from 'pg';
import { z } from 'zod';
import { channelScopeSchema, createChannelInputSchema, updateChannelInputSchema } from '@fouc/shared/chats';
import { entityIdSchema } from '@fouc/shared/resources';
import { chatChannel, chatChannelMember, chatMessage } from '../../platform/database/resources/schema/chats';
import { authUser } from '../../platform/database/identity/schema';
import type { FoucIdentity } from '../../platform/identity/identity';
import type { S3ObjectStorage } from '../../platform/storage/s3';
import { parseInput, ResourceRequestError } from '../../platform/resources/errors';
import { withProjectMember } from '../projects/access';
import { addProjectUsers, createChannelMemberActions } from './members';
import { createChannelMessageActions } from './messages';
import { cleanupChannelFiles } from './attachments';
import { requireChannelManager } from './policy';
import { channelSnapshot, channelViews, channelWhere, messageWhere, withChannel } from './store';

const projectScope = z.strictObject({ projectId: entityIdSchema });
export function createChannelService(pool: Pool, storage?: S3ObjectStorage) {
  return {
    ...createChannelMemberActions(pool), ...createChannelMessageActions(pool, storage),
    async list(identity: FoucIdentity, input: unknown) {
      const { projectId } = parseInput(projectScope, input);
      return withProjectMember(pool, identity, projectId, false, async ({ db }) => {
        const rows = await db.select().from(chatChannel).where(eq(chatChannel.projectId, projectId)).orderBy(desc(chatChannel.updatedAt));
        const items = await channelViews(db, rows);
        return { items: items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
      });
    },
    async get(identity: FoucIdentity, input: unknown) {
      const value = parseInput(channelScopeSchema, input);
      return withChannel(pool, identity, value.projectId, value.channelId, false, channelSnapshot);
    },
    async create(identity: FoucIdentity, input: unknown) {
      const value = parseInput(createChannelInputSchema, input);
      const channelId = crypto.randomUUID();
      return withProjectMember(pool, identity, value.projectId, true, async ({ db }) => {
        await db.insert(chatChannel).values({ projectId: value.projectId, id: channelId, name: value.name, description: value.description,
          color: value.color, visibility: value.visibility, ownerId: identity.userId });
        const [channel] = await db.select().from(chatChannel).where(channelWhere(value.projectId, channelId));
        const [user] = await db.select().from(authUser).where(eq(authUser.id, identity.userId));
        if (!user) throw new ResourceRequestError('UNAUTHENTICATED', '登录状态已过期。', 401);
        const [actor] = await db.insert(chatChannelMember).values({ projectId: value.projectId, channelId, id: crypto.randomUUID(), userId: identity.userId,
          name: user.name, image: user.image, role: 'owner' }).returning();
        await addProjectUsers(db, value.projectId, channelId, value.memberIds.filter(userId => userId !== identity.userId));
        return channelSnapshot({ db, channel: channel!, actor: actor!, identity, role: 'owner' });
      });
    },
    async update(identity: FoucIdentity, input: unknown) {
      const value = parseInput(updateChannelInputSchema, input);
      return withChannel(pool, identity, value.projectId, value.channelId, true, async context => {
        requireChannelManager(context.role);
        const { projectId, channelId, ...change } = value;
        await context.db.update(chatChannel).set({ ...change, updatedAt: new Date() }).where(channelWhere(projectId, channelId));
        return channelSnapshot(context);
      });
    },
    async remove(identity: FoucIdentity, input: unknown) {
      const value = parseInput(channelScopeSchema, input);
      const files = await withChannel(pool, identity, value.projectId, value.channelId, true, async context => {
        if (context.role !== 'owner') throw new ResourceRequestError('FORBIDDEN', '只有频道所有者可以删除频道。', 403);
        const messages = await context.db.select().from(chatMessage).where(messageWhere(value.projectId, value.channelId));
        await context.db.delete(chatChannel).where(channelWhere(value.projectId, value.channelId));
        return messages.flatMap(message => message.attachments);
      });
      await cleanupChannelFiles(storage, files);
      return { ok: true as const };
    },
  };
}
export type ChannelService = ReturnType<typeof createChannelService>;
