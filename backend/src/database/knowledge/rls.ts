import { getTableConfig } from 'drizzle-orm/pg-core';
import type { PoolClient } from 'pg';
import { knowledgeBusinessTables } from './schema';

const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

export const knowledgeTenantPredicate = `"workspace_id" = (SELECT NULLIF(current_setting('app.workspace_id', true), '')::uuid)`;

/** DDL identifiers come only from the checked-in Drizzle table definitions. */
export function knowledgeRlsSql(): string {
  const scope = knowledgeTenantPredicate;
  return knowledgeBusinessTables.map((table) => {
    const config = getTableConfig(table);
    const name = `${identifier(config.schema!)}.${identifier(config.name)}`;
    return [
      `ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE ${name} FORCE ROW LEVEL SECURITY;`,
      `CREATE POLICY "tenant_scope" ON ${name} FOR ALL TO PUBLIC USING (${scope}) WITH CHECK (${scope});`,
    ].join('\n');
  }).join('\n');
}

/** Install once inside the same admin transaction that creates current.sql. */
export async function installKnowledgeRls(client: Pick<PoolClient, 'query'>): Promise<void> {
  await client.query(knowledgeRlsSql());
}
