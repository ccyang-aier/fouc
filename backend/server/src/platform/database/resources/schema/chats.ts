import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, jsonb, primaryKey, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import type { ChannelAttachment, ChannelPermissions, ChannelPoll, ChannelRole, ChannelMessage } from '@fouc/shared/chats';
import { resourcesNamespace } from './namespaces';
import { instant } from './types';
import { project, projectMember } from './projects';
import { authUser } from '../../identity/schema';

export type StoredChannelAttachment = ChannelAttachment & { objectKey: string };
export const chatChannel = resourcesNamespace.table('chat_channel', {
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  id: uuid('id').notNull(), name: varchar('name', { length: 80 }).notNull(), description: text('description').notNull().default(''),
  color: varchar('color', { length: 8 }).notNull().default('violet'), visibility: varchar('visibility', { length: 8 }).notNull().default('private'),
  ownerId: uuid('owner_id').notNull().references(() => authUser.id),
  permissions: jsonb('permissions').$type<ChannelPermissions>().notNull().default({ invite: 'members', post: 'members' }),
  createdAt: instant('created_at').notNull().defaultNow(), updatedAt: instant('updated_at').notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.projectId, table.id] }),
  check('chat_channel_name_valid', sql`length(btrim(${table.name})) > 0`),
  check('chat_channel_visibility_valid', sql`${table.visibility} IN ('private', 'project')`),
  check('chat_channel_color_valid', sql`${table.color} IN ('violet', 'blue', 'green', 'orange', 'rose', 'slate')`),
  check('chat_channel_permissions_valid', sql`${table.permissions}->>'invite' IN ('members', 'admins') AND ${table.permissions}->>'post' IN ('members', 'admins')`),
  index('chat_channel_project_updated_idx').on(table.projectId, table.updatedAt),
]);
export const chatChannelMember = resourcesNamespace.table('chat_channel_member', {
  projectId: uuid('project_id').notNull(), channelId: uuid('channel_id').notNull(), id: uuid('id').notNull(),
  userId: uuid('user_id').notNull(), name: varchar('name', { length: 120 }).notNull(), image: text('image'),
  kind: varchar('kind', { length: 8 }).$type<'user' | 'agent'>().notNull().default('user'),
  role: varchar('role', { length: 8 }).$type<ChannelRole>().notNull().default('member'),
  installationId: varchar('installation_id', { length: 200 }), active: boolean('active').notNull().default(true),
  joinedAt: instant('joined_at').notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.projectId, table.channelId, table.id] }),
  foreignKey({ name: 'chat_member_channel_fk', columns: [table.projectId, table.channelId], foreignColumns: [chatChannel.projectId, chatChannel.id] }).onDelete('cascade'),
  foreignKey({ name: 'chat_member_project_member_fk', columns: [table.projectId, table.userId], foreignColumns: [projectMember.projectId, projectMember.userId] }).onDelete('cascade'),
  check('chat_member_kind_valid', sql`(${table.kind} = 'user' AND ${table.installationId} IS NULL) OR (${table.kind} = 'agent' AND ${table.installationId} IS NOT NULL AND ${table.role} = 'member')`),
  check('chat_member_role_valid', sql`${table.role} IN ('owner', 'admin', 'member')`),
  index('chat_member_user_idx').on(table.projectId, table.channelId, table.userId),
  uniqueIndex('chat_member_human_unique').on(table.projectId, table.channelId, table.userId).where(sql`${table.kind} = 'user'`),
  uniqueIndex('chat_member_agent_unique').on(table.projectId, table.channelId, table.userId, table.installationId).where(sql`${table.kind} = 'agent'`),
]);
export const chatMessage = resourcesNamespace.table('chat_message', {
  projectId: uuid('project_id').notNull(), channelId: uuid('channel_id').notNull(), id: uuid('id').notNull(),
  authorId: uuid('author_id').notNull(), authorUserId: uuid('author_user_id').notNull(), authorName: varchar('author_name', { length: 120 }).notNull(),
  authorImage: text('author_image'), authorKind: varchar('author_kind', { length: 8 }).$type<'user' | 'agent'>().notNull().default('user'),
  kind: varchar('kind', { length: 8 }).$type<ChannelMessage['kind']>().notNull().default('text'), body: text('body').notNull().default(''), title: varchar('title', { length: 200 }),
  threadId: uuid('thread_id'), pinned: boolean('pinned').notNull().default(false), poll: jsonb('poll').$type<ChannelPoll>(),
  reactions: jsonb('reactions').$type<ChannelMessage['reactions']>().notNull().default([]),
  attachments: jsonb('attachments').$type<StoredChannelAttachment[]>().notNull().default([]),
  execution: jsonb('execution').$type<{ sessionId: string; runId: string }>(),
  createdAt: instant('created_at').notNull().defaultNow(), editedAt: instant('edited_at'),
}, table => [
  primaryKey({ columns: [table.projectId, table.channelId, table.id] }),
  foreignKey({ name: 'chat_message_channel_fk', columns: [table.projectId, table.channelId], foreignColumns: [chatChannel.projectId, chatChannel.id] }).onDelete('cascade'),
  check('chat_message_kind_valid', sql`${table.kind} IN ('text', 'topic', 'poll', 'summary')`),
  check('chat_message_author_kind_valid', sql`${table.authorKind} IN ('user', 'agent')`),
  check('chat_message_attachments_array', sql`jsonb_typeof(${table.attachments}) = 'array' AND jsonb_array_length(${table.attachments}) <= 8`),
  check('chat_message_reactions_array', sql`jsonb_typeof(${table.reactions}) = 'array'`),
  index('chat_message_created_idx').on(table.projectId, table.channelId, table.createdAt),
]);
