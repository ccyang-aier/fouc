import type { ResourceRlsPolicy } from './rls';

export const chatTableNames = ['chat_channel', 'chat_channel_member', 'chat_message'] as const;
export const chatChannelPermissionBody = `
  SELECT CASE WHEN c.owner_id = u.id THEN 'owner'
    WHEN cm.role = 'admin' THEN 'admin'
    WHEN cm.id IS NOT NULL OR c.visibility = 'project' THEN 'member'
    ELSE NULL END
  FROM resources.chat_channel c
  JOIN resources.project_member pm ON pm.project_id = c.project_id
  JOIN auth.session s ON s.user_id = pm.user_id
  JOIN auth."user" u ON u.id = s.user_id
  LEFT JOIN resources.chat_channel_member cm ON cm.project_id = c.project_id
    AND cm.channel_id = c.id AND cm.user_id = u.id AND cm.kind = 'user' AND cm.active IS TRUE
  WHERE c.project_id = target_project AND c.id = target_channel
    AND c.project_id = NULLIF(current_setting('app.project_id', true), '')::uuid
    AND s.id = NULLIF(current_setting('app.auth_session_id', true), '')::uuid
    AND s.expires_at > clock_timestamp() AND u.email_verified IS TRUE
`;
export const chatChannelPermissionSql = `CREATE FUNCTION resources.chat_channel_permission(target_project uuid, target_channel uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off AS $permission$${chatChannelPermissionBody}$permission$;`;
export function chatPoliciesForTable(name: string, verifiedUser: string): ResourceRlsPolicy[] {
  const channel = name === 'chat_channel' ? '"id"' : '"channel_id"';
  const role = `resources.chat_channel_permission("project_id", ${channel})`;
  const manager = `(${role} = 'owner' OR ${role} = 'admin')`;
  const member = `${role} IS NOT NULL`;
  const scope = `"project_id" = NULLIF(current_setting('app.project_id', true), '')::uuid`;
  const policies: ResourceRlsPolicy[] = [{ name: 'chat_read', command: 'SELECT', using: member }];
  if (name === 'chat_channel') return [...policies,
    { name: 'chat_create', command: 'INSERT', check: `${scope} AND "owner_id" = ${verifiedUser} AND EXISTS (SELECT 1 FROM resources.project_member pm WHERE pm.project_id = chat_channel.project_id AND pm.user_id = ${verifiedUser})` },
    { name: 'chat_update', command: 'UPDATE', using: manager, check: `${scope} AND ${manager}` },
    { name: 'chat_delete', command: 'DELETE', using: `${role} = 'owner'` },
  ];
  if (name === 'chat_channel_member') return [...policies,
    { name: 'chat_create', command: 'INSERT', check: `${scope} AND ${member} AND ("role" = 'member' OR (${manager} AND "kind" = 'user')) AND ("kind" = 'user' OR "user_id" = ${verifiedUser})` },
    { name: 'chat_update', command: 'UPDATE', using: member, check: `${scope} AND ${member}` },
    { name: 'chat_delete', command: 'DELETE', using: manager },
  ];
  return [...policies,
    { name: 'chat_create', command: 'INSERT', check: `${scope} AND ${member} AND "author_user_id" = ${verifiedUser} AND EXISTS (SELECT 1 FROM resources.chat_channel_member cm WHERE cm.project_id = chat_message.project_id AND cm.channel_id = chat_message.channel_id AND cm.id = chat_message.author_id AND cm.user_id = ${verifiedUser} AND cm.kind = chat_message.author_kind AND cm.active IS TRUE)` },
    { name: 'chat_update', command: 'UPDATE', using: member, check: `${scope} AND ${member}` },
    { name: 'chat_delete', command: 'DELETE', using: `${member} AND (${manager} OR "author_user_id" = ${verifiedUser})` },
  ];
}
