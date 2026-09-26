/**
 * Pure view-model logic of the page editor (E03, design §4/§5.1).
 *
 * Everything here is a pure function over the B04 session status and the P03
 * page access snapshot, so the full loading / offline / syncing / synced /
 * readonly / error closed loop is decidable — and testable — without React
 * or a browser. The container maps these results straight onto the UI; no
 * state is invented on the way.
 */

import { permissionLevels } from '@fouc/shared/knowledge/contracts';
import type { PermissionLevel } from '@fouc/shared/knowledge/contracts';
import type { PageDocumentStatus } from '../collaboration/page-sync-state';

/** Whether `level` grants at least `required` (view < comment < edit < full). */
export function levelSatisfies(level: PermissionLevel, required: PermissionLevel): boolean {
  return permissionLevels.indexOf(level) >= permissionLevels.indexOf(required);
}

export function permissionLevelLabel(level: PermissionLevel): string {
  const labels: Record<PermissionLevel, string> = { view: '查看', comment: '评论', edit: '编辑', full: '完全访问' };
  return labels[level];
}

/** The P03 `page.access` gate in editor terms; `view` authorization answers with the effective level. */
export type PageEditorGate =
  | { status: 'pending' }
  | { status: 'granted'; level: PermissionLevel }
  | { status: 'denied' }
  | { status: 'error' };

export interface PageEditorGateQuery {
  isPending: boolean;
  error: unknown;
  data?: { authorized: boolean; level: PermissionLevel | null } | null;
}

/**
 * Maps one access query result onto the gate. The query asks for `view`
 * authorization; an allow response carries the page's effective level, so a
 * second round trip for editability is unnecessary, and a denial is terminal
 * for the whole editor (B01 would reject the collaboration connection too).
 */
export function pageEditorGateOf(query: PageEditorGateQuery): PageEditorGate {
  if (query.isPending) return { status: 'pending' };
  if (query.error !== null && query.error !== undefined) return { status: 'error' };
  const snapshot = query.data;
  // A settled query without a payload is a broken transport, not a denial.
  if (!snapshot) return { status: 'error' };
  if (!snapshot.authorized || !snapshot.level) return { status: 'denied' };
  return { status: 'granted', level: snapshot.level };
}

export type SyncBadge = 'loading' | 'local-only' | 'syncing' | 'synced' | 'offline' | 'error';
export type SyncTone = 'quiet' | 'progress' | 'ok' | 'warn' | 'error';

export interface SyncIndicatorView {
  badge: SyncBadge;
  /** Short product copy for the indicator pill. */
  label: string;
  /** One-sentence explanation of what the state means for the user's edits. */
  hint: string;
  tone: SyncTone;
  /** True while a result is expected momentarily (renders a spinner). */
  busy: boolean;
}

const loadingView = (label: string, hint: string): SyncIndicatorView => ({ badge: 'loading', label, hint, tone: 'quiet', busy: true });

/** The B04 status machine (§5.1 lifecycle) as one honest indicator state. */
export function syncIndicatorView(status: PageDocumentStatus | null): SyncIndicatorView {
  if (!status) return loadingView('正在打开文档', '正在建立页面文档会话。');
  if (!status.localReady) return loadingView('正在读取本地副本', '正在从本机离线副本恢复页面，随后连接知识服务。');
  switch (status.phase) {
    case 'local-only':
      return { badge: 'local-only', label: '已保存在本机', hint: '本地副本已就绪；正在准备连接知识服务，编辑会先落在本地。', tone: 'quiet', busy: false };
    case 'syncing':
      return { badge: 'syncing', label: '正在同步', hint: '正在与知识服务交换文档更新。', tone: 'progress', busy: true };
    case 'synced':
      return { badge: 'synced', label: '已同步', hint: '所有更改都已同步到知识服务。', tone: 'ok', busy: false };
    case 'offline':
      return { badge: 'offline', label: '离线可编辑', hint: '连接已断开；更改继续保存在本地副本，重连后自动合并。', tone: 'warn', busy: false };
    case 'error':
      return {
        badge: 'error',
        label: '同步被拒绝',
        hint: status.errorReason
          ? `知识服务拒绝了本页的同步连接（${status.errorReason}）。正文以本地副本展示。`
          : '知识服务拒绝了本页的同步连接。正文以本地副本展示。',
        tone: 'error',
        busy: false,
      };
  }
}

/** Why the editor surface refuses edits right now. */
export type ReadonlyReason = 'below-edit' | 'auth-failed';

export interface PageEditorViewModel {
  /** Whether the editor surface may mount (the access gate has passed). */
  open: boolean;
  /** The gate, present for the container whenever `open` is false. */
  gate: PageEditorGate;
  /** The target `editable` of the Tiptap instance (`editor.setEditable`). */
  editable: boolean;
  readonlyReason: ReadonlyReason | null;
  sync: SyncIndicatorView;
}

/**
 * The single decision for the whole closed loop:
 *
 * - access below `edit` → always readonly with the access-level reason;
 * - a terminal B04 auth failure stops editing too (writes could never sync);
 * - every other phase — local-only, syncing, synced, offline — keeps the
 *   document editable (§5.4: offline body editing merges through the CRDT).
 */
export function derivePageEditorView(gate: PageEditorGate, status: PageDocumentStatus | null): PageEditorViewModel {
  if (gate.status !== 'granted') {
    return { open: false, gate, editable: false, readonlyReason: null, sync: syncIndicatorView(null) };
  }
  const canEditByAccess = levelSatisfies(gate.level, 'edit');
  const authFailed = status?.phase === 'error';
  return {
    open: true,
    gate,
    editable: canEditByAccess && !authFailed,
    readonlyReason: authFailed ? 'auth-failed' : canEditByAccess ? null : 'below-edit',
    sync: syncIndicatorView(status),
  };
}
