import { z } from 'zod';
import { entityIdSchema as id } from '../resources';

export const CHANNEL_FILE_MAX_BYTES = 20 * 1024 * 1024;
export const CHANNEL_FILE_LIMIT = 8;
export const CHANNEL_FILE_TOTAL_MAX_BYTES = 80 * 1024 * 1024;
export const channelScopeSchema = z.strictObject({ projectId: id, channelId: id });
export const channelPermissionSchema = z.enum(['members', 'admins']);
export const channelRoleSchema = z.enum(['owner', 'admin', 'member']);
export const channelColorSchema = z.enum(['violet', 'blue', 'green', 'orange', 'rose', 'slate']);
export type ChannelRole = z.infer<typeof channelRoleSchema>;
export type ChannelPermissions = { invite: 'members' | 'admins'; post: 'members' | 'admins' };
export type Channel = {
  id: string; projectId: string; name: string; description: string;
  color: z.infer<typeof channelColorSchema>; visibility: 'private' | 'project';
  ownerId: string; permissions: ChannelPermissions; memberCount: number;
  messageCount: number; lastMessage: string | null; createdAt: string; updatedAt: string;
};
export type ChannelMember = {
  id: string; userId: string; name: string; image: string | null;
  kind: 'user' | 'agent'; role: ChannelRole; installationId: string | null;
  agentOwnerId: string | null; joinedAt: string; active: boolean;
};
export type ChannelAttachment = {
  id: string; name: string; mime: string; size: number;
  messageId: string; createdAt: string;
};
export type ChannelPoll = { question: string; options: { id: string; text: string; voterIds: string[] }[]; closed: boolean };
export type ChannelMessage = {
  id: string; projectId: string; channelId: string; authorId: string;
  authorName: string; authorImage: string | null; authorKind: 'user' | 'agent';
  kind: 'text' | 'topic' | 'poll' | 'summary'; body: string; title: string | null;
  threadId: string | null; pinned: boolean; poll: ChannelPoll | null;
  reactions: { emoji: string; userIds: string[] }[];
  attachments: ChannelAttachment[]; createdAt: string; editedAt: string | null;
  execution?: { sessionId: string; runId: string } | null;
};
export type ChannelSnapshot = {
  channel: Channel; members: ChannelMember[]; messages: ChannelMessage[];
  actorId: string; actorRole: ChannelRole;
  hasMoreMessages?: boolean;
};
export type ChannelMessagePage = { items: ChannelMessage[]; hasMore: boolean };
export const createChannelInputSchema = z.strictObject({
  projectId: id, name: z.string().trim().min(1).max(80), description: z.string().trim().max(1000).default(''),
  color: channelColorSchema.default('violet'), visibility: z.enum(['private', 'project']).default('private'),
  memberIds: z.array(id).max(200).default([]),
});
export type CreateChannelInput = Omit<z.input<typeof createChannelInputSchema>, 'projectId'>;
export const updateChannelInputSchema = channelScopeSchema.extend({
  name: z.string().trim().min(1).max(80).optional(), description: z.string().trim().max(1000).optional(),
  color: channelColorSchema.optional(), visibility: z.enum(['private', 'project']).optional(),
  permissions: z.strictObject({ invite: channelPermissionSchema, post: channelPermissionSchema }).optional(),
});
export type UpdateChannelInput = Omit<z.infer<typeof updateChannelInputSchema>, 'projectId' | 'channelId'>;
export const sendChannelMessageSchema = channelScopeSchema.extend({
  body: z.string().trim().max(20000).default(''), kind: z.enum(['text', 'topic', 'poll', 'summary']).default('text'),
  title: z.string().trim().min(1).max(200).optional(), threadId: id.optional(),
  poll: z.strictObject({ question: z.string().trim().min(1).max(300), options: z.array(z.string().trim().min(1).max(200)).min(2).max(10) }).optional(),
});
export type SendChannelMessageInput = Omit<z.input<typeof sendChannelMessageSchema>, 'projectId' | 'channelId'>;
export const channelMessageScopeSchema = channelScopeSchema.extend({ messageId: id });
export const updateChannelMessageSchema = channelMessageScopeSchema.extend({ body: z.string().trim().min(1).max(20000).optional(), pinned: z.boolean().optional(), closed: z.boolean().optional() })
  .refine(value => value.body !== undefined || value.pinned !== undefined || value.closed !== undefined);
export const addChannelMembersSchema = channelScopeSchema.extend({ userIds: z.array(id).min(1).max(200) });
export const channelMemberScopeSchema = channelScopeSchema.extend({ memberId: id });
export const setChannelMemberRoleSchema = channelMemberScopeSchema.extend({ role: z.enum(['admin', 'member']) });
export const addChannelAgentSchema = channelScopeSchema.extend({ installationId: z.string().trim().min(1).max(200), name: z.string().trim().min(1).max(100), image: z.string().max(1000).nullable().optional() });
export const toggleChannelReactionSchema = channelMessageScopeSchema.extend({ emoji: z.enum(['👍', '❤️', '🎉', '👀', '✅', '🚀', '💡', '🙏', '😂']) });
export const voteChannelPollSchema = channelMessageScopeSchema.extend({ optionId: id });
export const channelAttachmentScopeSchema = channelMessageScopeSchema.extend({ attachmentId: id });
export const channelAgentMessageSchema = channelMemberScopeSchema.extend({ body: z.string().trim().min(1).max(20000), threadId: id.optional(), execution: z.strictObject({ sessionId: z.string().min(1).max(200), runId: z.string().min(1).max(200) }).optional() });
export const channelMessagePageSchema = channelScopeSchema.extend({ before: id.optional(), limit: z.coerce.number().int().min(1).max(100).default(100) });
