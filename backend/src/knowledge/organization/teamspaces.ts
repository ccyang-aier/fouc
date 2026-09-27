import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { createTeamspaceInputSchema, listTeamspacesInputSchema, removeTeamspaceInputSchema, teamspaceScopeSchema, updateTeamspaceInputSchema } from '@fouc/shared/knowledge/contracts';
import type { Teamspace, TeamspaceScope } from '@fouc/shared/knowledge/contracts';
import { page, teamspace } from '../../database/knowledge/schema';
import type { KnowledgeTenantTransaction } from '../../database/knowledge/tenant';
import type { FoucIdentity } from '../../identity/identity';
import { currentIdentity, inWorkspace, pageOf, requireDirectory, requireManager } from './context';
import { OrganizationError, parseInput } from './errors';

const targetTeamspace = (scope: TeamspaceScope) => and(eq(teamspace.workspaceId, scope.workspaceId), eq(teamspace.id, scope.teamspaceId));
const teamspaceView = (row: typeof teamspace.$inferSelect): Teamspace => ({ workspaceId: row.workspaceId, id: row.id, name: row.name, defaultAccess: row.defaultAccess });

async function loadTeamspace(db: KnowledgeTenantTransaction, scope: TeamspaceScope, lock = false) {
  const query = db.select().from(teamspace).where(targetTeamspace(scope));
  const [record] = await (lock ? query.for('update') : query);
  if (!record) throw new OrganizationError('TEAMSPACE_NOT_FOUND', 'Teamspace was not found.', 404);
  return record;
}

async function containsPages(db: KnowledgeTenantTransaction, scope: TeamspaceScope) {
  // Recycled pages count too: deleting the container must not erase recoverable data.
  const [record] = await db.select({ id: page.id }).from(page).where(and(eq(page.workspaceId, scope.workspaceId), eq(page.teamspaceId, scope.teamspaceId))).limit(1);
  return record !== undefined;
}

/**
 * P02 reads the authoritative root through its caller-owned, authorized tenant
 * transaction. This is permission input, not an access grant or an HTTP endpoint.
 */
export async function readTeamspacePermissionRoot(db: KnowledgeTenantTransaction, input: TeamspaceScope) {
  const scope = parseInput(teamspaceScopeSchema, input);
  const record = await loadTeamspace(db, scope);
  return { ...scope, defaultAccess: record.defaultAccess };
}

/** Required server dependency, invoked after a root change in its SAME TX. */
export interface TeamspacePermissionInvalidator {
  invalidate(db: KnowledgeTenantTransaction, scope: TeamspaceScope): Promise<void>;
}

export function teamspaceOperations(pool: Pool, permissions: TeamspacePermissionInvalidator) {
  function mutate<T>(identity: FoucIdentity, scope: TeamspaceScope, operation: (db: KnowledgeTenantTransaction, record: typeof teamspace.$inferSelect) => Promise<T>) {
    return inWorkspace(pool, identity, scope.workspaceId, true, async ({ db, role }) => {
      requireManager(role);
      // FOR UPDATE conflicts with a new page's FK key-share lock. The empty
      // check and a container mutation cannot race a committed child insertion.
      const record = await loadTeamspace(db, scope, true);
      await currentIdentity(db, identity); // Its expiry may pass while waiting here.
      return operation(db, record);
    });
  }

  return {
    async createTeamspace(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(createTeamspaceInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, true, async ({ db, role }) => {
        requireManager(role);
        const [created] = await db.insert(teamspace).values({ ...parsed, id: randomUUID() }).returning();
        return teamspaceView(created!);
      });
    },
    async listTeamspaces(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(listTeamspacesInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, false, async ({ db, role }) => {
        requireDirectory(role);
        const rows = await db.select().from(teamspace).where(and(eq(teamspace.workspaceId, parsed.workspaceId), parsed.cursor ? gt(teamspace.id, parsed.cursor) : undefined))
          .orderBy(asc(teamspace.id)).limit(parsed.limit + 1);
        return pageOf(rows.map(teamspaceView), parsed.limit, (row) => row.id);
      });
    },
    async getTeamspace(identity: FoucIdentity, input: unknown) {
      const scope = parseInput(teamspaceScopeSchema, input);
      return inWorkspace(pool, identity, scope.workspaceId, false, async ({ db, role }) => {
        requireDirectory(role);
        return teamspaceView(await loadTeamspace(db, scope));
      });
    },
    async updateTeamspace(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(updateTeamspaceInputSchema, input);
      return mutate(identity, parsed, async (db, existing) => {
        const [updated] = await db.update(teamspace).set({ name: parsed.name, defaultAccess: parsed.defaultAccess, updatedAt: sql`clock_timestamp()` })
          .where(targetTeamspace(parsed)).returning();
        if (parsed.defaultAccess !== undefined && parsed.defaultAccess !== existing.defaultAccess) {
          await permissions.invalidate(db, { workspaceId: parsed.workspaceId, teamspaceId: parsed.teamspaceId });
        }
        return teamspaceView(updated!);
      });
    },
    async removeTeamspace(identity: FoucIdentity, input: unknown) {
      const scope = parseInput(removeTeamspaceInputSchema, input);
      return mutate(identity, scope, async (db) => {
        if (await containsPages(db, scope)) throw new OrganizationError('TEAMSPACE_NOT_EMPTY', 'Move or permanently remove all pages before deleting this teamspace.', 409);
        await db.delete(teamspace).where(targetTeamspace(scope));
        return { removed: true as const };
      });
    },
  };
}
