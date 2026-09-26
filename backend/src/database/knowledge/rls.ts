import { getTableConfig } from 'drizzle-orm/pg-core';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { PoolClient } from 'pg';
import { knowledgeBusinessTables } from './schema';

const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

export const knowledgeTenantPredicate = `"workspace_id" = (SELECT NULLIF(current_setting('app.workspace_id', true), '')::uuid)`;

const verifiedIdentityUser = `(SELECT s.user_id FROM knowledge_auth.session s
  JOIN knowledge_auth."user" u ON u.id = s.user_id
  WHERE s.id = NULLIF(current_setting('app.auth_session_id', true), '')::uuid
    AND s.expires_at > clock_timestamp() AND u.email_verified IS TRUE)`;

export interface KnowledgeRlsPolicy {
  name: 'tenant_scope' | 'own_identity';
  command: 'ALL' | 'SELECT';
  using: string;
  check?: string;
}

/** Identity discovery grants SELECT only; mutations always need tenant_scope. */
export function knowledgePoliciesForTable(table: PgTable): KnowledgeRlsPolicy[] {
  const config = getTableConfig(table);
  const policies: KnowledgeRlsPolicy[] = [{ name: 'tenant_scope', command: 'ALL', using: knowledgeTenantPredicate, check: knowledgeTenantPredicate }];
  if (config.name === 'member') policies.push({ name: 'own_identity', command: 'SELECT', using: `"user_id" = ${verifiedIdentityUser}` });
  if (config.name === 'workspace') policies.push({
    name: 'own_identity', command: 'SELECT',
    using: `EXISTS (SELECT 1 FROM knowledge.member m WHERE m.workspace_id = workspace.workspace_id AND m.user_id = ${verifiedIdentityUser})`,
  });
  return policies;
}

/** DDL identifiers come only from the checked-in Drizzle table definitions. */
export function knowledgeRlsSql(): string {
  return knowledgeBusinessTables.map((table) => {
    const config = getTableConfig(table);
    const name = `${identifier(config.schema!)}.${identifier(config.name)}`;
    return [
      `ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE ${name} FORCE ROW LEVEL SECURITY;`,
      ...knowledgePoliciesForTable(table).map((policy) => `CREATE POLICY ${identifier(policy.name)} ON ${name} FOR ${policy.command} TO PUBLIC USING (${policy.using})${policy.check ? ` WITH CHECK (${policy.check})` : ''};`),
    ].join('\n');
  }).join('\n');
}

/** Install once inside the same admin transaction that creates current.sql. */
export async function installKnowledgeRls(client: Pick<PoolClient, 'query'>): Promise<void> {
  await client.query(knowledgeRlsSql());
}
