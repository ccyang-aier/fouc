import { z } from 'zod';

export const entityIdSchema = z.uuid();
export const blockIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const timestampSchema = z.iso.datetime({ offset: true });
export const workspaceScopeSchema = z.strictObject({ workspaceId: entityIdSchema });
export const pageScopeSchema = workspaceScopeSchema.extend({ pageId: entityIdSchema });
export const assetHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const assetSourceSchema = z.string().regex(/^asset:[a-f0-9]{64}$/);

export const permissionLevels = ['view', 'comment', 'edit', 'full'] as const;
export const permissionLevelSchema = z.enum(permissionLevels);
export type PermissionLevel = z.infer<typeof permissionLevelSchema>;

export const principalKinds = ['user', 'group', 'workspace', 'link'] as const;
export type PrincipalKind = typeof principalKinds[number];
export type Principal = `${PrincipalKind}:${string}`;
export const principalSchema = z.string().superRefine((value, context) => {
  const [kind, id, extra] = value.split(':');
  if (!principalKinds.some((candidate) => candidate === kind) || extra !== undefined || !entityIdSchema.safeParse(id).success) {
    context.addIssue({ code: 'custom', message: '主体必须是 user/group/workspace/link 与 UUID 的组合' });
  }
}).transform((value) => value as Principal);

export function principal(kind: PrincipalKind, id: string): Principal {
  return principalSchema.parse(`${kind}:${id}`);
}

export const paginationSchema = z.strictObject({
  cursor: entityIdSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type WorkspaceScope = z.infer<typeof workspaceScopeSchema>;
export type PageScope = z.infer<typeof pageScopeSchema>;
