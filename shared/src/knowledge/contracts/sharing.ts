import { z } from 'zod';
import { entityIdSchema, pageScopeSchema, permissionLevelSchema, timestampSchema, workspaceScopeSchema } from './primitives';

/**
 * 分享链接是只读加批注的凭证：可授予的级别上限是 comment，
 * 永远不出现 edit/full（写入必须走成员身份与建议模式）。
 */
export const shareLinkLevels = ['view', 'comment'] as const;
export const shareLinkLevelSchema = z.enum(shareLinkLevels);
export type ShareLinkLevel = z.infer<typeof shareLinkLevelSchema>;

/** 传输格式 fouc_share.<workspaceId>.<shareId>.<secret>；仅创建响应出现一次明文。 */
export const shareTokenSchema = z.string().regex(
  /^fouc_share\.[0-9a-fA-F-]{36}\.[0-9a-fA-F-]{36}\.[A-Za-z0-9_-]{43}$/,
  '分享令牌格式不正确',
);
export const createShareLinkInputSchema = pageScopeSchema.extend({
  level: shareLinkLevelSchema,
  expiresAt: timestampSchema.nullable(),
});
export const shareLinkScopeSchema = workspaceScopeSchema.extend({ shareId: entityIdSchema });
export const revokeShareLinkInputSchema = shareLinkScopeSchema;
export const setShareLinkLevelInputSchema = shareLinkScopeSchema.extend({ level: shareLinkLevelSchema });
/** 链接持有者没有会话：令牌即凭证，租户由令牌定位段决定。 */
export const shareLinkAccessInputSchema = z.strictObject({
  token: shareTokenSchema,
  pageId: entityIdSchema,
  action: permissionLevelSchema,
});
export const shareLinkSummarySchema = pageScopeSchema.extend({
  id: entityIdSchema,
  level: shareLinkLevelSchema,
  createdBy: entityIdSchema,
  createdAt: timestampSchema,
  expiresAt: timestampSchema.nullable(),
  revokedAt: timestampSchema.nullable(),
});
export type ShareLinkSummary = z.infer<typeof shareLinkSummarySchema>;
