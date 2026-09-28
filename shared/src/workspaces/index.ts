import { z } from 'zod';
import { entityIdSchema, paginationSchema, timestampSchema, workspaceScopeSchema } from './primitives';
export * from './primitives';

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
export type Workspace = z.infer<typeof workspaceSchema>;
export type Member = z.infer<typeof memberSchema>;
export type MemberRole = z.infer<typeof memberRoleSchema>;
export type Group = z.infer<typeof groupSchema>;
export type WorkspaceInvitation = z.infer<typeof workspaceInvitationSchema>;
export type WorkspaceMemberSummary = z.infer<typeof workspaceMemberSummarySchema>;
