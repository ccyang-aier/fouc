import { describe, expect, test } from 'bun:test';
import { databaseRolePaths, type DatabasePrincipal } from '@fouc/shared/database-security';
import { DatabaseSecurityService } from './service';
import { mysqlPrincipalId, parseSecurityDetailQuery, readSecurityDetail, readSecurityDirectory, type SecurityAdapter } from './read';
import * as sql from './sql';
import type { DriverResult } from '../drivers/relational-driver';

const result = (rows: Record<string, unknown>[], hasMore = false): DriverResult => ({ columns: Object.keys(rows[0] ?? {}), columnTypes: [], rows: rows.map(row => Object.values(row)) as DriverResult['rows'], hasMore });
const principal = (id: string): DatabasePrincipal => ({ id, name: id, host: null, authentication: null, flags: {}, connectionLimit: null, validUntil: null });
describe('native security directory P0', () => {
  test('declared membership closure is bounded, shortest and cycle-safe', () => {
    const edges = [['a','b'],['b','c'],['c','a'],['a','c'],['c','outside']].map(([memberId,roleId]) => ({ memberId, roleId, admin: null, inherit: false, setRole: true, grantor: null }));
    const paths = databaseRolePaths({ principals: ['a','b','c'].map(principal), memberships: edges }, 'a');
    expect(paths.map(path => path.principal.id)).toEqual(['b','c']);
    expect(paths[1].path).toEqual(['a','c']);
    expect(paths[0].edges[0].inherit).toBe(false);
  });
  test('denied MySQL native directory preserves unknown/current account and no sensitive selects', async () => {
    const adapter: SecurityAdapter = { provider: 'mysql', scopeKey: 'w/s', read: async query => {
      if (query === sql.MYSQL_SECURITY_IDENTITY) return result([{ authenticated: 'a@b@localhost', session_user: 'a@b@client', current_user: 'a@b@localhost', active_roles: 'NONE' }]);
      throw Object.assign(new Error('native directory denied'), { code: 'ER_TABLEACCESS_DENIED_ERROR' });
    } };
    const directory = await readSecurityDirectory(adapter);
    expect(directory.coverage).toBe('current-account');
    expect(directory.principals[0].name).toBe('a@b'); expect(directory.principals[0].host).toBe('localhost');
    expect(directory.principals[0].id).toBe(mysqlPrincipalId('a@b','localhost'));
    expect(directory.principals[0].flags).toEqual({});
    expect(directory.issues.map(item => item.section)).toEqual(['principals','memberships']);
    expect(directory.issues[0].code).toBe('ER_TABLEACCESS_DENIED_ERROR');
    expect(Object.values(sql).filter(value => typeof value === 'string').join('\n')).not.toMatch(/rolpassword|authentication_string|SELECT\s+\*/i);
    expect(sql.postgresSecurityMemberships(new Set())).toContain('NULL::boolean AS inherit');
    expect(sql.postgresSecurityMemberships(new Set(['inherit_option','set_option']))).toContain('inherit_option AS inherit');
  });
  test('native privilege lookup binds account values and distinguishes visible grants from effective checks', async () => {
    const calls: { query: string; values: unknown[] }[] = [];
    const account: DatabasePrincipal = { ...principal('account'), name: "quoted'account", host: '%' };
    const detail = await readSecurityDetail({ provider: 'mysql', scopeKey: 'w/s', read: async (query, limit, values) => { calls.push({query,values:values ?? []}); return result([{ scope: 'table', schema_name: 'owned', object_name: 'items', column_name: null, privilege: 'SELECT', grantable: 'YES' }]); } }, account, 'owned');
    expect(calls).toHaveLength(4);
    expect(calls.every(call => !call.query.includes(account.name))).toBe(true);
    expect(calls[0].values).toEqual([account.name,'%']); expect(calls[1].values).toEqual([account.name,'%','owned']);
    expect(detail.privileges[0].basis).toBe('visible-grant'); expect(detail.privileges[0].grantable).toBe(true);
    const postgres = await readSecurityDetail({ provider: 'postgres', scopeKey: 'w/s', read: async () => result([{ scope: 'database', schema_name: null, object_name: 'db', column_name: null, privilege: 'CONNECT', grantable: null }], true) }, principal('pg'), null);
    expect(postgres.privileges[0].basis).toBe('native-effective-check'); expect(postgres.privileges[0].grantable).toBeNull(); expect(postgres.privilegesTruncated).toBe(true);
    expect(() => parseSecurityDetailQuery({ principalId: 'x', sql: 'SELECT 1' })).toThrow();
    expect(() => parseSecurityDetailQuery({ principalId: 'x', schema: '' })).toThrow();
    expect(parseSecurityDetailQuery({ principalId: 'x' })).toEqual({principalId:'x',schema:null});
  });
  test('workspace access is checked before SQL and SQLite has no fabricated users', async () => {
    const service = new DatabaseSecurityService(() => { throw new Error('workspace denied'); });
    await expect(service.directory('wrong','id')).rejects.toThrow('workspace denied');
    const sqlite = new DatabaseSecurityService(() => ({ session: {provider:'sqlite'} } as never));
    await expect(sqlite.directory('w','id')).rejects.toThrow('SQLite');
  });
});
