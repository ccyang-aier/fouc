import { getTableConfig } from 'drizzle-orm/pg-core';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { PoolClient } from 'pg';
import { resourceTables } from './schema';
import { allocateTaskNumberSql, taskBoardPermissionSql, taskPoliciesForTable, taskTableNames, updateTaskBoardViewsSql } from './task-rls';
import { chatChannelPermissionSql, chatPoliciesForTable, chatTableNames } from './chat-rls';

const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const verifiedIdentityUser = `(SELECT s.user_id FROM auth.session s
  JOIN auth."user" u ON u.id = s.user_id
  WHERE s.id = NULLIF(current_setting('app.auth_session_id', true), '')::uuid
    AND s.expires_at > clock_timestamp() AND u.email_verified IS TRUE)`;

export interface ResourceRlsPolicy {
  name: 'project_scope' | 'own_identity' | 'task_board_read' | 'task_board_create' | 'task_board_update' | 'task_board_delete' | 'chat_read' | 'chat_create' | 'chat_update' | 'chat_delete';
  command: 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  using?: string;
  check?: string;
}

/** Projects, task boards and chat channels use their own resource scope and membership. */
export function resourcePoliciesForTable(table: PgTable): ResourceRlsPolicy[] {
  const config = getTableConfig(table);
  if ((chatTableNames as readonly string[]).includes(config.name)) return chatPoliciesForTable(config.name, verifiedIdentityUser);
  if ((taskTableNames as readonly string[]).includes(config.name)) return taskPoliciesForTable(config.name, verifiedIdentityUser);
  if (config.name === 'project' || config.name === 'project_member') {
    const projectId = `(SELECT NULLIF(current_setting('app.project_id', true), '')::uuid)`;
    const predicate = `${config.name === 'project' ? '"id"' : '"project_id"'} = ${projectId}`;
    const visible = config.name === 'project'
      ? `EXISTS (SELECT 1 FROM resources.project_member m WHERE m.project_id = project.id AND m.user_id = ${verifiedIdentityUser})`
      : `"user_id" = ${verifiedIdentityUser}`;
    return [
      { name: 'project_scope', command: 'ALL', using: predicate, check: predicate },
      { name: 'own_identity', command: 'SELECT', using: visible },
    ];
  }
  throw new Error(`Missing resource policy for ${config.name}`);
}

/** DDL identifiers come only from the checked-in Drizzle table definitions. */
export function resourceRlsSql(tables: readonly PgTable[] = resourceTables): string {
  return tables.map((table) => {
    const config = getTableConfig(table);
    const name = `${identifier(config.schema!)}.${identifier(config.name)}`;
    return [
      `ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE ${name} FORCE ROW LEVEL SECURITY;`,
      ...resourcePoliciesForTable(table).map((policy) => `CREATE POLICY ${identifier(policy.name)} ON ${name} FOR ${policy.command} TO PUBLIC${policy.using ? ` USING (${policy.using})` : ''}${policy.check ? ` WITH CHECK (${policy.check})` : ''};`),
    ].join('\n');
  }).join('\n');
}

/** Install once inside the same admin transaction that creates current.sql. */
export async function installResourceRls(client: Pick<PoolClient, 'query'>): Promise<void> {
  await client.query(taskBoardPermissionSql);
  await client.query(allocateTaskNumberSql);
  await client.query(updateTaskBoardViewsSql);
  await client.query(chatChannelPermissionSql);
  await client.query(resourceRlsSql());
}
