'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  DashboardActivity,
  DashboardDocument,
  DashboardMeeting,
  DashboardMilestone,
  DashboardPersonId,
  DashboardProject,
  DashboardState,
  DashboardTarget,
  DashboardTask,
} from './dashboard-model';
import { initialDashboardState } from './dashboard-seed';
import { dashboardTimestamp } from './dashboard-time';

function normalizeTask(task: DashboardTask): DashboardTask {
  const progress = Math.max(0, Math.min(100, Math.round(task.progress)));
  return {
    ...task,
    progress: task.status === 'Completed' ? 100 : progress,
    commentCount: task.comments.length,
    links: task.comments.filter((comment) => comment.attachment).length,
  };
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [...items, item];
}

function activity(target: DashboardTarget, subject: string, text: string): DashboardActivity {
  return {
    id: crypto.randomUUID(),
    actor: 'Sarah Smither',
    text,
    actionKey: text,
    subject,
    time: dashboardTimestamp(),
    target,
    read: false,
  };
}

function isDashboardState(value: unknown): value is DashboardState {
  if (!value || typeof value !== 'object') return false;
  const state = value as DashboardState;
  return (
    Array.isArray(state.projects) &&
    Array.isArray(state.tasks) &&
    Array.isArray(state.documents) &&
    Array.isArray(state.meetings) &&
    Array.isArray(state.memberIds) &&
    Array.isArray(state.activities) &&
    Array.isArray(state.milestones) &&
    'updatedAt' in state
  );
}

/** The parent keys the canvas by source:projectId, keeping each resource's local state isolated. */
export function useDashboard(projectKey: string) {
  const storageKey = `fouc.project-dashboard.${projectKey}`;
  const [state, setState] = useState<DashboardState>(initialDashboardState);
  const snapshot = useRef(state);
  const [storageError, setStorageError] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let disposed = false;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isDashboardState(parsed)) {
          queueMicrotask(() => {
            if (disposed) return;
            snapshot.current = parsed;
            setState(parsed);
          });
        } else {
          // Pre-release fixtures have one current shape; discard obsolete development data.
          window.localStorage.removeItem(storageKey);
        }
      }
    } catch {
      queueMicrotask(() => {
        if (!disposed) setStorageError(true);
      });
    }
    queueMicrotask(() => {
      if (!disposed) setHydrated(true);
    });
    return () => {
      disposed = true;
    };
  }, [storageKey]);

  function update(change: (current: DashboardState) => DashboardState) {
    const next = { ...change(snapshot.current), updatedAt: new Date().toISOString() };
    snapshot.current = next;
    setState(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }

  function saveTask(task: DashboardTask) {
    update((current) => {
      if (!current.projects.some((project) => project.id === task.projectId)) return current;
      const previous = current.tasks.find((item) => item.id === task.id);
      const next = normalizeTask(task);
      const text = !previous
        ? 'created'
        : next.comments.length > previous.comments.length
          ? 'commented on'
          : next.status === 'Completed' && previous.status !== 'Completed'
            ? 'completed'
            : 'updated';
      return {
        ...current,
        tasks: upsert(current.tasks, next),
        projects: current.projects.map((project) => {
          if (!previous || project.id !== next.projectId) return project;
          return {
            ...project,
            name: project.name === previous.title ? next.title : project.name,
            description:
              project.description === previous.description ? next.description : project.description,
            priority: project.priority === previous.priority ? next.priority : project.priority,
            favoriteLabel:
              project.name === previous.title && next.title !== previous.title
                ? next.title
                : project.favoriteLabel,
          };
        }),
        activities: [
          activity({ kind: 'task', id: next.id }, next.title, text),
          ...current.activities,
        ],
      };
    });
  }

  function saveProject(project: DashboardProject) {
    update((current) => {
      const previous = current.projects.find((item) => item.id === project.id);
      const next =
        previous && previous.name !== project.name
          ? { ...project, favoriteLabel: project.name }
          : project;
      return {
        ...current,
        projects: upsert(current.projects, next),
        activities: [
          activity(
            { kind: 'project', id: project.id },
            project.name,
            previous ? 'updated' : 'created',
          ),
          ...current.activities,
        ],
      };
    });
  }

  function removeProject(id: string) {
    update((current) => {
      const taskIds = new Set(
        current.tasks.filter((task) => task.projectId === id).map((task) => task.id),
      );
      return {
        ...current,
        projects: current.projects.filter((project) => project.id !== id),
        tasks: current.tasks.filter((task) => task.projectId !== id),
        activities: current.activities.filter(
          (item) =>
            !(item.target.kind === 'project' && item.target.id === id) &&
            !(item.target.kind === 'task' && taskIds.has(item.target.id)),
        ),
      };
    });
  }

  function completeProject(id: string) {
    update((current) => {
      const tasks = current.tasks.filter((task) => task.projectId === id);
      const completed = tasks.length > 0 && tasks.every((task) => task.status === 'Completed');
      const project = current.projects.find((item) => item.id === id);
      if (!project || !tasks.length) return current;
      return {
        ...current,
        tasks: current.tasks.map((task) =>
          task.projectId === id
            ? {
                ...task,
                status: completed ? 'On Progress' : 'Completed',
                progress: completed ? 0 : 100,
              }
            : task,
        ),
        activities: [
          activity({ kind: 'project', id }, project.name, completed ? 'reopened' : 'completed'),
          ...current.activities,
        ],
      };
    });
  }

  function saveDocument(document: DashboardDocument) {
    update((current) => ({
      ...current,
      documents: upsert(current.documents, document),
      activities: [
        activity(
          { kind: 'document', id: document.id },
          document.title,
          current.documents.some((item) => item.id === document.id) ? 'updated' : 'created',
        ),
        ...current.activities,
      ],
    }));
  }

  function saveMeeting(meeting: DashboardMeeting) {
    update((current) => ({
      ...current,
      meetings: upsert(current.meetings, meeting),
      activities: [
        activity(
          { kind: 'meeting', id: meeting.id },
          meeting.title,
          current.meetings.some((item) => item.id === meeting.id) ? 'updated' : 'scheduled',
        ),
        ...current.activities,
      ],
    }));
  }

  function removeResource(kind: 'task' | 'document' | 'meeting', id: string) {
    const key = kind === 'task' ? 'tasks' : kind === 'document' ? 'documents' : 'meetings';
    update((current) => ({
      ...current,
      [key]: current[key].filter((item) => item.id !== id),
      activities: current.activities.filter(
        (item) => item.target.kind !== kind || item.target.id !== id,
      ),
    }));
  }

  return {
    state,
    storageError,
    hydrated,
    saveTask,
    createTask: saveTask,
    saveProject,
    createProject: saveProject,
    saveDocument,
    saveMeeting,
    removeProject,
    completeProject,
    removeTask: (id: string) => removeResource('task', id),
    removeDocument: (id: string) => removeResource('document', id),
    removeMeeting: (id: string) => removeResource('meeting', id),
    saveMembers: (memberIds: DashboardPersonId[]) =>
      update((current) => ({ ...current, memberIds })),
    saveMilestones: (milestones: DashboardMilestone[]) =>
      update((current) => ({ ...current, milestones })),
    toggleProjectFavorite: (id: string) =>
      update((current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === id ? { ...project, starred: !project.starred } : project,
        ),
      })),
    saveFavorites: (targets: DashboardTarget[]) =>
      update((current) => {
        const keys = new Set(targets.map((target) => `${target.kind}:${target.id}`));
        return {
          ...current,
          projects: current.projects.map((project) => ({
            ...project,
            starred: keys.has(`project:${project.id}`),
          })),
          tasks: current.tasks.map((task) => ({ ...task, starred: keys.has(`task:${task.id}`) })),
          documents: current.documents.map((document) => ({
            ...document,
            starred: keys.has(`document:${document.id}`),
          })),
        };
      }),
    markRead: (id: string) =>
      update((current) => ({
        ...current,
        activities: current.activities.map((item) =>
          item.id === id ? { ...item, read: true } : item,
        ),
      })),
    markAllRead: () =>
      update((current) => ({
        ...current,
        activities: current.activities.map((item) => ({ ...item, read: true })),
      })),
  };
}
