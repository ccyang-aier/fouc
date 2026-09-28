import { aiTaskSchema, assetStatusSchema, commentThreadSchema, modelTiers, outboxEventSchema, pageKindSchema, permissionLevels } from '@fouc/shared/knowledge/contracts';
import { memberRoleSchema, workspaceKindSchema } from '@fouc/shared/workspaces';
import { workspaceNamespace } from './namespaces';

// Zod exposes options as arrays; Drizzle requires a non-empty tuple. Keep enum
// values source-owned while using the PgEnum representation supported by Kit.
function values<T extends string>(options: readonly T[]): [T, ...T[]] {
  const [first, ...rest] = options;
  if (first === undefined) throw new Error('A database enum must not be empty');
  return [first, ...rest];
}

export const workspaceKind = workspaceNamespace.enum('workspace_kind', values(workspaceKindSchema.options));
export const memberRole = workspaceNamespace.enum('member_role', values(memberRoleSchema.options));
export const pageKind = workspaceNamespace.enum('page_kind', values(pageKindSchema.options));
export const permissionLevel = workspaceNamespace.enum('permission_level', permissionLevels);
export const modelTier = workspaceNamespace.enum('model_tier', modelTiers);
export const commentThreadStatus = workspaceNamespace.enum('comment_thread_status', values(commentThreadSchema.shape.status.options));
export const assetStatus = workspaceNamespace.enum('asset_status', values(assetStatusSchema.options));
export const aiTaskKind = workspaceNamespace.enum('ai_task_kind', values(aiTaskSchema.shape.kind.options));
export const aiTaskStatus = workspaceNamespace.enum('ai_task_status', values(aiTaskSchema.shape.status.options));

const topics = outboxEventSchema.options.map((option) => option.shape.topic.value);
export const outboxTopic = workspaceNamespace.enum('outbox_topic', values(topics));
