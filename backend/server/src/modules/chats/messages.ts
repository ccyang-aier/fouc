import { and, desc, eq, or, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import {
  channelAgentMessageSchema, channelAttachmentScopeSchema, channelMessagePageSchema, channelMessageScopeSchema, channelScopeSchema, sendChannelMessageSchema,
  toggleChannelReactionSchema, updateChannelMessageSchema, voteChannelPollSchema,
} from '@fouc/shared/chats';
import { chatChannelMember, chatMessage, type StoredChannelAttachment } from '../../platform/database/resources/schema/chats';
import type { FoucIdentity } from '../../platform/identity/identity';
import type { S3ObjectStorage } from '../../platform/storage/s3';
import { parseInput, ResourceRequestError } from '../../platform/resources/errors';
import { cleanupChannelFiles, openChannelFile, uploadChannelFiles } from './attachments';
import { channelManager, requireChannelCapability, requireChannelManager, requireMessageEditor } from './policy';
import { channelSnapshot, findMessage, memberWhere, messageView, messageWhere, withChannel, type ChannelContext, type ChannelMemberRow } from './store';

async function validateThread(context: ChannelContext, threadId?: string) {
  if (!threadId) return;
  const root = await findMessage(context, threadId);
  if (root.threadId) throw new ResourceRequestError('INVALID_INPUT', '回复需要关联话题根消息。', 400);
}
function authorValues(author: ChannelMemberRow) {
  return { authorId: author.id, authorUserId: author.userId, authorName: author.name, authorImage: author.image, authorKind: author.kind };
}
export function createChannelMessageActions(pool: Pool, storage?: S3ObjectStorage) {
  return {
    async messagePage(identity: FoucIdentity, input: unknown) {
      const value = parseInput(channelMessagePageSchema, input);
      return withChannel(pool, identity, value.projectId, value.channelId, false, async context => {
        let before: ReturnType<typeof sql> | undefined;
        if (value.before) {
          const [cursor] = await context.db.select().from(chatMessage).where(and(messageWhere(value.projectId, value.channelId), eq(chatMessage.id, value.before)));
          if (!cursor) throw new ResourceRequestError('INVALID_INPUT', '分页消息不存在。', 404);
          // Keep PostgreSQL timestamp precision instead of round-tripping through Date.
          before = sql`(${chatMessage.createdAt}, ${chatMessage.id}) < (SELECT created_at, id FROM resources.chat_message WHERE project_id = ${value.projectId} AND channel_id = ${value.channelId} AND id = ${cursor.id})`;
        }
        const rows = await context.db.select().from(chatMessage).where(and(messageWhere(value.projectId, value.channelId), before))
          .orderBy(desc(chatMessage.createdAt), desc(chatMessage.id)).limit(value.limit + 1);
        return { items: rows.slice(0, value.limit).reverse().map(messageView), hasMore: rows.length > value.limit };
      });
    },
    async assets(identity: FoucIdentity, input: unknown) {
      const value = parseInput(channelScopeSchema, input);
      return withChannel(pool, identity, value.projectId, value.channelId, false, async context => {
        const rows = await context.db.select({ attachments: chatMessage.attachments }).from(chatMessage)
          .where(and(messageWhere(value.projectId, value.channelId), sql`jsonb_array_length(${chatMessage.attachments}) > 0`)).orderBy(desc(chatMessage.createdAt));
        return { items: rows.flatMap(row => row.attachments.map(({ objectKey: _objectKey, ...file }) => file)) };
      });
    },
    async send(identity: FoucIdentity, input: unknown, files: File[] = []) {
      const value = parseInput(sendChannelMessageSchema, input);
      if (!value.body && !files.length && value.kind !== 'poll') throw new ResourceRequestError('INVALID_INPUT', '请填写消息或添加附件。', 400);
      if (value.kind === 'poll' && !value.poll || value.kind !== 'poll' && value.poll) throw new ResourceRequestError('INVALID_INPUT', '投票消息需要有效的题目和选项。', 400);
      if (value.kind === 'topic' && !value.title) throw new ResourceRequestError('INVALID_INPUT', '请填写话题标题。', 400);
      let uploaded: StoredChannelAttachment[] = [];
      try {
        return await withChannel(pool, identity, value.projectId, value.channelId, true, async context => {
          requireChannelCapability(context.role, context.channel.permissions, 'post');
          await validateThread(context, value.threadId);
          const id = crypto.randomUUID();
          uploaded = await uploadChannelFiles(storage, { projectId: value.projectId, channelId: value.channelId, messageId: id }, files);
          await context.db.insert(chatMessage).values({
            projectId: value.projectId, channelId: value.channelId, id, ...authorValues(context.actor), kind: value.kind,
            body: value.body, title: value.title ?? null, threadId: value.threadId ?? null, attachments: uploaded,
            poll: value.poll ? { question: value.poll.question, options: value.poll.options.map(text => ({ id: crypto.randomUUID(), text, voterIds: [] })), closed: false } : null,
          });
          return channelSnapshot(context);
        });
      } catch (error) { await cleanupChannelFiles(storage, uploaded); throw error; }
    },
    async sendAgentMessage(identity: FoucIdentity, input: unknown) {
      const value = parseInput(channelAgentMessageSchema, input);
      return withChannel(pool, identity, value.projectId, value.channelId, true, async context => {
        requireChannelCapability(context.role, context.channel.permissions, 'post');
        const [agent] = await context.db.select().from(chatChannelMember).where(and(memberWhere(value.projectId, value.channelId), eq(chatChannelMember.id, value.memberId)));
        if (!agent?.active || agent.kind !== 'agent' || agent.userId !== identity.userId) throw new ResourceRequestError('FORBIDDEN', '只能回传自己添加的 Agent 执行结果。', 403);
        await validateThread(context, value.threadId);
        await context.db.insert(chatMessage).values({ projectId: value.projectId, channelId: value.channelId, id: crypto.randomUUID(), ...authorValues(agent),
          body: value.body, threadId: value.threadId ?? null, execution: value.execution ?? null });
        return channelSnapshot(context);
      });
    },
    async updateMessage(identity: FoucIdentity, input: unknown) {
      const value = parseInput(updateChannelMessageSchema, input);
      return withChannel(pool, identity, value.projectId, value.channelId, true, async context => {
        const message = await findMessage(context, value.messageId);
        if (value.body !== undefined) { requireChannelCapability(context.role, context.channel.permissions, 'post'); requireMessageEditor(identity.userId, message.authorUserId, context.role, true); }
        if (value.pinned !== undefined) requireChannelManager(context.role);
        if (value.closed !== undefined) {
          requireMessageEditor(identity.userId, message.authorUserId, context.role, false);
          if (!message.poll) throw new ResourceRequestError('INVALID_INPUT', '这条消息不是投票。', 400);
        }
        await context.db.update(chatMessage).set({
          ...(value.body === undefined ? {} : { body: value.body, editedAt: new Date() }),
          ...(value.pinned === undefined ? {} : { pinned: value.pinned }),
          ...(value.closed === undefined ? {} : { poll: { ...message.poll!, closed: value.closed } }),
        }).where(and(messageWhere(value.projectId, value.channelId), eq(chatMessage.id, value.messageId)));
        return channelSnapshot(context);
      });
    },
    async removeMessage(identity: FoucIdentity, input: unknown) {
      const value = parseInput(channelMessageScopeSchema, input);
      const result = await withChannel(pool, identity, value.projectId, value.channelId, true, async context => {
        const message = await findMessage(context, value.messageId);
        requireMessageEditor(identity.userId, message.authorUserId, context.role, false);
        const predicate = and(messageWhere(value.projectId, value.channelId), or(eq(chatMessage.id, value.messageId), eq(chatMessage.threadId, value.messageId)));
        const records = await context.db.select().from(chatMessage).where(predicate);
        if (!channelManager(context.role) && records.some(record => record.authorUserId !== identity.userId)) {
          throw new ResourceRequestError('FORBIDDEN', '这条消息已有其他成员回复，需要频道管理员删除整个话题。', 403);
        }
        await context.db.delete(chatMessage).where(predicate);
        return { snapshot: await channelSnapshot(context), files: records.flatMap(record => record.attachments) };
      });
      await cleanupChannelFiles(storage, result.files);
      return result.snapshot;
    },
    async toggleReaction(identity: FoucIdentity, input: unknown) {
      const value = parseInput(toggleChannelReactionSchema, input);
      return withChannel(pool, identity, value.projectId, value.channelId, true, async context => {
        const message = await findMessage(context, value.messageId);
        const reactions = message.reactions.map(reaction => ({ ...reaction, userIds: [...reaction.userIds] }));
        const current = reactions.find(reaction => reaction.emoji === value.emoji);
        if (!current) reactions.push({ emoji: value.emoji, userIds: [context.actor.id] });
        else current.userIds = current.userIds.includes(context.actor.id) ? current.userIds.filter(id => id !== context.actor.id) : [...current.userIds, context.actor.id];
        await context.db.update(chatMessage).set({ reactions: reactions.filter(reaction => reaction.userIds.length) }).where(and(messageWhere(value.projectId, value.channelId), eq(chatMessage.id, value.messageId)));
        return channelSnapshot(context);
      });
    },
    async vote(identity: FoucIdentity, input: unknown) {
      const value = parseInput(voteChannelPollSchema, input);
      return withChannel(pool, identity, value.projectId, value.channelId, true, async context => {
        const message = await findMessage(context, value.messageId);
        if (!message.poll || message.poll.closed) throw new ResourceRequestError('CONFLICT', '投票已结束或不存在。', 409);
        if (!message.poll.options.some(option => option.id === value.optionId)) throw new ResourceRequestError('INVALID_INPUT', '投票选项不存在。', 400);
        const selected = message.poll.options.find(option => option.voterIds.includes(context.actor.id));
        const options = message.poll.options.map(option => ({ ...option, voterIds: [
          ...option.voterIds.filter(id => id !== context.actor.id), ...(option.id === value.optionId && selected?.id !== value.optionId ? [context.actor.id] : []),
        ] }));
        await context.db.update(chatMessage).set({ poll: { ...message.poll, options } }).where(and(messageWhere(value.projectId, value.channelId), eq(chatMessage.id, value.messageId)));
        return channelSnapshot(context);
      });
    },
    async attachment(identity: FoucIdentity, input: unknown) {
      const value = parseInput(channelAttachmentScopeSchema, input);
      const attachment = await withChannel(pool, identity, value.projectId, value.channelId, false, async context => {
        const message = await findMessage(context, value.messageId);
        const file = message.attachments.find(item => item.id === value.attachmentId);
        if (!file) throw new ResourceRequestError('INVALID_INPUT', '附件不存在或已被删除。', 404);
        return file;
      });
      return openChannelFile(storage, attachment);
    },
  };
}
