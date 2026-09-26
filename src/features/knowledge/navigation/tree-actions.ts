/**
 * Tree action definitions, the permission gate and the failure copy (U03).
 *
 * The menu of every tree row is data, not JSX: `treeActionsFor` returns the
 * ordered action set of one row filtered by the write gate (guest or missing
 * write scope sees read-only rows) and by structural rules (the recycle bin
 * restores instead of editing). Keyboard intents map raw key events onto the
 * same actions, so the context menu and the keyboard can never diverge.
 *
 * `treeOperationErrorText` turns the U01 structured error codes into Chinese
 * copy that names the operation, the reason and the rollback — the §5.4
 * contract for a failed optimistic write.
 */

import type { KnowledgeAccess } from '../data/hooks';
import type { KnowledgeErrorCode } from '../data/errors';
import { isKnowledgeDataError } from '../data/errors';

export type TreeActionId =
  | 'create-child'
  | 'rename'
  | 'set-icon'
  | 'set-cover'
  | 'move-up'
  | 'move-down'
  | 'indent'
  | 'outdent'
  | 'recycle'
  | 'restore';

export type TreeAction = {
  id: TreeActionId;
  label: string;
  /** Danger actions render with the error ink (destructive intent). */
  danger?: boolean;
};

const rowActions: readonly TreeAction[] = [
  { id: 'create-child', label: '新建子页面' },
  { id: 'rename', label: '重命名' },
  { id: 'set-icon', label: '更改图标…' },
  { id: 'set-cover', label: '设置封面…' },
  { id: 'move-up', label: '上移' },
  { id: 'move-down', label: '下移' },
  { id: 'indent', label: '缩进一级' },
  { id: 'outdent', label: '升缩进一级' },
  { id: 'recycle', label: '移入回收站', danger: true },
];

/** The full row action set; the caller disables entries the structure rejects. */
export function treeActionsForRow(): readonly TreeAction[] {
  return rowActions;
}

/** The write gate: a guest role or a scope without write is a read-only tree (U05 owns fine-grained page ACL UI). */
export function canEditTree(access: KnowledgeAccess | undefined): boolean {
  if (!access) return false;
  return access.role !== 'guest' && access.scopes.includes('write');
}

export const readOnlyTreeReason = '当前角色对工作区是只读的，页面树操作需要编辑权限。';

// ── Keyboard intents ────────────────────────────────────────────────────

export type OperationKeyIntent =
  | { kind: 'create-child' }
  | { kind: 'rename' }
  | { kind: 'recycle' }
  | { kind: 'move'; direction: 'up' | 'down' | 'indent' | 'outdent' };

export type KeyLike = { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean };

/**
 * The operation keys of one focused row. Alt+Arrows move (the plain arrows
 * stay pure navigation of the U02 roving model), F2/Enter rename, Delete
 * recycles, Cmd/Ctrl+N creates a child page.
 */
export function operationKeyIntent(event: KeyLike): OperationKeyIntent | null {
  const mod = Boolean(event.metaKey || event.ctrlKey);
  switch (event.key) {
    case 'Enter':
    case 'F2':
      return { kind: 'rename' };
    case 'Delete':
      return { kind: 'recycle' };
    case 'n':
    case 'N':
      return mod ? { kind: 'create-child' } : null;
    case 'ArrowUp':
      return event.altKey ? { kind: 'move', direction: 'up' } : null;
    case 'ArrowDown':
      return event.altKey ? { kind: 'move', direction: 'down' } : null;
    case 'ArrowRight':
      return event.altKey ? { kind: 'move', direction: 'indent' } : null;
    case 'ArrowLeft':
      return event.altKey ? { kind: 'move', direction: 'outdent' } : null;
    default:
      return null;
  }
}

// ── Failure copy ────────────────────────────────────────────────────────

const actionLabels: Record<TreeActionId, string> = {
  'create-child': '新建页面',
  rename: '重命名页面',
  'set-icon': '更改图标',
  'set-cover': '设置封面',
  'move-up': '移动页面',
  'move-down': '移动页面',
  indent: '移动页面',
  outdent: '移动页面',
  recycle: '移入回收站',
  restore: '恢复页面',
};

const errorCodeCopy: Record<KnowledgeErrorCode, string> = {
  UNAUTHENTICATED: '登录状态已过期，请重新登录后再试。',
  PAYMENT_REQUIRED: '当前计划不支持该操作。',
  FORBIDDEN: '没有执行该操作的权限。',
  NOT_FOUND: '页面树服务尚未开放该操作（后端路由装配前如实报错）。',
  INVALID_REQUEST: '请求内容不符合页面树契约。',
  CONFLICT: '页面结构已被他人更新，正在重新同步。',
  PAYLOAD_TOO_LARGE: '请求内容超出大小限制。',
  RATE_LIMITED: '操作过于频繁，请稍后重试。',
  TIMEOUT: '操作超时，请重试。',
  UNAVAILABLE: '知识服务暂时不可用。',
  NETWORK: '无法连接知识服务，请检查网络。',
  ENDPOINT: '知识服务地址未配置。',
};

/** One structured Chinese line for a failed optimistic operation: what failed, why, and that the tree was restored. */
export function treeOperationErrorText(action: TreeActionId, error: unknown): string {
  const label = actionLabels[action];
  if (isKnowledgeDataError(error)) {
    return `${label}失败（${error.code}）：${errorCodeCopy[error.code]}已恢复到操作前的页面树。`;
  }
  return `${label}失败：连接异常，已恢复到操作前的页面树。`;
}

/** Success copy for the two operations whose outcome is worth confirming (recoverable deletion / restoration). */
export function treeOperationSuccessText(action: 'recycle' | 'restore', title: string): string {
  return action === 'recycle' ? `「${title}」已移入回收站，可在回收站恢复。` : `「${title}」已恢复到原位置。`;
}
