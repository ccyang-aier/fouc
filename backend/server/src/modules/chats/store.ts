import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import type { Channel, ChannelMember, ChannelMessage, ChannelRole, ChannelSnapshot } from '@fouc/shared/chats';
import { chatChannel, chatChannelMember, chatMessage } from '../../platform/database/resources/schema/chats';
import type { ResourceTransaction } from '../../platform/database/resources/transaction';
import type { FoucIdentity } from '../../platform/identity/identity';
import { withProjectMember } from '../projects/access';
import { ResourceRequestError } from '../../platform/resources/errors';

export type ChannelRow = typeof chatChannel.$inferSelect;
export type ChannelMemberRow = typeof chatChannelMember.$inferSelect;
export type ChannelMessageRow = typeof chatMessage.$inferSelect;
export type ChannelContext = { db: ResourceTransaction; channel: ChannelRow; actor: ChannelMemberRow; role: ChannelRole; identity: FoucIdentity };
export const channelWhere = (projectId: string, channelId: string) => and(eq(chatChannel.projectId, projectId), eq(chatChannel.id, channelId));
export const memberWhere = (projectId: string, channelId: string) => and(eq(chatChannelMember.projectId, projectId), eq(chatChannelMember.channelId, channelId));
export const messageWhere = (projectId: string, channelId: string) => and(eq(chatMessage.projectId, projectId), eq(chatMessage.channelId, channelId));
export const missingChannel = () => new ResourceRequestError('PROJECT_NOT_FOUND', '频道不存在或你已不再是频道成员。', 404);

export function memberView(row: ChannelMemberRow): ChannelMember {
  return { id: row.id, userId: row.userId, name: row.name, image: row.image, kind: row.kind, role: row.role,
    installationId: row.installationId, agentOwnerId: row.kind === 'agent' ? row.userId : null, joinedAt: row.joinedAt.toISOString(), active: row.active };
}
export function messageView(row: ChannelMessageRow): ChannelMessage {
  return { id: row.id, projectId: row.projectId, channelId: row.channelId, authorId: row.authorId,
    authorName: row.authorName, authorImage: row.authorImage, authorKind: row.authorKind,
    kind: row.kind, body: row.body, title: row.title, threadId: row.threadId, pinned: row.pinned, poll: row.poll,
    reactions: row.reactions, attachments: row.attachments.map(({ objectKey: _objectKey, ...attachment }) => attachment),
    createdAt: row.createdAt.toISOString(), editedAt: row.editedAt?.toISOString() ?? null, execution: row.execution };
}
export async function channelViews(db: ResourceTransaction, rows: ChannelRow[]): Promise<Channel[]> {
  if (!rows.length) return [];
  const projectId = rows[0]!.projectId;
  const members = await db.execute<{ channel_id: string; count: number }>(sql`SELECT channel_id, count(*)::int AS count FROM resources.chat_channel_member WHERE project_id = ${projectId} AND active GROUP BY channel_id`);
  const messages = await db.execute<{ channel_id: string; count: number; updated: Date }>(sql`SELECT channel_id, count(*)::int AS count, max(created_at) AS updated FROM resources.chat_message WHERE project_id = ${projectId} GROUP BY channel_id`);
  const last = await db.execute<{ channel_id: string; preview: string | null }>(sql`SELECT DISTINCT ON (channel_id) channel_id,
    coalesce(nullif(btrim(body), ''), nullif(poll->>'question', ''), nullif(title, ''),
      (SELECT string_agg(file->>'name', '、') FROM jsonb_array_elements(attachments) AS file)) AS preview
    FROM resources.chat_message WHERE project_id = ${projectId} ORDER BY channel_id, created_at DESC, id DESC`);
  return rows.map(row => {
    const activity = messages.rows.find(item => item.channel_id === row.id);
    const updatedAt = activity?.updated && new Date(activity.updated).getTime() > row.updatedAt.getTime() ? new Date(activity.updated) : row.updatedAt;
    return { id: row.id, projectId: row.projectId, name: row.name, description: row.description,
      color: row.color as Channel['color'], visibility: row.visibility as Channel['visibility'], ownerId: row.ownerId,
      permissions: row.permissions, createdAt: row.createdAt.toISOString(), updatedAt: updatedAt.toISOString(),
      memberCount: members.rows.find(item => item.channel_id === row.id)?.count ?? 0,
      messageCount: activity?.count ?? 0, lastMessage: last.rows.find(item => item.channel_id === row.id)?.preview ?? null };
  });
}
export async function channelSnapshot(context: ChannelContext): Promise<ChannelSnapshot> {
  const { db, channel, actor, role } = context;
  const [current] = await db.select().from(chatChannel).where(channelWhere(channel.projectId, channel.id));
  if (!current) throw missingChannel();
  const members = await db.select().from(chatChannelMember).where(memberWhere(channel.projectId, channel.id)).orderBy(asc(chatChannelMember.joinedAt));
  const messages = await db.select().from(chatMessage).where(messageWhere(channel.projectId, channel.id)).orderBy(desc(chatMessage.createdAt), desc(chatMessage.id)).limit(501);
  return { channel: (await channelViews(db, [current]))[0]!, members: members.map(memberView), messages: messages.slice(0, 500).reverse().map(messageView), actorId: actor.id, actorRole: role, hasMoreMessages: messages.length > 500 };
}
export function withChannel<T>(pool: Pool, identity: FoucIdentity, projectId: string, channelId: string, write: boolean,
  operation: (context: ChannelContext) => Promise<T>) {
  return withProjectMember(pool, identity, projectId, write, async ({ db }) => {
    // The owning project transaction already serializes mutations. Locking a
    // channel row would also apply its manager-only UPDATE RLS to normal readers.
    const [channel] = await db.select().from(chatChannel).where(channelWhere(projectId, channelId));
    if (!channel) throw missingChannel();
    let [actor] = await db.select().from(chatChannelMember).where(and(memberWhere(projectId, channelId), eq(chatChannelMember.userId, identity.userId), eq(chatChannelMember.kind, 'user')));
    if (!actor?.active) {
      if (channel.visibility !== 'project' && channel.ownerId !== identity.userId) throw missingChannel();
      const user = await db.execute<{ name: string; image: string | null }>(sql`SELECT name, image FROM auth."user" WHERE id = ${identity.userId}`);
      const values = { active: true, name: user.rows[0]!.name, image: user.rows[0]!.image, role: channel.ownerId === identity.userId ? 'owner' as const : 'member' as const };
      if (actor) [actor] = await db.update(chatChannelMember).set(values).where(and(memberWhere(projectId, channelId), eq(chatChannelMember.id, actor.id))).returning();
      else {
        await db.insert(chatChannelMember).values({ projectId, channelId, id: crypto.randomUUID(), userId: identity.userId, ...values }).onConflictDoNothing();
        [actor] = await db.select().from(chatChannelMember).where(and(memberWhere(projectId, channelId), eq(chatChannelMember.userId, identity.userId), eq(chatChannelMember.kind, 'user')));
      }
    }
    if (!actor) throw missingChannel();
    const role = channel.ownerId === identity.userId ? 'owner' : actor.role;
    return operation({ db, channel, actor, role, identity });
  });
}
export async function findMessage(context: ChannelContext, messageId: string): Promise<ChannelMessageRow> {
  const [message] = await context.db.select().from(chatMessage).where(and(messageWhere(context.channel.projectId, context.channel.id), eq(chatMessage.id, messageId))).for('update');
  if (!message) throw new ResourceRequestError('INVALID_INPUT', '消息不存在或已被删除。', 404);
  return message;
}
