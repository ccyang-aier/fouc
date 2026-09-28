import type { Pool } from 'pg';
import { groupOperations } from './groups';
import { invitationOperations } from './invitations';
import { memberOperations } from './members';
import { workspaceOperations } from './workspaces';

/** Workspace membership and directory are product-wide resources. */
export function createWorkspaceService(pool: Pool) {
  return { ...workspaceOperations(pool), ...memberOperations(pool), ...groupOperations(pool), ...invitationOperations(pool) };
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
