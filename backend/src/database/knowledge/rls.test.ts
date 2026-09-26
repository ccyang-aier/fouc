import { describe, expect, test } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { knowledgeBusinessTables } from './schema';
import { knowledgeRlsSql } from './rls';

describe('tenant RLS installation definition', () => {
  test('enables and forces a USING/WITH CHECK scope policy on every business table', () => {
    const ddl = knowledgeRlsSql();
    for (const table of knowledgeBusinessTables) {
      const { schema, name } = getTableConfig(table);
      const target = `"${schema}"."${name}"`;
      expect(ddl).toContain(`ALTER TABLE ${target} ENABLE ROW LEVEL SECURITY;`);
      expect(ddl).toContain(`ALTER TABLE ${target} FORCE ROW LEVEL SECURITY;`);
      expect(ddl).toContain(`CREATE POLICY "tenant_scope" ON ${target} FOR ALL TO PUBLIC USING (`);
    }
    expect(ddl.match(/WITH CHECK/g)).toHaveLength(knowledgeBusinessTables.length);
    expect(ddl).toContain("NULLIF(current_setting('app.workspace_id', true), '')::uuid");
    expect(ddl).not.toContain('ALTER TABLE "knowledge_auth"');
    expect(ddl.match(/"own_identity"[^\n]+FOR SELECT/g)).toHaveLength(2);
    expect(ddl).toContain("current_setting('app.auth_session_id', true)");
  });
});
