import { and, eq, gt, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { entityIdSchema } from '@fouc/shared/knowledge/contracts';
import type { MemberRole } from '@fouc/shared/knowledge/contracts';
import { member, workspace } from '../../../platform/database/knowledge/schema';
import { authSession, authUser } from '../../../platform/database/identity/schema';
import { withKnowledgeTenant } from '../../../platform/database/knowledge/tenant';
import type { FoucIdentityTransaction, KnowledgeTenantTransaction } from '../../../platform/database/knowledge/tenant';
import type { FoucIdentity } from '../../../platform/identity/identity';
import { OrganizationError } from './errors';

export async function currentIdentity(db: FoucIdentityTransaction, identity: FoucIdentity, lock = false) {
  if (!entityIdSchema.safeParse(identity.userId).success || !entityIdSchema.safeParse(identity.sessionId).success) {
    throw new OrganizationError('UNAUTHENTICATED', 'A verified active session is required.', 401);
  }
  const selection = db.select({ userId: authUser.id, email: authUser.email, name: authUser.name }).from(authSession)
    .innerJoin(authUser, eq(authUser.id, authSession.userId))
    .where(and(eq(authSession.id, identity.sessionId), eq(authSession.userId, identity.userId), gt(authSession.expiresAt, sql`clock_timestamp()`), eq(authUser.emailVerified, true)));
  // Mutations hold the verified session/user until commit, so committed session
  // revocation cannot overtake a request waiting for its workspace lock.
  const [user] = await (lock ? selection.for('share') : selection);
  if (!user) throw new OrganizationError('UNAUTHENTICATED', 'A verified active session is required.', 401);
  return user;
}

export function requireManager(role: MemberRole) {
  if (role !== 'owner' && role !== 'admin') throw new OrganizationError('FORBIDDEN', 'Workspace management permission is required.', 403);
}

export function requireDirectory(role: MemberRole) {
  if (role === 'guest') throw new OrganizationError('FORBIDDEN', 'Guests cannot browse the workspace directory.', 403);
}

export function requireRoleAuthority(actor: MemberRole, target: MemberRole) {
  requireManager(actor);
  if (actor !== 'owner' && (target === 'owner' || target === 'admin')) {
    throw new OrganizationError('FORBIDDEN', 'This role exceeds your management authority.', 403);
  }
}

export interface WorkspaceContext {
  db: KnowledgeTenantTransaction;
  actor: Awaited<ReturnType<typeof currentIdentity>>;
  role: MemberRole;
  workspace: typeof workspace.$inferSelect;
}

/** Membership mutations lock the workspace first; every service uses this order. */
export function inWorkspace<T>(pool: Pool, identity: FoucIdentity, workspaceId: string, write: boolean, operation: (context: WorkspaceContext) => Promise<T>) {
  return withKnowledgeTenant(pool, workspaceId, async (db) => {
    const actor = await currentIdentity(db, identity, write);
    const ownMembership = db.select({ userId: member.userId }).from(member).where(and(eq(member.workspaceId, workspaceId), eq(member.userId, actor.userId)));
    const selection = db.select().from(workspace).where(and(eq(workspace.id, workspaceId), sql`exists (${ownMembership})`));
    const [record] = await (write ? selection.for('update') : selection);
    if (!record) throw new OrganizationError('WORKSPACE_NOT_FOUND', 'Workspace is not available.', 404);
    // A share lock prevents revocation, but time still passes while waiting.
    if (write) await currentIdentity(db, identity);
    // Re-read after obtaining the lock: a waiting writer cannot use a stale role.
    const [membership] = await db.select().from(member).where(and(eq(member.workspaceId, workspaceId), eq(member.userId, actor.userId)));
    if (!membership) throw new OrganizationError('WORKSPACE_NOT_FOUND', 'Workspace is not available.', 404);
    return operation({ db, actor, role: membership.role, workspace: record });
  });
}

export function pageOf<T>(items: T[], limit: number, cursor: (item: T) => string) {
  const more = items.length > limit;
  const visible = more ? items.slice(0, limit) : items;
  return { items: visible, nextCursor: more ? cursor(visible[visible.length - 1]!) : null };
}

export const workspaceView = (row: typeof workspace.$inferSelect) => ({ id: row.id, name: row.name, kind: row.kind, settings: row.settings });
