import { z } from 'zod';
import { entityIdSchema, paginationSchema, permissionLevelSchema, principalSchema, timestampSchema, workspaceScopeSchema } from './primitives';

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
export const invitationRoleSchema = memberRoleSchema.exclude(['owner']);
export const createWorkspaceInputSchema = workspaceSchema.pick({ name: true, kind: true });
export const renameWorkspaceInputSchema = workspaceScopeSchema.extend({ name: workspaceSchema.shape.name });
export const listWorkspacesInputSchema = paginationSchema;
export const knowledgeBaseSchema = workspaceScopeSchema.extend({ id: entityIdSchema, name: z.string().trim().min(1).max(120) });
export const knowledgeBaseScopeSchema = workspaceScopeSchema.extend({ knowledgeBaseId: entityIdSchema });
export const createKnowledgeBaseInputSchema = knowledgeBaseSchema.omit({ id: true });
export const listKnowledgeBasesInputSchema = paginationSchema.extend({ workspaceId: entityIdSchema });
export const listOrganizationInputSchema = paginationSchema.extend({ workspaceId: entityIdSchema });
export const listGroupMembersInputSchema = listOrganizationInputSchema.extend({ groupId: entityIdSchema });
export const changeMemberRoleInputSchema = memberSchema;
export const removeMemberInputSchema = workspaceScopeSchema.extend({ userId: entityIdSchema });
export const createGroupInputSchema = groupSchema.omit({ id: true });
export const renameGroupInputSchema = groupSchema;
export const removeGroupInputSchema = workspaceScopeSchema.extend({ groupId: entityIdSchema });
export const groupMemberInputSchema = groupMemberSchema;
export const createWorkspaceInvitationInputSchema = workspaceScopeSchema.extend({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  role: invitationRoleSchema,
});
export const workspaceInvitationSchema = workspaceScopeSchema.extend({
  id: entityIdSchema,
  email: z.email(),
  role: invitationRoleSchema,
  invitedBy: entityIdSchema,
  expiresAt: timestampSchema,
  createdAt: timestampSchema,
  acceptedAt: timestampSchema.nullable(),
  acceptedBy: entityIdSchema.nullable(),
  revokedAt: timestampSchema.nullable(),
});
export const acceptWorkspaceInvitationInputSchema = workspaceScopeSchema.extend({
  invitationId: entityIdSchema,
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const revokeWorkspaceInvitationInputSchema = workspaceScopeSchema.extend({ invitationId: entityIdSchema });
export const workspaceMemberSummarySchema = memberSchema.extend({ name: z.string(), email: z.email() });
export const teamspaceSchema = workspaceScopeSchema.extend({
  id: entityIdSchema,
  knowledgeBaseId: entityIdSchema,
  name: z.string().trim().min(1).max(120),
  defaultAccess: permissionLevelSchema.nullable(),
});
export const teamspaceScopeSchema = workspaceScopeSchema.extend({ teamspaceId: entityIdSchema });
export const createTeamspaceInputSchema = teamspaceSchema.omit({ id: true }).extend({ defaultAccess: teamspaceSchema.shape.defaultAccess.default(null) });
export const listTeamspacesInputSchema = listOrganizationInputSchema.extend({ knowledgeBaseId: entityIdSchema.optional() });
export const updateTeamspaceInputSchema = teamspaceScopeSchema.extend({
  name: teamspaceSchema.shape.name.optional(),
  defaultAccess: teamspaceSchema.shape.defaultAccess.optional(),
}).refine((value) => value.name !== undefined || value.defaultAccess !== undefined, { message: 'At least one teamspace field is required' });
export const removeTeamspaceInputSchema = teamspaceScopeSchema;
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
export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;
export type Member = z.infer<typeof memberSchema>;
export type MemberRole = z.infer<typeof memberRoleSchema>;
export type Group = z.infer<typeof groupSchema>;
export type WorkspaceInvitation = z.infer<typeof workspaceInvitationSchema>;
export type WorkspaceMemberSummary = z.infer<typeof workspaceMemberSummarySchema>;
export type Teamspace = z.infer<typeof teamspaceSchema>;
export type TeamspaceScope = z.infer<typeof teamspaceScopeSchema>;
export type PageAcl = z.infer<typeof pageAclSchema>;
export type EffectivePermissions = z.infer<typeof effectivePermissionsSchema>;
export type Actor = z.infer<typeof actorSchema>;
