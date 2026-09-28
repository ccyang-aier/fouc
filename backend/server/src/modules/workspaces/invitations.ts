import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { acceptWorkspaceInvitationInputSchema, createWorkspaceInvitationInputSchema, listOrganizationInputSchema, revokeWorkspaceInvitationInputSchema } from '@fouc/shared/workspaces';
import type { WorkspaceInvitation } from '@fouc/shared/workspaces';
import { member, workspace, workspaceInvitation } from '../../platform/database/workspace/schema';
import { authUser } from '../../platform/database/identity/schema';
import { withWorkspaceTenant } from '../../platform/database/workspace/tenant';
import type { FoucIdentity } from '../../platform/identity/identity';
import { currentIdentity, inWorkspace, pageOf, requireManager, requireRoleAuthority, workspaceView } from './context';
import { OrganizationError, parseInput } from './errors';

const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1_000;
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const invalidInvitation = () => new OrganizationError('INVITATION_INVALID', 'This invitation is unavailable or does not match your verified email.', 404);
const invitationView = (row: typeof workspaceInvitation.$inferSelect): WorkspaceInvitation => ({
  workspaceId: row.workspaceId, id: row.id, email: row.email, role: row.role as WorkspaceInvitation['role'], invitedBy: row.invitedBy,
  expiresAt: row.expiresAt.toISOString(), createdAt: row.createdAt.toISOString(),
  acceptedAt: row.acceptedAt?.toISOString() ?? null, acceptedBy: row.acceptedBy, revokedAt: row.revokedAt?.toISOString() ?? null,
});

export function invitationOperations(pool: Pool) {
  return {
    async listInvitations(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(listOrganizationInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, false, async ({ db, role }) => {
        requireManager(role);
        const rows = await db.select().from(workspaceInvitation)
          .where(and(eq(workspaceInvitation.workspaceId, parsed.workspaceId), parsed.cursor ? gt(workspaceInvitation.id, parsed.cursor) : undefined))
          .orderBy(asc(workspaceInvitation.id)).limit(parsed.limit + 1);
        return pageOf(rows.map(invitationView), parsed.limit, (row) => row.id);
      });
    },
    async createInvitation(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(createWorkspaceInvitationInputSchema, input);
      const token = randomBytes(32).toString('base64url');
      return inWorkspace(pool, identity, parsed.workspaceId, true, async ({ db, actor, role }) => {
        requireRoleAuthority(role, parsed.role);
        const [existingMember] = await db.select({ userId: member.userId }).from(member).innerJoin(authUser, eq(authUser.id, member.userId))
          .where(and(eq(member.workspaceId, parsed.workspaceId), sql`lower(${authUser.email}) = ${parsed.email}`));
        if (existingMember) throw new OrganizationError('CONFLICT', 'This email already belongs to a workspace member.', 409);
        const pending = and(eq(workspaceInvitation.workspaceId, parsed.workspaceId), eq(workspaceInvitation.email, parsed.email), isNull(workspaceInvitation.acceptedAt), isNull(workspaceInvitation.revokedAt));
        const [existingInvitation] = await db.select().from(workspaceInvitation).where(pending);
        if (existingInvitation) requireRoleAuthority(role, existingInvitation.role);
        // Reissuing rotates the one-time token; old URLs immediately stop working.
        await db.update(workspaceInvitation).set({ revokedAt: new Date() }).where(pending);
        const [created] = await db.insert(workspaceInvitation).values({
          ...parsed, id: randomUUID(), tokenHash: tokenHash(token), invitedBy: actor.userId,
          expiresAt: new Date(Date.now() + invitationLifetimeMs),
        }).returning();
        return { invitation: invitationView(created!), token };
      });
    },
    async revokeInvitation(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(revokeWorkspaceInvitationInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, true, async ({ db, role }) => {
        requireManager(role);
        const target = and(eq(workspaceInvitation.workspaceId, parsed.workspaceId), eq(workspaceInvitation.id, parsed.invitationId));
        const [existing] = await db.select().from(workspaceInvitation).where(target);
        if (!existing) throw invalidInvitation();
        requireRoleAuthority(role, existing.role);
        if (existing.acceptedAt) throw new OrganizationError('CONFLICT', 'This invitation was already accepted.', 409);
        if (!existing.revokedAt) await db.update(workspaceInvitation).set({ revokedAt: new Date() }).where(target);
        return { revoked: true as const };
      });
    },
    async acceptInvitation(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(acceptWorkspaceInvitationInputSchema, input);
      return withWorkspaceTenant(pool, parsed.workspaceId, async (db) => {
        await currentIdentity(db, identity, true);
        const [space] = await db.select().from(workspace).where(eq(workspace.id, parsed.workspaceId)).for('update');
        if (!space) throw invalidInvitation();
        const actor = await currentIdentity(db, identity);
        const target = and(eq(workspaceInvitation.workspaceId, parsed.workspaceId), eq(workspaceInvitation.id, parsed.invitationId));
        const [invitation] = await db.select().from(workspaceInvitation).where(and(target,
          isNull(workspaceInvitation.acceptedAt), isNull(workspaceInvitation.revokedAt), gt(workspaceInvitation.expiresAt, sql`clock_timestamp()`),
        )).for('update');
        if (!invitation || invitation.email !== actor.email.toLowerCase()
          || !timingSafeEqual(Buffer.from(invitation.tokenHash, 'hex'), Buffer.from(tokenHash(parsed.token), 'hex'))) throw invalidInvitation();
        // Authority may have changed since issue. Revoked membership cannot leave
        // behind a usable invitation that silently grants its previous power.
        const [inviter] = await db.select().from(member).where(and(eq(member.workspaceId, parsed.workspaceId), eq(member.userId, invitation.invitedBy)));
        if (!inviter || (inviter.role !== 'owner' && (inviter.role !== 'admin' || invitation.role === 'admin' || invitation.role === 'owner'))) throw invalidInvitation();
        const [existing] = await db.select().from(member).where(and(eq(member.workspaceId, parsed.workspaceId), eq(member.userId, actor.userId)));
        if (existing) throw new OrganizationError('CONFLICT', 'You are already a member of this workspace.', 409);
        await db.insert(member).values({ workspaceId: parsed.workspaceId, userId: actor.userId, role: invitation.role });
        await db.update(workspaceInvitation).set({ acceptedAt: new Date(), acceptedBy: actor.userId }).where(target);
        const [updated] = await db.update(workspace).set({ kind: 'team', updatedAt: new Date() }).where(eq(workspace.id, parsed.workspaceId)).returning();
        return { ...workspaceView(updated!), role: invitation.role };
      });
    },
  };
}
