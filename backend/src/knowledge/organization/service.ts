import type { Pool } from 'pg';
import { groupOperations } from './groups';
import { invitationOperations } from './invitations';
import { memberOperations } from './members';
import { workspaceOperations } from './workspaces';

/** All entry points receive server-authenticated identity, never an actor in input. */
export function createOrganizationService(pool: Pool) {
  return { ...workspaceOperations(pool), ...memberOperations(pool), ...groupOperations(pool), ...invitationOperations(pool) };
}

export type OrganizationService = ReturnType<typeof createOrganizationService>;
