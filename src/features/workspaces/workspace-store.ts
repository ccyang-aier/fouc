import { createDevelopmentWorkspaces } from '@fouc/shared/development-workbench';

export type RailSpace = { id: string; label: string; pinned: boolean; kind: 'local' | 'server' };
export type WorkspaceSelection = { localSpaces: RailSpace[]; activeId: string; serverPins: Record<string, boolean> };
export const workspaceSelectionKey = 'fouc.workspaces.current';
export const DEFAULT_SPACES: RailSpace[] = process.env.NODE_ENV === 'development'
  ? createDevelopmentWorkspaces().map((space) => ({ id: space.id, label: space.name, pinned: true, kind: 'local' }))
  : [{ id: 'personal-workspace', label: '个人工作台', pinned: true, kind: 'local' }];

/** Application selection, not identity, owns the active resource boundary. */
export function createWorkspaceStore(storage: Pick<Storage, 'getItem' | 'setItem'> | null) {
  let snapshot: WorkspaceSelection = { localSpaces: DEFAULT_SPACES, activeId: DEFAULT_SPACES[0].id, serverPins: {} };
  try {
    const saved = storage?.getItem(workspaceSelectionKey);
    if (saved) snapshot = JSON.parse(saved) as WorkspaceSelection;
  } catch { /* Preferences may be unavailable; selection still works in memory. */ }
  const listeners = new Set<() => void>();
  function update(next: WorkspaceSelection) {
    snapshot = next;
    try { storage?.setItem(workspaceSelectionKey, JSON.stringify(next)); }
    catch { /* Preference write failures do not block navigation. */ }
    for (const listener of listeners) listener();
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: (): WorkspaceSelection | null => null,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    select(id: string, expectedActiveId?: string) {
      if (expectedActiveId !== undefined && snapshot.activeId !== expectedActiveId) return;
      if (id !== snapshot.activeId) update({ ...snapshot, activeId: id });
    },
    updateSpaces(spaces: RailSpace[]) {
      const serverIds = new Set(spaces.filter((space) => space.kind === 'server').map((space) => space.id));
      const localSpaces = [...spaces.filter((space) => space.kind === 'local'), ...snapshot.localSpaces.filter((space) => serverIds.has(space.id))];
      const serverPins = { ...snapshot.serverPins };
      for (const space of spaces) if (space.kind === 'server') serverPins[space.id] = space.pinned;
      update({ ...snapshot, localSpaces, serverPins });
    },
    rememberServerScopes(ids: string[]) {
      if (ids.every((id) => id in snapshot.serverPins)) return;
      update({ ...snapshot, serverPins: { ...Object.fromEntries(ids.map((id) => [id, true])), ...snapshot.serverPins } });
    },
    create() {
      const space: RailSpace = { id: `space-${crypto.randomUUID()}`, label: `新工作空间 ${snapshot.localSpaces.length + 1}`, pinned: true, kind: 'local' };
      update({ ...snapshot, localSpaces: [...snapshot.localSpaces, space], activeId: space.id });
      return space.label;
    },
  };
}
