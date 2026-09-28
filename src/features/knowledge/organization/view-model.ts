/**
 * Pure presentation logic of the organization UI (O02): list state machine,
 * role-authority rendering rules and the root default-access presentation with
 * the P02 rebuild notice. No React here, so every rule is directly testable.
 */

import type { MemberRole } from '@/features/workspaces/organization-client';
import type { TeamspaceAccess } from '../data/knowledge-catalog-client';

/** The four observable list states plus the ready state they lead to. */
export type OrganizationListState = 'loading' | 'unauthenticated' | 'forbidden' | 'error' | 'empty' | 'ready';

export type ListStateInput = {
  /** TanStack Query status: 'pending' while loading, 'error' on failure. */
  status: 'pending' | 'error' | 'success';
  /** Normalized domain error code, if any. */
  errorCode?: string | null;
  /** Item count of the successfully loaded page(s). */
  itemCount?: number | null;
};

export function deriveListState(input: ListStateInput): OrganizationListState {
  if (input.status === 'pending') return 'loading';
  if (input.status === 'error') {
    if (input.errorCode === 'UNAUTHENTICATED') return 'unauthenticated';
    if (input.errorCode === 'FORBIDDEN') return 'forbidden';
    return 'error';
  }
  return (input.itemCount ?? 0) === 0 ? 'empty' : 'ready';
}

export const memberRoleLabels: Record<MemberRole, string> = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
  guest: '访客',
};

/** Directory (members, groups, teamspaces) is closed to guests. */
export function canBrowseDirectory(role: MemberRole): boolean {
  return role !== 'guest';
}

/** Workspace management: creating groups/teamspaces, renames, defaults. */
export function canManageOrganization(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin';
}

/** Roles the actor may assign; mirrors the backend `requireRoleAuthority` matrix. */
export function assignableRoles(role: MemberRole): MemberRole[] {
  if (role === 'owner') return ['owner', 'admin', 'member', 'guest'];
  if (role === 'admin') return ['member', 'guest'];
  return [];
}

/** Whether the actor may touch (change role / remove) one specific member row. */
export function canManageMember(actorRole: MemberRole, targetRole: MemberRole): boolean {
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') return targetRole === 'member' || targetRole === 'guest';
  return false;
}

export type DefaultAccessOption = {
  value: TeamspaceAccess;
  label: string;
  description: string;
};

export const defaultAccessOptions: readonly DefaultAccessOption[] = [
  { value: null, label: '仅显式授权', description: '根页面不设默认权限，只有被单独授权的成员与群组可访问' },
  { value: 'view', label: '可查看', description: '工作区成员默认可以查看该团队空间内的页面' },
  { value: 'comment', label: '可评论', description: '工作区成员默认可以查看并评论页面' },
  { value: 'edit', label: '可编辑', description: '工作区成员默认可以编辑页面内容' },
  { value: 'full', label: '完全控制', description: '工作区成员默认可以编辑、移动与共享页面' },
];

export function defaultAccessLabel(value: TeamspaceAccess): string {
  return defaultAccessOptions.find((option) => option.value === value)?.label ?? '仅显式授权';
}

export function defaultAccessDescription(value: TeamspaceAccess): string {
  return defaultAccessOptions.find((option) => option.value === value)?.description ?? '';
}

/**
 * P02 semantics: changing the root default access fences every page of the
 * teamspace in the same transaction — existing grants stop working immediately
 * and an asynchronous rebuild restores access under the new default.
 */
export const defaultAccessRebuildNotice =
  '修改根默认权限后，该团队空间内所有页面的现有授权会立即失效，系统将按新的默认权限重新计算；重算完成前，依赖旧授权的访问会暂时中断。';

/** Only an actual default change on an existing teamspace needs the rebuild confirmation. */
export function needsAccessRebuildConfirmation(current: TeamspaceAccess, next: TeamspaceAccess): boolean {
  return current !== next;
}

export const workspaceKindLabels: Record<'personal' | 'team', string> = {
  personal: '个人工作区',
  team: '团队工作区',
};
