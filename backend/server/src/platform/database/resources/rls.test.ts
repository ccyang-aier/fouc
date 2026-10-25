import { describe, expect, test } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { resourceTables, project, projectMember } from './schema';
import { resourceRlsSql, resourcePoliciesForTable } from './rls';

describe('resource RLS installation definition', () => {
  test('enables and forces domain-specific policies on every business table', () => {
    const ddl = resourceRlsSql();
    for (const table of resourceTables) {
      const { schema, name } = getTableConfig(table);
      const target = `"${schema}"."${name}"`;
      expect(ddl).toContain(`ALTER TABLE ${target} ENABLE ROW LEVEL SECURITY;`);
      expect(ddl).toContain(`ALTER TABLE ${target} FORCE ROW LEVEL SECURITY;`);
      for (const policy of resourcePoliciesForTable(table)) expect(ddl).toContain(`CREATE POLICY "${policy.name}" ON ${target} FOR ${policy.command} TO PUBLIC`);
    }
    expect(ddl).toContain("NULLIF(current_setting('app.project_id', true), '')::uuid");
    expect(ddl).toContain("current_setting('app.auth_session_id', true)");
    expect(ddl).not.toContain('ALTER TABLE "auth"');
  });

  test('projects use identity membership and their resource scope', () => {
    for (const table of [project, projectMember]) {
      const policies = resourcePoliciesForTable(table);
      expect(policies.some((policy) => policy.name === 'project_scope')).toBe(true);
    }
  });

});
