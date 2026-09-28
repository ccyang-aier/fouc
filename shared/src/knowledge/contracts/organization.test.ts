import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { acceptWorkspaceInvitationInputSchema, createWorkspaceInputSchema, createWorkspaceInvitationInputSchema, changeMemberRoleInputSchema, listOrganizationInputSchema } from '../../workspaces';
import { createTeamspaceInputSchema, teamspaceScopeSchema, updateTeamspaceInputSchema } from './organization';


test('organization mutations reject injected actor identity and owner invitations', () => {
  const workspaceId = randomUUID();
  assert.equal(createWorkspaceInputSchema.safeParse({ name: 'Personal', kind: 'personal', userId: randomUUID() }).success, false);
  assert.equal(createWorkspaceInvitationInputSchema.safeParse({ workspaceId, email: 'a@example.test', role: 'owner' }).success, false);
  assert.equal(createWorkspaceInvitationInputSchema.parse({ workspaceId, email: 'A@EXAMPLE.TEST', role: 'member' }).email, 'a@example.test');
  assert.equal(changeMemberRoleInputSchema.safeParse({ workspaceId, userId: randomUUID(), role: 'admin', actorUserId: randomUUID() }).success, false);
  assert.equal(acceptWorkspaceInvitationInputSchema.safeParse({ workspaceId, invitationId: randomUUID(), token: 'short' }).success, false);
  assert.equal(listOrganizationInputSchema.parse({ workspaceId }).limit, 50);
  assert.equal(listOrganizationInputSchema.safeParse({ workspaceId, limit: 101 }).success, false);
});

test('teamspace inputs preserve null defaults, explicit patches and server-owned identity', () => {
  const workspaceId = randomUUID();
  const teamspaceId = randomUUID();
  assert.equal(createTeamspaceInputSchema.parse({ workspaceId, knowledgeBaseId: randomUUID(), name: '  Research  ' }).defaultAccess, null);
  assert.equal(createTeamspaceInputSchema.parse({ workspaceId, knowledgeBaseId: randomUUID(), name: '  Research  ' }).name, 'Research');
  assert.equal(createTeamspaceInputSchema.safeParse({ workspaceId, knowledgeBaseId: randomUUID(), name: 'Research', id: teamspaceId }).success, false);
  assert.equal(createTeamspaceInputSchema.safeParse({ workspaceId, knowledgeBaseId: randomUUID(), name: 'Research', userId: randomUUID() }).success, false);
  assert.equal(updateTeamspaceInputSchema.safeParse({ workspaceId, teamspaceId }).success, false);
  assert.equal(updateTeamspaceInputSchema.parse({ workspaceId, teamspaceId, defaultAccess: null }).defaultAccess, null);
  assert.equal(updateTeamspaceInputSchema.safeParse({ workspaceId, teamspaceId, defaultAccess: 'owner' }).success, false);
  assert.equal(updateTeamspaceInputSchema.safeParse({ workspaceId, teamspaceId, name: ' ' }).success, false);
  assert.equal(teamspaceScopeSchema.safeParse({ workspaceId, teamspaceId: 'invalid' }).success, false);
});
