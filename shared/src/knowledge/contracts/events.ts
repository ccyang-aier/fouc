import { z } from 'zod';
import { assetHashSchema, entityIdSchema, timestampSchema, workspaceScopeSchema } from './primitives';
import { actorSchema } from './organization';

const eventBase = workspaceScopeSchema.extend({ id: entityIdSchema, occurredAt: timestampSchema });
const pageEvent = <T extends string>(type: T) => eventBase.extend({ type: z.literal(type), ids: z.array(entityIdSchema).min(1) });
export const workspaceEventSchema = z.discriminatedUnion('type', [
  pageEvent('page.created'),
  pageEvent('page.updated'),
  pageEvent('page.moved'),
  pageEvent('page.deleted'),
  pageEvent('acl.changed'),
  eventBase.extend({ type: z.literal('comment.changed'), pageId: entityIdSchema, threadId: entityIdSchema }),
  eventBase.extend({ type: z.literal('notification.created'), userId: entityIdSchema, notificationId: entityIdSchema }),
  eventBase.extend({ type: z.literal('database.rows.changed'), databaseId: entityIdSchema, ids: z.array(entityIdSchema) }),
  eventBase.extend({ type: z.literal('asset.updated'), hash: assetHashSchema }),
  eventBase.extend({ type: z.literal('ai.task.changed'), taskId: entityIdSchema }),
]);

export const outboxEventSchema = z.discriminatedUnion('topic', [
  workspaceScopeSchema.extend({ topic: z.literal('doc.changed'), pageId: entityIdSchema, actor: actorSchema, occurredAt: timestampSchema }),
  workspaceScopeSchema.extend({ topic: z.literal('acl.changed'), rootPageId: entityIdSchema, revision: z.number().int().nonnegative() }),
  workspaceScopeSchema.extend({ topic: z.literal('asset.created'), hash: assetHashSchema, initiatedBy: entityIdSchema }),
  workspaceScopeSchema.extend({ topic: z.literal('workspace.event'), event: workspaceEventSchema }),
]).superRefine((event, context) => {
  if (event.topic === 'workspace.event' && event.workspaceId !== event.event.workspaceId) context.addIssue({ code: 'custom', message: '事件不得跨工作区嵌套' });
});
export const aiTaskSchema = workspaceScopeSchema.extend({
  id: entityIdSchema,
  initiatedBy: entityIdSchema,
  kind: z.enum(['inline', 'continue', 'chat', 'aiBlock', 'organize', 'report', 'mcp']),
  status: z.enum(['running', 'awaiting_approval', 'done', 'failed']),
  state: z.record(z.string(), z.json()),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export const awarenessStateSchema = z.strictObject({
  user: z.strictObject({ id: entityIdSchema, name: z.string().min(1).max(120), image: z.url().nullable().optional() }),
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  kind: z.enum(['human', 'agent']),
  // y-prosemirror relative positions are transported as JSON by y-protocols.
  cursor: z.json().nullable(),
  selection: z.json().nullable(),
  isEditing: z.boolean(),
  taskId: entityIdSchema.optional(),
});

export type WorkspaceEvent = z.infer<typeof workspaceEventSchema>;
export type OutboxEvent = z.infer<typeof outboxEventSchema>;
export type AiTask = z.infer<typeof aiTaskSchema>;
export type AwarenessState = z.infer<typeof awarenessStateSchema>;
