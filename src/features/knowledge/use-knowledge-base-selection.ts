'use client';

import { useState } from 'react';

/** The owner component remounts on workspace/account changes. IDs never select a workspace. */
export function useKnowledgeBaseSelection(scope: string) {
  const key = `fouc.knowledge-base.selection:${scope}`;
  const [id, setId] = useState<string | null>(() => {
    try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key); }
    catch { return null; }
  });
  function select(next: string) {
    setId(next);
    try { window.localStorage.setItem(key, next); } catch { /* Selection remains available in memory. */ }
  }
  return [id, select] as const;
}
