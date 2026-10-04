import type { RelationalProvider } from './relational';

export const DATABASE_SECURITY_LIMITS = { principals: 1000, memberships: 5000, privileges: 1000, requestBytes: 4096 } as const;
export type DatabaseSecurityFlag = 'login' | 'superuser' | 'createDatabase' | 'createRole' | 'inherit' | 'replication' | 'bypassRls' | 'locked' | 'passwordExpired';
export interface DatabasePrincipal {
  id: string;
  name: string;
  host: string | null;
  authentication: string | null;
  flags: Partial<Record<DatabaseSecurityFlag, boolean | null>>;
  connectionLimit: string | null;
  validUntil: string | null;
}
export interface DatabaseRoleMembership {
  memberId: string;
  roleId: string;
  admin: boolean | null;
  inherit: boolean | null;
  setRole: boolean | null;
  grantor: string | null;
}
export interface DatabaseSecurityIssue { section: 'identity' | 'principals' | 'memberships' | 'privileges'; message: string; code: string | null }
export interface DatabaseSecurityDirectory {
  provider: Exclude<RelationalProvider, 'sqlite'>;
  scopeKey: string;
  capturedAt: number;
  durationMs: number;
  identity: { authenticated: string | null; session: string | null; current: string | null; activeRoles: string | null };
  principals: DatabasePrincipal[];
  memberships: DatabaseRoleMembership[];
  coverage: 'native-directory' | 'current-account';
  principalsTruncated: boolean;
  membershipsTruncated: boolean;
  issues: DatabaseSecurityIssue[];
  warnings: string[];
}
export interface DatabasePrivilege {
  scope: 'instance' | 'database' | 'schema' | 'table' | 'column' | 'routine';
  schema: string | null;
  object: string | null;
  column: string | null;
  privilege: string;
  grantable: boolean | null;
  basis: 'visible-grant' | 'native-effective-check';
}
export interface DatabaseSecurityDetail {
  principal: DatabasePrincipal;
  capturedAt: number;
  schema: string | null;
  privileges: DatabasePrivilege[];
  privilegesTruncated: boolean;
  issues: DatabaseSecurityIssue[];
  warnings: string[];
}
export const DATABASE_SECURITY_FLAG_LABELS: Record<DatabaseSecurityFlag, string> = {
  login: '允许登录', superuser: '超级用户', createDatabase: '创建数据库', createRole: '管理角色', inherit: '继承角色',
  replication: '复制', bypassRls: '绕过行级安全', locked: '账号锁定', passwordExpired: '口令已过期',
};

/** Reachability describes declared membership only; it is never an effective authorization check. */
export function databaseRolePaths(directory: Pick<DatabaseSecurityDirectory, 'principals' | 'memberships'>, memberId: string) {
  const principals = new Map(directory.principals.map(principal => [principal.id, principal]));
  const edges = new Map<string, DatabaseRoleMembership[]>();
  for (const membership of directory.memberships) {
    if (!principals.has(membership.memberId) || !principals.has(membership.roleId)) continue;
    const outgoing = edges.get(membership.memberId) ?? [];
    outgoing.push(membership); edges.set(membership.memberId, outgoing);
  }
  const paths: { principal: DatabasePrincipal; path: string[]; edges: DatabaseRoleMembership[] }[] = [];
  const visited = new Set([memberId]);
  const queue = [{ id: memberId, path: [memberId], edges: [] as DatabaseRoleMembership[] }];
  for (let offset = 0; offset < queue.length && offset < DATABASE_SECURITY_LIMITS.principals; offset++) {
    const current = queue[offset];
    for (const edge of edges.get(current.id) ?? []) {
      if (visited.has(edge.roleId)) continue;
      visited.add(edge.roleId);
      const next = { id: edge.roleId, path: [...current.path, edge.roleId], edges: [...current.edges, edge] };
      queue.push(next); paths.push({ principal: principals.get(edge.roleId)!, path: next.path, edges: next.edges });
    }
  }
  return paths;
}
