import { DATABASE_SECURITY_LIMITS, type DatabasePrincipal, type DatabasePrivilege, type DatabaseSecurityDetail, type DatabaseSecurityDirectory, type DatabaseSecurityIssue } from '@fouc/shared/database-security';
import type { RelationalProvider } from '@fouc/shared';
import type { DriverResult, SqlParameter } from '../drivers/relational-driver';
import { DatabaseInputError } from '../input-error';
import * as sql from './sql';

export interface SecurityAdapter {
  provider: Exclude<RelationalProvider, 'sqlite'>;
  scopeKey: string;
  read(sql: string, maxRows: number, values?: SqlParameter[]): Promise<DriverResult>;
}
export const securityText = (value: unknown): string | null => value == null ? null : ['string', 'number', 'bigint', 'boolean'].includes(typeof value) ? String(value) : null;
const flag = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  const text = securityText(value)?.toLowerCase();
  return ['t', 'true', 'y', 'yes', '1'].includes(text ?? '') ? true : ['f', 'false', 'n', 'no', '0'].includes(text ?? '') ? false : null;
};
export const securityRows = (result: DriverResult) => result.rows.map(row => Object.fromEntries(result.columns.map((name, index) => [name.toLowerCase(), row[index]])));
export const mysqlPrincipalId = (name: string, host: string) => JSON.stringify([name, host]);
function issue(section: DatabaseSecurityIssue['section'], error: unknown): DatabaseSecurityIssue {
  return { section, message: error instanceof Error ? error.message : String(error), code: typeof error === 'object' && error && 'code' in error ? securityText(error.code) : null };
}

export async function readSecurityDirectory(adapter: SecurityAdapter): Promise<DatabaseSecurityDirectory> {
  const started = Date.now();
  const snapshot: DatabaseSecurityDirectory = {
    provider: adapter.provider, scopeKey: adapter.scopeKey, capturedAt: started, durationMs: 0,
    identity: { authenticated: null, session: null, current: null, activeRoles: null },
    principals: [], memberships: [], coverage: 'native-directory', principalsTruncated: false,
    membershipsTruncated: false, issues: [], warnings: [],
  };
  try {
    const row = securityRows(await adapter.read(adapter.provider === 'mysql' ? sql.MYSQL_SECURITY_IDENTITY : sql.POSTGRES_SECURITY_IDENTITY, 1))[0];
    snapshot.identity = { authenticated: securityText(row?.authenticated), session: securityText(row?.session_user), current: securityText(row?.current_user), activeRoles: securityText(row?.active_roles) };
  } catch (error) { snapshot.issues.push(issue('identity', error)); }
  try {
    const result = await adapter.read(adapter.provider === 'mysql' ? sql.MYSQL_SECURITY_PRINCIPALS : sql.POSTGRES_SECURITY_PRINCIPALS, DATABASE_SECURITY_LIMITS.principals);
    snapshot.principalsTruncated = result.hasMore;
    snapshot.principals = securityRows(result).flatMap((row): DatabasePrincipal[] => {
      const name = securityText(row.name); if (name === null) return [];
      if (adapter.provider === 'mysql') {
        const host = securityText(row.host); if (host === null) return [];
        return [{ id: mysqlPrincipalId(name, host), name, host, authentication: securityText(row.authentication), flags: { locked: flag(row.locked), passwordExpired: flag(row.password_expired) }, connectionLimit: null, validUntil: null } satisfies DatabasePrincipal];
      }
      const id = securityText(row.id); if (!id) return [];
      return [{ id, name, host: null, authentication: null, flags: { login: flag(row.login), superuser: flag(row.superuser), createDatabase: flag(row.create_database), createRole: flag(row.create_role), inherit: flag(row.inherit), replication: flag(row.replication), bypassRls: flag(row.bypass_rls) }, connectionLimit: securityText(row.connection_limit), validUntil: securityText(row.valid_until) } satisfies DatabasePrincipal];
    });
  } catch (error) {
    snapshot.issues.push(issue('principals', error));
    const account = snapshot.identity.authenticated, at = account?.lastIndexOf('@') ?? -1;
    if (adapter.provider === 'mysql' && account && at >= 0) {
      const name = account.slice(0, at), host = account.slice(at + 1);
      snapshot.principals = [{ id: mysqlPrincipalId(name, host), name, host, authentication: null, flags: {}, connectionLimit: null, validUntil: null }];
      snapshot.coverage = 'current-account';
    }
  }
  try {
    const fields = adapter.provider === 'postgres' ? new Set(securityRows(await adapter.read(sql.POSTGRES_MEMBERSHIP_FIELDS, 64)).map(row => String(row.attname))) : new Set<string>();
    const result = await adapter.read(adapter.provider === 'mysql' ? sql.MYSQL_SECURITY_MEMBERSHIPS : sql.postgresSecurityMemberships(fields), DATABASE_SECURITY_LIMITS.memberships);
    snapshot.membershipsTruncated = result.hasMore;
    snapshot.memberships = securityRows(result).flatMap(row => {
      const memberId = adapter.provider === 'mysql' ? mysqlPrincipalId(String(row.member_name), String(row.member_host)) : securityText(row.member_id);
      const roleId = adapter.provider === 'mysql' ? mysqlPrincipalId(String(row.role_name), String(row.role_host)) : securityText(row.role_id);
      return memberId && roleId ? [{ memberId, roleId, admin: flag(row.admin), inherit: flag(row.inherit), setRole: flag(row.set_role), grantor: securityText(row.grantor) }] : [];
    });
  } catch (error) { snapshot.issues.push(issue('memberships', error)); }
  snapshot.warnings = [
    '各目录依次读取，角色或授权可在读取期间变化；刷新可取得新的原生目录。角色路径表示声明关系，不等同于当前会话的有效权限。',
    adapter.provider === 'mysql' ? 'mysql.user / role_edges 需要原生目录读取权限。无法读取时只保留当前账户；information_schema 权限仅包含当前连接可见的显式授权，不包含完整角色继承、动态权限或行级规则。' : 'pg_roles 只读取明确列出的公开属性。成员关系的 INHERIT / SET 选项根据原生目录列识别；旧版本未知。有效对象权限由原生 has_*_privilege 函数判定，仍受会话角色、RLS 和对象可见性约束。',
  ];
  if (snapshot.principalsTruncated || snapshot.membershipsTruncated) snapshot.warnings.push('目录达到有界读取上限；缺失的账户或关系保持未知，角色路径可能不完整。');
  snapshot.durationMs = Date.now() - started;
  return snapshot;
}

export async function readSecurityDetail(adapter: SecurityAdapter, principal: DatabasePrincipal, schema: string | null): Promise<DatabaseSecurityDetail> {
  const detail: DatabaseSecurityDetail = { principal, capturedAt: Date.now(), schema, privileges: [], privilegesTruncated: false, issues: [], warnings: [] };
  const read = async (query: string, values: SqlParameter[], basis: DatabasePrivilege['basis']) => {
    const remaining = DATABASE_SECURITY_LIMITS.privileges - detail.privileges.length;
    if (remaining <= 0) { detail.privilegesTruncated = true; return; }
    try {
      const result = await adapter.read(query, remaining, values);
      detail.privilegesTruncated ||= result.hasMore;
      for (const row of securityRows(result)) {
        const privilege = securityText(row.privilege), scope = securityText(row.scope);
        if (!privilege || !['instance', 'database', 'schema', 'table', 'column', 'routine'].includes(scope ?? '')) continue;
        detail.privileges.push({ scope: scope as DatabasePrivilege['scope'], schema: securityText(row.schema_name), object: securityText(row.object_name), column: securityText(row.column_name), privilege, grantable: flag(row.grantable), basis });
      }
    } catch (error) { detail.issues.push(issue('privileges', error)); }
  };
  if (adapter.provider === 'mysql') {
    const values = [principal.name, principal.host!];
    await read(sql.MYSQL_SECURITY_PRIVILEGES[0], values, 'visible-grant');
    if (schema) for (const query of sql.MYSQL_SECURITY_PRIVILEGES.slice(1)) await read(query, [...values, schema], 'visible-grant');
    detail.warnings.push('当前连接可见的显式授权；空结果不代表无权限。未合并角色继承、动态权限、代理权限或例程授权。');
  } else {
    await read(sql.POSTGRES_SECURITY_DATABASE_PRIVILEGES, [principal.name], 'native-effective-check');
    if (schema) {
      await read(sql.POSTGRES_SECURITY_SCHEMA_PRIVILEGES, [principal.name, schema], 'native-effective-check');
      await read(sql.POSTGRES_SECURITY_TABLE_PRIVILEGES, [principal.name, schema], 'native-effective-check');
      detail.warnings.push('表权限只检查所选 Schema 按名称排列的前 334 张关系，且总返回最多 1000 项；未显示的对象保持未知。');
    }
    detail.warnings.push('原生 has_*_privilege 检查包含角色继承和 PUBLIC 权限；未展开 GRANT OPTION、列级授权、函数/序列权限，也不判断 RLS 策略或 SQL 执行结果。');
  }
  if (!schema) detail.warnings.push('未选择 Schema：仅读取实例或数据库级权限。');
  if (detail.privilegesTruncated) detail.warnings.push('权限明细已达到 1000 项上限；未返回的数据保持未知。');
  return detail;
}

export function parseSecurityDetailQuery(value: unknown): { principalId: string; schema: string | null } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseInputError('权限目录参数无效。');
  const query = value as Record<string, unknown>;
  if (Object.keys(query).some(key => !['principalId', 'schema'].includes(key)) || typeof query.principalId !== 'string' || !query.principalId || query.principalId.length > 1024 || (query.schema !== undefined && (typeof query.schema !== 'string' || !query.schema || query.schema.length > 128))) throw new DatabaseInputError('请选择当前目录中的账户和 Schema。');
  return { principalId: query.principalId, schema: typeof query.schema === 'string' ? query.schema : null };
}
