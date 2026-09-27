'use client';

/**
 * The page editor's document session (E03): one B04 `connectPageDocument`
 * lifecycle plus one B08 undo controller, owned by the same React effect.
 *
 * The session is created only after the P03 access gate has passed and is
 * destroyed (aborting the provider, the IndexedDB binding and the Y.Doc)
 * when the page is left or the scope changes. The component never keeps a
 * second body state — it re-reads `session.getStatus()` on every B04 event.
 * The state carries its owning scope key, so a scope switch can never render
 * one page's surface on another page's (destroyed) document.
 */

import { useCallback, useEffect, useState } from 'react';
import { ySyncPluginKey } from 'y-prosemirror';
import type { PageScope } from '@fouc/shared/knowledge/contracts';
import { connectPageDocument } from '../collaboration/page-provider';
import type { PageDocumentSession } from '../collaboration/page-provider';
import type { PageDocumentStatus } from '../collaboration/page-sync-state';
import { createPageUndo } from '../collaboration/page-undo';
import type { PageUndo } from '../collaboration/page-undo';
import { getFoucApiOrigin } from '@/lib/fouc-api-endpoint';

interface SessionState {
  key: string | null;
  session: PageDocumentSession | null;
  undo: PageUndo | null;
  status: PageDocumentStatus | null;
  /** The resolved knowledge API origin (block-reference source connections need it). */
  origin: string | null;
  /** Endpoint resolution failed before any session existed. */
  failure: string | null;
}

const initialSessionState: SessionState = { key: null, session: null, undo: null, status: null, origin: null, failure: null };

export interface PageEditorSession extends Omit<SessionState, 'key'> {
  /** Re-runs endpoint resolution and session creation after a failure. */
  retry: () => void;
}

export function usePageEditorSession(scope: PageScope | null): PageEditorSession {
  const workspaceId = scope?.workspaceId ?? null;
  const pageId = scope?.pageId ?? null;
  const scopeKey = workspaceId && pageId ? `${workspaceId}:${pageId}` : null;
  const [state, setState] = useState<SessionState>(initialSessionState);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!workspaceId || !pageId) return undefined;
    const controller = new AbortController();
    let unsubscribe: (() => void) | undefined;
    let session: PageDocumentSession | undefined;
    void getFoucApiOrigin()
      .then(({ origin }) => {
        if (controller.signal.aborted) return;
        const connected = connectPageDocument({ scope: { workspaceId, pageId }, origin, signal: controller.signal });
        session = connected;
        // Editor transactions ride the ySyncPlugin origin, so B08 counts
        // them as this human's writing (its bindingOrigins contract).
        const undo = createPageUndo({ document: connected.document, bindingOrigins: [ySyncPluginKey] });
        const publish = () => setState({ key: scopeKey, session: connected, undo, status: connected.getStatus(), origin, failure: null });
        publish();
        unsubscribe = connected.subscribe(publish);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          key: scopeKey,
          session: null,
          undo: null,
          status: null,
          origin: null,
          failure: cause instanceof Error && cause.message ? cause.message : '无法确定知识服务地址。',
        });
      });
    return () => {
      controller.abort();
      unsubscribe?.();
      void session?.destroy();
    };
  }, [workspaceId, pageId, scopeKey, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  // State from a previous scope stays unread until the new session publishes.
  const current = state.key === scopeKey ? state : initialSessionState;
  return { session: current.session, undo: current.undo, status: current.status, origin: current.origin, failure: current.failure, retry };
}
