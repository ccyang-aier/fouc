'use client';

/**
 * The page editor container (E03, design §4/§5.1) — the state closed loop in
 * one component, every state honest and reachable:
 *
 * 1. P03 `page.access` gate: pending spinner, retryable error, terminal
 *    forbidden — a page without view rights never mounts a session.
 * 2. B04 session: endpoint failures retry, then the document opens from the
 *    local copy regardless of the cloud connection.
 * 3. The surface: the derived view model (`derivePageEditorView`) drives the
 *    sync indicator, the readonly banner and the Tiptap editable flag, so
 *    local-only / syncing / synced / offline / error / readonly can never
 *    disagree with each other.
 */

import type { PageScope } from '@fouc/shared/knowledge/contracts';
import type { FoucAuthUser } from '../../identity/auth-api';
import { CanvasError, CanvasForbidden, CanvasSpinner } from '../canvas-states';
import { knowledgeErrorCodeOf } from '../entry-state';
import { derivePageEditorView } from './editor-state';
import { PageEditorSurface } from './editor-surface';
import { usePageEditorGate } from './page-access';
import { usePageEditorSession } from './page-session';

function pageAccessErrorText(error: unknown): string {
  const copy: Record<string, string> = {
    UNAVAILABLE: '知识服务暂时不可用，请稍后重试。',
    NETWORK: '无法连接知识服务，请检查网络后重试。',
    TIMEOUT: '连接知识服务超时，请重试。',
    RATE_LIMITED: '请求过于频繁，请稍后重试。',
    ENDPOINT: '知识服务地址未配置，无法建立连接。',
    PAYMENT_REQUIRED: '该操作需要更高的访问权限。',
  };
  const code = knowledgeErrorCodeOf(error);
  return (code && copy[code]) ?? '确认页面访问时出现问题，请重试。';
}

/** The page editor of one open page; mounts inside the U02 canvas main column. */
export function PageEditor({ scope, user }: { scope: PageScope; user: FoucAuthUser | null }) {
  const { gate, error: gateError, retry } = usePageEditorGate(scope.workspaceId, scope.pageId);
  // The collaboration session only exists once view access has been granted —
  // a denied page never opens a WebSocket or an IndexedDB copy.
  const session = usePageEditorSession(gate.status === 'granted' ? scope : null);
  const view = derivePageEditorView(gate, session.status);

  if (gate.status === 'pending') {
    return <CanvasSpinner label="正在确认页面访问" />;
  }
  if (gate.status === 'error') {
    return (
      <CanvasError
        title="无法确认页面访问"
        detail={pageAccessErrorText(gateError)}
        onRetry={retry}
      />
    );
  }
  if (gate.status === 'denied') {
    return (
      <CanvasForbidden
        title="没有该页面的访问权限"
        detail="当前凭证对这个页面没有查看权限；如果最近权限有调整，请联系页面所有者。"
      />
    );
  }
  if (session.failure) {
    return <CanvasError title="无法打开页面文档" detail={session.failure} onRetry={session.retry} />;
  }
  if (!session.session || !session.undo) {
    return <CanvasSpinner label="正在打开文档" />;
  }
  return (
    <PageEditorSurface
      scope={scope}
      session={session.session}
      origin={session.origin}
      user={user}
      pageUndo={session.undo}
      level={gate.level}
      view={view}
    />
  );
}
