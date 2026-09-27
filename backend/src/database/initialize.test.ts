import { describe, expect, test } from 'bun:test';
import { FoucDatabaseError, foucDatabaseErrorMessage, readFoucDatabaseConnections } from './initialize-config';
import { isFoucApplicationRoleSafe } from './initialize-role';
import type { FoucApplicationRole } from './initialize-role';

describe('Fouc database deployment configuration', () => {
  test('invalid or mismatched URLs fail without returning credential values', async () => {
    const secret = 'never-echo-this-secret';
    for (const values of [
      { DATABASE_ADMIN_URL: `http://admin:${secret}@localhost/knowledge`, DATABASE_URL: `postgres://app:${secret}@localhost/knowledge` },
      { DATABASE_ADMIN_URL: `postgres://admin:${secret}@localhost/one`, DATABASE_URL: `postgres://app:${secret}@localhost/two` },
      { DATABASE_ADMIN_URL: `postgres://admin:${secret}@host-a/knowledge`, DATABASE_URL: `postgres://app:${secret}@host-b/knowledge` },
    ]) {
      let message = '';
      try { await readFoucDatabaseConnections(values); } catch (error) { message = foucDatabaseErrorMessage(error); }
      expect(message).toContain('same PostgreSQL database');
      expect(message).not.toContain(secret);
    }
    expect(foucDatabaseErrorMessage(Object.assign(new Error(secret), { code: '28P01' }))).toBe('Fouc database command failed (PostgreSQL 28P01).');
    expect(foucDatabaseErrorMessage(new Error(`postgres://${secret}@localhost`))).not.toContain(secret);
    expect(foucDatabaseErrorMessage(new FoucDatabaseError('already_initialized', 'Already initialized.'))).toBe('Already initialized.');
  });

  test('application role validation rejects every route to administrative privileges', () => {
    const safe: FoucApplicationRole = {
      name: 'app', database: 'knowledge', address: '127.0.0.1', port: 5432,
      rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false,
      rolreplication: false, ownsDatabase: false, privilegedMembership: false,
    };
    expect(isFoucApplicationRoleSafe(safe)).toBe(true);
    for (const flag of ['rolsuper', 'rolbypassrls', 'rolcreatedb', 'rolcreaterole', 'rolreplication', 'ownsDatabase', 'privilegedMembership'] as const) {
      expect(isFoucApplicationRoleSafe({ ...safe, [flag]: true }), flag).toBe(false);
    }
  });
});
