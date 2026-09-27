import type { Pool } from 'pg';
import { groupOperations } from './groups';
import { invitationOperations } from './invitations';
import { memberOperations } from './members';
import { workspaceOperations } from './workspaces';
import { teamspaceOperations } from './teamspaces';
import type { TeamspacePermissionInvalidator } from './teamspaces';

/** All entry points receive server-authenticated identity, never an actor in input. */
export function createOrganizationService(pool: Pool, dependencies: { permissions: TeamspacePermissionInvalidator }) {
  return { ...workspaceOperations(pool), ...memberOperations(pool), ...groupOperations(pool), ...invitationOperations(pool), ...teamspaceOperations(pool, dependencies.permissions) };
}

export type OrganizationService = ReturnType<typeof createOrganizationService>;
