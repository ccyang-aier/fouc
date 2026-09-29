'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { developmentId } from '@fouc/shared/development-workbench';
import type { Project } from '@fouc/shared/projects';
import { useIdentity } from '@/features/identity/identity-provider';
import { useWorkspace } from '@/features/workspaces/workspace-provider';
import type { ProjectManagementPanelId } from './project-management-model';
import { projectClient } from './project-client';

export const demonstrationProjectId = developmentId(0x50000000, 1);
type ProjectState = { projects: Project[]; selectedId: string | null; favorites: string[] };
type ResourceContext = {
  projects: Project[];
  selectedProject: Project | null;
  favorites: readonly string[];
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  managementPanel: ProjectManagementPanelId | null;
  setManagementPanel: (panel: ProjectManagementPanelId | null) => void;
  selectProject: (id: string) => void;
  createProject: (name: string) => Promise<Project | null>;
  renameProject: (id: string, name: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  setFavorite: (id: string, favorite: boolean) => void;
};
const Context = createContext<ResourceContext | null>(null);

const projectStorageKey = (workspaceId: string) => `fouc.workspace.${workspaceId}.projects`;
const preferenceKey = (principal: string, workspaceId: string) => `fouc.project.selection.${principal}.${workspaceId}`;
function readStorage<T>(key: string, fallback: T): T {
  try { const saved = window.localStorage.getItem(key); return saved ? JSON.parse(saved) as T : fallback; }
  catch { return fallback; }
}
function saveStorage(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* In-memory state remains usable. */ }
}

export function ProjectResourceProvider({ children }: { children: ReactNode }) {
  const { activeSpace } = useWorkspace();
  const { session } = useIdentity();
  const principal = session.status === 'authenticated' ? session.user.id : 'guest';
  return <ProjectResourceScope key={`${activeSpace.id}:${activeSpace.kind}:${principal}`} workspaceId={activeSpace.id} kind={activeSpace.kind} principal={principal}>{children}</ProjectResourceScope>;
}

function ProjectResourceScope({ children, workspaceId, kind, principal }: { children: ReactNode; workspaceId: string; kind: 'local' | 'server'; principal: string }) {
  const [state, setState] = useState<ProjectState>({ projects: [], selectedId: null, favorites: [] });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [managementPanel, setManagementPanel] = useState<ProjectManagementPanelId | null>(null);
  const prefs = preferenceKey(principal, workspaceId);

  useEffect(() => {
    const controller = new AbortController();
    const selected = readStorage<{ selectedId: string | null; favorites: string[] }>(prefs, { selectedId: null, favorites: [] });
    if (kind === 'local') {
      const projects = readStorage<Project[]>(projectStorageKey(workspaceId), []).filter((project) => project.workspaceId === workspaceId);
      queueMicrotask(() => { if (!controller.signal.aborted) { setState({ projects, selectedId: selected.selectedId, favorites: selected.favorites }); setStatus('ready'); } });
    } else if (principal === 'guest') {
      queueMicrotask(() => { if (!controller.signal.aborted) { setState({ projects: [], selectedId: null, favorites: [] }); setStatus('error'); setError('登录并加入此工作空间后，才能查看其中的项目。'); } });
    } else {
      void projectClient.list(workspaceId, controller.signal).then((projects) => {
        if (controller.signal.aborted) return;
        setState({ projects, selectedId: selected.selectedId, favorites: selected.favorites });
        setStatus('ready');
      }).catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setStatus('error');
        setError(cause instanceof Error ? cause.message : '项目加载失败');
      });
    }
    return () => controller.abort();
  }, [workspaceId, kind, principal, prefs]);

  const selectedProject = state.projects.find((project) => project.id === state.selectedId) ?? state.projects[0] ?? null;
  const persist = (next: ProjectState) => {
    setState(next);
    saveStorage(prefs, { selectedId: next.selectedId, favorites: next.favorites });
    if (kind === 'local') saveStorage(projectStorageKey(workspaceId), next.projects);
  };
  const value: ResourceContext = {
    projects: state.projects, selectedProject, favorites: state.favorites, status, error,
    managementPanel, setManagementPanel,
    selectProject: (id) => { if (state.projects.some((item) => item.id === id)) { persist({ ...state, selectedId: id }); setManagementPanel(null); } },
    createProject: async (name) => {
      const title = name.trim();
      if (!title) return null;
      try {
        const created = kind === 'server' ? await projectClient.create(workspaceId, title) : { workspaceId, id: crypto.randomUUID(), name: title };
        persist({ ...state, projects: [...state.projects, created], selectedId: created.id });
        setError(null);
        return created;
      } catch (cause) { setError(cause instanceof Error ? cause.message : '项目创建失败'); return null; }
    },
    renameProject: async (id, name) => {
      const title = name.trim();
      if (!title || !state.projects.some((project) => project.id === id)) return;
      try {
        const updated = kind === 'server' ? await projectClient.rename(workspaceId, id, title) : { workspaceId, id, name: title };
        persist({ ...state, projects: state.projects.map((project) => project.id === id ? updated : project) });
        setError(null);
      } catch (cause) { setError(cause instanceof Error ? cause.message : '项目重命名失败'); }
    },
    removeProject: async (id) => {
      if (!state.projects.some((project) => project.id === id)) return;
      try {
        if (kind === 'server') await projectClient.remove(workspaceId, id);
        const projects = state.projects.filter((project) => project.id !== id);
        persist({ projects, selectedId: state.selectedId === id ? projects[0]?.id ?? null : state.selectedId, favorites: state.favorites.filter((favorite) => favorite !== id) });
        setManagementPanel(null);
        setError(null);
      } catch (cause) { setError(cause instanceof Error ? cause.message : '项目删除失败'); }
    },
    setFavorite: (id, favorite) => {
      if (!state.projects.some((project) => project.id === id)) return;
      persist({ ...state, favorites: favorite ? [...new Set([...state.favorites, id])] : state.favorites.filter((entry) => entry !== id) });
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useProjectResources() {
  const value = useContext(Context);
  if (!value) throw new Error('ProjectResourceProvider is required');
  return value;
}
