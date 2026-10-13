'use client';

import { useEffect, useRef, useState } from 'react';
import { initialDashboardState, type DashboardState, type DashboardTask } from './dashboard-model';

/** The project canvas is keyed by source:projectId, so switching projects remounts this scope. */
export function useDashboard(projectKey: string) {
  const storageKey = `fouc.project-dashboard.${projectKey}`;
  const [state, setState] = useState<DashboardState>(initialDashboardState);
  const snapshot = useRef(state);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as DashboardState;
        if (Array.isArray(parsed.tasks) && Array.isArray(parsed.activities) && Array.isArray(parsed.favorites)) {
          queueMicrotask(() => { snapshot.current = parsed; setState(parsed); });
        }
      }
    } catch { queueMicrotask(() => setStorageError(true)); }
  }, [storageKey]);

  function update(change: (current: DashboardState) => DashboardState) {
    const next = change(snapshot.current);
    snapshot.current = next;
    setState(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setStorageError(true); }
  }

  return {
    state,
    storageError,
    saveTask: (task: DashboardTask) => update(current => ({ ...current, tasks: current.tasks.map(item => item.id === task.id ? task : item) })),
    createTask: (task: DashboardTask) => update(current => ({ ...current, tasks: [...current.tasks, task], activities: [{ id: crypto.randomUUID(), actor: 'Sarah Smither', text: 'created', subject: task.title, time: 'Just now' }, ...current.activities] })),
    removeTask: (id: string) => update(current => ({ ...current, tasks: current.tasks.filter(task => task.id !== id) })),
  };
}
