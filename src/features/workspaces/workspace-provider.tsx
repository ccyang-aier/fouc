'use client';

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode, type SetStateAction } from 'react';
import { useIdentity } from '@/features/identity/identity-provider';
import { organizationClient, type WorkspaceWithRole } from '@/features/workspaces/organization-client';
import { createWorkspaceStore, type RailSpace } from './workspace-store';

type ServerDirectory = { owner: string | null; revision: number; status: 'pending' | 'success' | 'error'; items: WorkspaceWithRole[]; error: unknown };
type WorkspaceContextValue = {
  activeSpace: RailSpace;
  spaces: RailSpace[];
  serverDirectory: ServerDirectory;
  selectWorkspace: (id: string, expectedActiveId?: string) => void;
  updateSpaces: (action: SetStateAction<RailSpace[]>) => void;
  createWorkspace: () => string;
  refreshWorkspaces: () => void;
};
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { session } = useIdentity();
  const owner = session.status === 'authenticated' ? session.user.id : null;
  const [store] = useState(() => {
    let storage: Storage | null = null;
    try { if (typeof window !== 'undefined') storage = window.localStorage; } catch { /* Memory-only preferences. */ }
    return createWorkspaceStore(storage);
  });
  const selection = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [revision, setRevision] = useState(0);
  const [directory, setDirectory] = useState<ServerDirectory>({ owner: null, revision: 0, status: 'pending', items: [], error: null });
  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController();
    void (async () => {
      const items: WorkspaceWithRole[] = [];
      let cursor: string | null = null;
      do {
        const page = await organizationClient.listWorkspaces({ cursor, limit: 100, signal: controller.signal });
        items.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor && !controller.signal.aborted);
      if (!controller.signal.aborted) {
        store.rememberServerScopes(items.map((space) => space.id));
        setDirectory({ owner, revision, status: 'success', items, error: null });
      }
    })().catch((error: unknown) => {
      if (!controller.signal.aborted) setDirectory({ owner, revision, status: 'error', items: [], error });
    });
    return () => controller.abort();
  }, [owner, revision, store]);
  if (!selection) return null;
  // Never expose the previous account's directory, even before effect cleanup runs.
  const serverDirectory: ServerDirectory = owner && directory.owner === owner && directory.revision === revision
    ? directory : { owner, revision, status: 'pending', items: [], error: null };
  const serverIds = new Set(serverDirectory.items.map((space) => space.id));
  // A known server scope cannot turn into an unprotected device workspace on
  // sign-out or membership loss, including development fixtures with shared IDs.
  const spaces: RailSpace[] = [...selection.localSpaces.filter((space) => !serverIds.has(space.id)).map((space) => space.id in selection.serverPins ? { ...space, kind: 'server' as const, pinned: selection.serverPins[space.id] } : space), ...serverDirectory.items.map((space) => ({ id: space.id, label: space.name, kind: 'server' as const, pinned: selection.serverPins[space.id] ?? true }))];
  const activeSpace = spaces.find((space) => space.id === selection.activeId)
    ?? { id: selection.activeId, label: '工作空间', kind: 'server' as const, pinned: true };
  return <WorkspaceContext.Provider value={{
    activeSpace, spaces, serverDirectory,
    selectWorkspace: store.select,
    updateSpaces: (action) => store.updateSpaces(typeof action === 'function' ? action(spaces) : action),
    createWorkspace: store.create,
    refreshWorkspaces: () => setRevision((value) => value + 1),
  }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('WorkspaceProvider is required');
  return value;
}
