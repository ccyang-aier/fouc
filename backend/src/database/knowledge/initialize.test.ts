import { describe, expect, test } from 'bun:test';
import { KnowledgeDatabaseError, knowledgeDatabaseErrorMessage, readKnowledgeDatabaseConnections } from './initialize-config';
import { isKnowledgeApplicationRoleSafe } from './initialize-role';
import type { KnowledgeApplicationRole } from './initialize-role';

describe('knowledge database deployment configuration', () => {
  test('invalid or mismatched URLs fail without returning credential values', async () => {
    const secret = 'never-echo-this-secret';
    for (const values of [
      { DATABASE_ADMIN_URL: `http://admin:${secret}@localhost/knowledge`, DATABASE_URL: `postgres://app:${secret}@localhost/knowledge` },
      { DATABASE_ADMIN_URL: `postgres://admin:${secret}@localhost/one`, DATABASE_URL: `postgres://app:${secret}@localhost/two` },
      { DATABASE_ADMIN_URL: `postgres://admin:${secret}@host-a/knowledge`, DATABASE_URL: `postgres://app:${secret}@host-b/knowledge` },
    ]) {
      let message = '';
      try { await readKnowledgeDatabaseConnections(values); } catch (error) { message = knowledgeDatabaseErrorMessage(error); }
      expect(message).toContain('same PostgreSQL database');
      expect(message).not.toContain(secret);
    }
    expect(knowledgeDatabaseErrorMessage(Object.assign(new Error(secret), { code: '28P01' }))).toBe('Knowledge database command failed (PostgreSQL 28P01).');
    expect(knowledgeDatabaseErrorMessage(new Error(`postgres://${secret}@localhost`))).not.toContain(secret);
    expect(knowledgeDatabaseErrorMessage(new KnowledgeDatabaseError('already_initialized', 'Already initialized.'))).toBe('Already initialized.');
  });

  test('application role validation rejects every route to administrative privileges', () => {
    const safe: KnowledgeApplicationRole = {
      name: 'app', database: 'knowledge', address: '127.0.0.1', port: 5432,
      rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false,
      rolreplication: false, ownsDatabase: false, privilegedMembership: false,
    };
    expect(isKnowledgeApplicationRoleSafe(safe)).toBe(true);
    for (const flag of ['rolsuper', 'rolbypassrls', 'rolcreatedb', 'rolcreaterole', 'rolreplication', 'ownsDatabase', 'privilegedMembership'] as const) {
      expect(isKnowledgeApplicationRoleSafe({ ...safe, [flag]: true }), flag).toBe(false);
    }
  });
});
