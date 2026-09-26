import { z } from 'zod';
import { entityIdSchema, permissionLevelSchema, principalSchema, timestampSchema, workspaceScopeSchema } from './primitives';

export const workspaceKindSchema = z.enum(['personal', 'team']);
export const memberRoleSchema = z.enum(['owner', 'admin', 'member', 'guest']);
export const workspaceSchema = z.strictObject({
  id: entityIdSchema,
  name: z.string().trim().min(1).max(120),
  kind: workspaceKindSchema,
  settings: z.record(z.string(), z.json()),
});
export const memberSchema = workspaceScopeSchema.extend({ userId: entityIdSchema, role: memberRoleSchema });
export const groupSchema = workspaceScopeSchema.extend({ id: entityIdSchema, name: z.string().trim().min(1).max(120) });
export const groupMemberSchema = workspaceScopeSchema.extend({ groupId: entityIdSchema, userId: entityIdSchema });
export const teamspaceSchema = workspaceScopeSchema.extend({
  id: entityIdSchema,
  name: z.string().trim().min(1).max(120),
  defaultAccess: permissionLevelSchema.nullable(),
});
export const pageAclSchema = workspaceScopeSchema.extend({
  pageId: entityIdSchema,
  principal: principalSchema,
  level: permissionLevelSchema,
  inherited: z.boolean().default(false),
});
export const effectivePermissionsSchema = z.strictObject({
  view: z.array(principalSchema),
  comment: z.array(principalSchema),
  edit: z.array(principalSchema),
  full: z.array(principalSchema),
});

// Server-created identity: never accepted from a mutation's request body.
export const actorSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('human'), userId: entityIdSchema }),
  z.strictObject({ kind: z.literal('agent'), userId: entityIdSchema, taskId: entityIdSchema }),
  z.strictObject({ kind: z.literal('mcp'), userId: entityIdSchema, taskId: entityIdSchema, clientName: z.string().min(1).max(120) }),
]);
export const sessionSummarySchema = z.strictObject({
  user: z.strictObject({ id: entityIdSchema, name: z.string(), email: z.email(), image: z.url().nullable() }),
  expiresAt: timestampSchema,
});

export type Workspace = z.infer<typeof workspaceSchema>;
export type Member = z.infer<typeof memberSchema>;
export type MemberRole = z.infer<typeof memberRoleSchema>;
export type Group = z.infer<typeof groupSchema>;
export type Teamspace = z.infer<typeof teamspaceSchema>;
export type PageAcl = z.infer<typeof pageAclSchema>;
export type EffectivePermissions = z.infer<typeof effectivePermissionsSchema>;
export type Actor = z.infer<typeof actorSchema>;
