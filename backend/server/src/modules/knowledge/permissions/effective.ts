import { permissionLevels, principal } from '@fouc/shared/knowledge/contracts';
import type { EffectivePermissions, Member, PageAcl, PermissionLevel, Principal } from '@fouc/shared/knowledge/contracts';

export interface PermissionNode {
  id: string;
  parentId: string | null;
  workspaceId: string;
  teamspaceId: string;
  inheritsPermissions: boolean;
  grants: readonly PageAcl[];
}

/** Input comes from authenticated membership queries, never from a client body. */
export function expandPrincipals(input: {
  workspaceId: string;
  userId: string | null;
  member: Member | null;
  groups: readonly { workspaceId: string; userId: string; groupId: string }[];
  links?: readonly { workspaceId: string; id: string }[];
}): Principal[] {
  const result = new Set<Principal>();
  if (input.userId) result.add(principal('user', input.userId));
  if (input.member) {
    if (input.member.workspaceId !== input.workspaceId || input.member.userId !== input.userId) throw new Error('Membership does not belong to this request');
    result.add(principal('workspace', input.workspaceId));
  }
  for (const group of input.groups) {
    if (!input.member || group.workspaceId !== input.workspaceId || group.userId !== input.userId) throw new Error('Group membership does not belong to this request');
    result.add(principal('group', group.groupId));
  }
  for (const link of input.links ?? []) {
    if (link.workspaceId !== input.workspaceId) throw new Error('Share link does not belong to this workspace');
    result.add(principal('link', link.id));
  }
  return [...result].sort();
}

const rank = (level: PermissionLevel): number => permissionLevels.indexOf(level);
const emptyPermissions = (): EffectivePermissions => ({ view: [], comment: [], edit: [], full: [] });

/** Materialize cumulative principal arrays from a complete root-to-page lineage. */
export function computeEffectivePermissions(input: {
  workspaceId: string;
  teamspaceId: string;
  defaultAccess: PermissionLevel | null;
  lineage: readonly PermissionNode[];
}): EffectivePermissions {
  if (input.lineage.length === 0) throw new Error('A page lineage is required');
  const grants = new Map<Principal, PermissionLevel>();
  if (input.defaultAccess) grants.set(principal('workspace', input.workspaceId), input.defaultAccess);
  const seen = new Set<string>();
  for (const [index, node] of input.lineage.entries()) {
    if (node.workspaceId !== input.workspaceId || node.teamspaceId !== input.teamspaceId) throw new Error('Permission lineage crosses a workspace or teamspace');
    if (seen.has(node.id) || node.parentId !== (index === 0 ? null : input.lineage[index - 1].id)) throw new Error('Permission lineage is incomplete or cyclic');
    seen.add(node.id);
    if (!node.inheritsPermissions) grants.clear();
    for (const grant of node.grants) {
      if (grant.workspaceId !== input.workspaceId || grant.pageId !== node.id || grant.inherited) throw new Error('Only this page’s explicit ACL entries can be materialized');
      const previous = grants.get(grant.principal);
      if (!previous || rank(grant.level) > rank(previous)) grants.set(grant.principal, grant.level);
    }
  }
  const result = emptyPermissions();
  for (const [subject, level] of grants) {
    for (const required of permissionLevels) if (rank(level) >= rank(required)) result[required].push(subject);
  }
  for (const level of permissionLevels) result[level].sort();
  return result;
}

export function permissionFor(principals: readonly Principal[], permissions: EffectivePermissions): PermissionLevel | null {
  const subjects = new Set(principals);
  for (const level of [...permissionLevels].reverse()) if (permissions[level].some((subject) => subjects.has(subject))) return level;
  return null;
}

export function canAccess(principals: readonly Principal[], permissions: EffectivePermissions, required: PermissionLevel): boolean {
  const available = permissionFor(principals, permissions);
  return available !== null && rank(available) >= rank(required);
}

/** Rebuilds may delay new grants, but must never preserve a revoked grant. */
export function restrictDuringRebuild(previous: EffectivePermissions, desired: EffectivePermissions): EffectivePermissions {
  const result = emptyPermissions();
  for (const level of permissionLevels) {
    const allowed = new Set(desired[level]);
    result[level] = previous[level].filter((subject) => allowed.has(subject));
  }
  return result;
}
