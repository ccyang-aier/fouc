import type { ResourceRlsPolicy } from './rls';

export const taskTableNames = ['task_board', 'task_board_member', 'task_column', 'board_task', 'task_comment'] as const;

/** A read-only definer avoids recursive board/member RLS evaluation. The actor is
 * always derived from the verified transaction session, never a function argument.
 * Qualified names and a fixed search path prevent object substitution.
 */
export const taskBoardPermissionBody = `
  SELECT CASE WHEN b.owner_id = u.id THEN 'owner'
    WHEN b.visibility = 'private' THEN NULL
    WHEN bm.role = 'editor' THEN 'editor'
    WHEN b.visibility = 'project' OR bm.user_id IS NOT NULL THEN 'viewer'
    ELSE NULL END
  FROM resources.task_board b
  JOIN resources.project_member pm ON pm.project_id = b.project_id
  JOIN auth.session s ON s.user_id = pm.user_id
  JOIN auth."user" u ON u.id = s.user_id
  LEFT JOIN resources.task_board_member bm ON bm.project_id = b.project_id AND bm.board_id = b.id AND bm.user_id = u.id
  WHERE b.project_id = target_project AND b.id = target_board
    AND b.project_id = NULLIF(current_setting('app.project_id', true), '')::uuid
    AND s.id = NULLIF(current_setting('app.auth_session_id', true), '')::uuid
    AND s.expires_at > clock_timestamp() AND u.email_verified IS TRUE
`;

export const taskBoardPermissionSql = `CREATE FUNCTION resources.task_board_permission(target_project uuid, target_board uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off AS $permission$${taskBoardPermissionBody}$permission$;`;

// Editors allocate numbers without gaining permission to change board settings.
export const allocateTaskNumberBody = `
  UPDATE resources.task_board AS b SET next_task_number = b.next_task_number + 1
  WHERE b.project_id = target_project AND b.id = target_board
    AND resources.task_board_permission(target_project, target_board) IN ('owner', 'editor')
  RETURNING b.next_task_number - 1
`;
export const allocateTaskNumberSql = `CREATE FUNCTION resources.allocate_task_number(target_project uuid, target_board uuid)
RETURNS integer LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off AS $number$${allocateTaskNumberBody}$number$;`;

// Editors manage shared views without gaining permission to change board settings.
export const updateTaskBoardViewsBody = `
  WITH updated AS (
    UPDATE resources.task_board AS b SET views = next_views, updated_at = clock_timestamp()
    WHERE b.project_id = target_project AND b.id = target_board
      AND resources.task_board_permission(target_project, target_board) IN ('owner', 'editor')
    RETURNING 1
  ) SELECT EXISTS (SELECT 1 FROM updated)
`;
export const updateTaskBoardViewsSql = `CREATE FUNCTION resources.update_task_board_views(target_project uuid, target_board uuid, next_views jsonb)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off AS $views$${updateTaskBoardViewsBody}$views$;`;

export function taskPoliciesForTable(name: string, verifiedIdentityUser: string): ResourceRlsPolicy[] {
  const board = name === 'task_board' ? '"id"' : '"board_id"';
  const permission = `resources.task_board_permission("project_id", ${board})`;
  const editable = `(${permission} = 'owner' OR ${permission} = 'editor')`;
  const owner = `${permission} = 'owner'`;
  const policies: ResourceRlsPolicy[] = [{ name: 'task_board_read', command: 'SELECT', using: `${permission} IS NOT NULL` }];
  if (name === 'task_board') {
    policies.push({ name: 'task_board_create', command: 'INSERT', check: `"project_id" = (SELECT NULLIF(current_setting('app.project_id', true), '')::uuid) AND "owner_id" = ${verifiedIdentityUser} AND EXISTS (SELECT 1 FROM resources.project_member pm WHERE pm.project_id = task_board.project_id AND pm.user_id = ${verifiedIdentityUser})` });
    policies.push({ name: 'task_board_update', command: 'UPDATE', using: owner, check: `"owner_id" = ${verifiedIdentityUser} AND "project_id" = (SELECT NULLIF(current_setting('app.project_id', true), '')::uuid)` });
    policies.push({ name: 'task_board_delete', command: 'DELETE', using: owner });
  } else {
    const writable = name === 'task_board_member' ? owner : editable;
    const insert = name === 'task_comment' ? `${writable} AND "author_id" = ${verifiedIdentityUser}` : writable;
    policies.push({ name: 'task_board_create', command: 'INSERT', check: insert });
    if (name !== 'task_comment') policies.push({ name: 'task_board_update', command: 'UPDATE', using: writable, check: writable });
    policies.push({ name: 'task_board_delete', command: 'DELETE', using: name === 'task_comment' ? `${editable} AND (${owner} OR "author_id" = ${verifiedIdentityUser})` : writable });
  }
  return policies;
}
