"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { developmentId } from '@fouc/shared/development-workbench';
import type { Project } from '@fouc/shared/projects';
import { useIdentity } from '@/features/identity/identity-provider';
import type { ProjectManagementPanelId } from './project-management-model';
import { projectClient } from './project-client';

export const demonstrationProjectId = developmentId(0x50000000, 1);
export type ProjectResource = Project & { source: 'local' | 'server' };
type ProjectState = { projects: ProjectResource[]; selectedId: string | null; favorites: string[] };
type ResourceContext = {
  projects: ProjectResource[];
  selectedProject: ProjectResource | null;
  favorites: readonly string[];
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  managementPanel: ProjectManagementPanelId | null;
  setManagementPanel: (panel: ProjectManagementPanelId | null) => void;
  selectProject: (id: string) => void;
  createProject: (name: string, source?: ProjectResource['source']) => Promise<ProjectResource | null>;
  renameProject: (id: string, name: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  setFavorite: (id: string, favorite: boolean) => void;
};
const Context = createContext<ResourceContext | null>(null);

const projectStorageKey = 'fouc.local-projects';
const activeProjectKey = 'fouc.project.active';
const preferenceKey = (principal: string) => `fouc.project.selection.${principal}`;
function readStorage<T>(key: string, fallback: T): T {
  try { const saved = window.localStorage.getItem(key); return saved ? JSON.parse(saved) as T : fallback; }
  catch { return fallback; }
}
function saveStorage(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* In-memory state remains usable. */ }
}

export function ProjectResourceProvider({ children }: { children: ReactNode }) {
  const { session } = useIdentity();
  const principal = session.status === 'authenticated' ? session.user.id : 'guest';
  return <ProjectResourceScope key={principal} principal={principal}>{children}</ProjectResourceScope>;
}

function ProjectResourceScope({ children, principal }: { children: ReactNode; principal: string }) {
  const [state, setState] = useState<ProjectState>({ projects: [], selectedId: null, favorites: [] });
  const snapshot = useRef(state);
  const updateState = useCallback((change: (current: ProjectState) => ProjectState) => {
    const next = change(snapshot.current);
    snapshot.current = next;
    setState(next);
    return next;
  }, []);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [managementPanel, setManagementPanel] = useState<ProjectManagementPanelId | null>(null);
  const prefs = preferenceKey(principal);

  useEffect(() => {
    const controller = new AbortController();
    const selectedId = readStorage<string | null>(activeProjectKey, null);
    const favorites = readStorage<string[]>(prefs, []);
    const local = readStorage<Project[]>(projectStorageKey, []).map(project => ({ ...project, source: 'local' as const }));
    const publish = (projects: ProjectResource[]) => {
      if (controller.signal.aborted) return;
      updateState(() => ({ projects, selectedId, favorites }));
      if (principal === 'guest' || projects.length > 0) setStatus('ready');
    };
    queueMicrotask(() => publish(local));
    if (principal !== 'guest') {
      void projectClient.list(controller.signal).then(projects => {
        if (controller.signal.aborted) return;
        updateState(current => ({ ...current, projects: [...current.projects.filter(project => project.source === 'local'), ...projects.map(project => ({ ...project, source: 'server' as const }))] }));
        setStatus('ready');
      }).catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : '服务端项目加载失败');
        setStatus('ready');
      });
    }
    return () => controller.abort();
  }, [principal, prefs, updateState]);

  const selectedProject = state.selectedId ? state.projects.find(project => project.id === state.selectedId) ?? null : state.projects[0] ?? null;
  const persist = (change: (current: ProjectState) => ProjectState) => {
    const next = updateState(change);
    saveStorage(activeProjectKey, next.selectedId);
    saveStorage(prefs, next.favorites);
    saveStorage(projectStorageKey, next.projects.filter(project => project.source === 'local').map(({ id, name }) => ({ id, name })));
  };
  const value: ResourceContext = {
    projects: state.projects, selectedProject, favorites: state.favorites, status, error,
    managementPanel, setManagementPanel,
    selectProject: (id) => { if (state.projects.some((item) => item.id === id)) { persist(current => ({ ...current, selectedId: id })); setManagementPanel(null); } },
    createProject: async (name, source = selectedProject?.source ?? 'local') => {
      const title = name.trim();
      if (!title) return null;
      try {
        if (source === 'server' && principal === 'guest') throw new Error('登录后才能创建服务端项目');
        const project = source === 'server' ? await projectClient.create(title) : { id: crypto.randomUUID(), name: title };
        const created = { ...project, source };
        persist(current => ({ ...current, projects: [...current.projects.filter(project => project.id !== created.id), created], selectedId: created.id }));
        setError(null);
        return created;
      } catch (cause) { setError(cause instanceof Error ? cause.message : '项目创建失败'); return null; }
    },
    renameProject: async (id, name) => {
      const title = name.trim();
      const resource = state.projects.find(project => project.id === id);
      if (!title || !resource) return;
      try {
        const project = resource.source === 'server' ? await projectClient.rename(id, title) : { id, name: title };
        const updated = { ...project, source: resource.source };
        persist(current => ({ ...current, projects: current.projects.map((project) => project.id === id ? updated : project) }));
        setError(null);
      } catch (cause) { setError(cause instanceof Error ? cause.message : '项目重命名失败'); }
    },
    removeProject: async (id) => {
      const resource = state.projects.find(project => project.id === id);
      if (!resource) return;
      try {
        if (resource.source === 'server') await projectClient.remove(id);
        persist(current => {
          const projects = current.projects.filter((project) => project.id !== id);
          return { projects, selectedId: current.selectedId === id ? projects[0]?.id ?? null : current.selectedId, favorites: current.favorites.filter((favorite) => favorite !== id) };
        });
        setManagementPanel(null);
        setError(null);
      } catch (cause) { setError(cause instanceof Error ? cause.message : '项目删除失败'); }
    },
    setFavorite: (id, favorite) => {
      if (!state.projects.some((project) => project.id === id)) return;
      persist(current => ({ ...current, favorites: favorite ? [...new Set([...current.favorites, id])] : current.favorites.filter((entry) => entry !== id) }));
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useProjectResources() {
  const value = useContext(Context);
  if (!value) throw new Error('ProjectResourceProvider is required');
  return value;
}
