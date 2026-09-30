'use client';

import { useEffect, useRef } from 'react';
import { useWorkspace } from '@/features/workspaces/workspace-provider';
import { readDocumentLink } from './document-link';

/** Mounted by the shell once: following a link must not undo later workspace choices. */
export function useDocumentLinkNavigation() {
  const { spaces, selectWorkspace } = useWorkspace();
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    const target = readDocumentLink(window.location.href);
    if (!target) { handled.current = true; return; }
    const space = spaces.find((item) => item.id === target.workspaceId && item.kind === (target.source === 'local' ? 'local' : 'server'));
    if (space) { handled.current = true; selectWorkspace(space.id); }
  }, [spaces, selectWorkspace]);
}
