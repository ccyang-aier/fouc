import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { acceptWorkspaceInvitationInputSchema, createWorkspaceInputSchema, createWorkspaceInvitationInputSchema, changeMemberRoleInputSchema, listOrganizationInputSchema } from './organization';

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
