import {
  aiTaskSchema,
  assetStatusSchema,
  commentThreadSchema,
  memberRoleSchema,
  modelTiers,
  outboxEventSchema,
  pageKindSchema,
  permissionLevels,
  workspaceKindSchema,
} from '@fouc/shared/knowledge/contracts';
import { knowledge } from './namespaces';

// Zod exposes options as arrays; Drizzle requires a non-empty tuple. Keep enum
// values source-owned while using the PgEnum representation supported by Kit.
function values<T extends string>(options: readonly T[]): [T, ...T[]] {
  const [first, ...rest] = options;
  if (first === undefined) throw new Error('A database enum must not be empty');
  return [first, ...rest];
}

export const workspaceKind = knowledge.enum('workspace_kind', values(workspaceKindSchema.options));
export const memberRole = knowledge.enum('member_role', values(memberRoleSchema.options));
export const pageKind = knowledge.enum('page_kind', values(pageKindSchema.options));
export const permissionLevel = knowledge.enum('permission_level', permissionLevels);
export const modelTier = knowledge.enum('model_tier', modelTiers);
export const commentThreadStatus = knowledge.enum('comment_thread_status', values(commentThreadSchema.shape.status.options));
export const assetStatus = knowledge.enum('asset_status', values(assetStatusSchema.options));
export const aiTaskKind = knowledge.enum('ai_task_kind', values(aiTaskSchema.shape.kind.options));
export const aiTaskStatus = knowledge.enum('ai_task_status', values(aiTaskSchema.shape.status.options));

const topics = outboxEventSchema.options.map((option) => option.shape.topic.value);
export const outboxTopic = knowledge.enum('outbox_topic', values(topics));
