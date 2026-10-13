'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAppAlert } from '@/components/app-alert-provider';
import { DashboardDeleteDialog } from './dashboard-actions';
import { DashboardSidebar, type DashboardSection } from './dashboard-sidebar';
import { DashboardToolbar, type DashboardSearchResult } from './dashboard-toolbar';
import {
  DashboardContent,
  type DashboardContentActions,
  type DashboardPortfolioTab,
} from './dashboard-content';
import { DashboardDialogs, type DashboardDialog } from './dashboard-dialogs';
import { selectFavorites } from './dashboard-selectors';
import { downloadFile, csvCell } from './dashboard-download';
import { useDashboard } from './use-dashboard';
import { dashboardLink, readDashboardLink } from './dashboard-links';
import type {
  DashboardActivity,
  DashboardDocument,
  DashboardDocumentKind,
  DashboardStatus,
  DashboardTarget,
} from './dashboard-model';
import styles from './dashboard.module.css';

function subscribeCompactNavigation(listener: () => void) {
  const query = window.matchMedia('(max-width: 1060px)');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
const compactNavigation = () => window.matchMedia('(max-width: 1060px)').matches;

interface ProjectDashboardProps {
  projectId: string;
  projectName: string;
  source: 'local' | 'server';
  onBack: () => void;
}
interface Deletion {
  target: DashboardTarget;
  title: string;
  description: string;
}

export function ProjectDashboard({
  projectId,
  projectName,
  source,
  onBack,
}: ProjectDashboardProps) {
  const scopeKey = `${source}:${projectId}`;
  const store = useDashboard(scopeKey);
  const { state, storageError } = store;
  const { notify } = useAppAlert();
  const [section, setSection] = useState<DashboardSection>('Dashboard');
  const autoCollapsed = useSyncExternalStore(
    subscribeCompactNavigation,
    compactNavigation,
    () => false,
  );
  const [collapsedPreference, setCollapsedPreference] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<DashboardStatus | 'All'>('All');
  const [portfolioTab, setPortfolioTab] = useState<DashboardPortfolioTab>('Projects');
  const [documentKind, setDocumentKind] = useState<DashboardDocumentKind>('invoice');
  const [dialog, setDialog] = useState<DashboardDialog | null>(null);
  const [deletion, setDeletion] = useState<Deletion | null>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const restoredLink = useRef(false);
  const unreadCount = state.activities.filter((activity) => !activity.read).length;
  const favorites = selectFavorites(state);

  function changeSection(next: DashboardSection, nextStatus?: DashboardStatus) {
    setSection(next);
    setQuery('');
    setStatus(nextStatus ?? 'All');
    setPortfolioTab('Projects');
    scrollArea.current?.scrollTo({ top: 0 });
  }

  function openProject(id: string) {
    const projectTasks = state.tasks.filter((task) => task.projectId === id);
    // The reference's single-task cards open the original task modal directly.
    setDialog(
      projectTasks.length === 1
        ? { kind: 'task', id: projectTasks[0].id }
        : { kind: 'project', id },
    );
  }

  function openTarget(target: DashboardTarget) {
    switch (target.kind) {
      case 'project':
        if (state.projects.some((item) => item.id === target.id)) openProject(target.id);
        else notify('warning', 'This project is no longer available');
        break;
      case 'task':
        if (state.tasks.some((item) => item.id === target.id))
          setDialog({ kind: 'task', id: target.id });
        else notify('warning', 'This task is no longer available');
        break;
      case 'document': {
        const document = state.documents.find((item) => item.id === target.id);
        if (document) setDialog({ kind: 'document', id: document.id, documentKind: document.kind });
        else notify('warning', 'This document is no longer available');
        break;
      }
      case 'meeting':
        if (state.meetings.some((item) => item.id === target.id))
          setDialog({ kind: 'meeting', id: target.id });
        else notify('warning', 'This meeting is no longer available');
        break;
    }
  }

  useEffect(() => {
    if (!store.hydrated || restoredLink.current) return;
    restoredLink.current = true;
    const { wrongProject, target } = readDashboardLink(window.location.href, scopeKey);
    if (wrongProject) {
      notify('warning', 'Open the Fouc project this link belongs to.');
      return;
    }
    if (!target) return;
    let next: DashboardDialog | null = null;
    if (target.kind === 'task' && state.tasks.some((item) => item.id === target.id))
      next = { kind: 'task', id: target.id };
    if (target.kind === 'document') {
      const document = state.documents.find((item) => item.id === target.id);
      if (document) next = { kind: 'document', id: target.id, documentKind: document.kind };
    }
    if (target.kind === 'meeting' && state.meetings.some((item) => item.id === target.id))
      next = { kind: 'meeting', id: target.id };
    if (target.kind === 'project' && state.projects.some((item) => item.id === target.id))
      next = { kind: 'project', id: target.id };
    if (next) queueMicrotask(() => setDialog(next));
    else notify('warning', 'This item is no longer available in this dashboard');
  }, [
    store.hydrated,
    scopeKey,
    state.tasks,
    state.documents,
    state.meetings,
    state.projects,
    notify,
  ]);

  function closeDialog() {
    setDialog(null);
    const url = new URL(window.location.href);
    for (const key of [
      'dashboardTask',
      'dashboardProject',
      'dashboardDocument',
      'dashboardMeeting',
      'dashboardScope',
    ])
      url.searchParams.delete(key);
    window.history.replaceState(null, '', url);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(dashboardLink(window.location.href, scopeKey));
      notify('success', 'Dashboard link copied');
    } catch {
      notify('error', 'Could not copy the link');
    }
  }

  function exportActivity() {
    const rows = state.activities.map((item) =>
      [item.actor, item.text, item.subject, item.time, item.read ? 'Read' : 'Unread']
        .map(csvCell)
        .join(','),
    );
    downloadFile(
      'project-activity.csv',
      ['Actor,Action,Subject,Time,Status', ...rows].join('\r\n'),
      'text/csv;charset=utf-8',
    );
    notify('success', 'Activity exported');
  }

  function openActivity(activity: DashboardActivity) {
    store.markRead(activity.id);
    openTarget(activity.target);
  }

  function saveDocument(document: DashboardDocument) {
    const creating = !state.documents.some((item) => item.id === document.id);
    store.saveDocument(document);
    if (creating) {
      setDialog((current) =>
        current?.kind === 'document' ? { ...current, id: document.id } : current,
      );
      setSection('Portfolio');
      setPortfolioTab('Documents');
      setDocumentKind(document.kind);
      setQuery('');
    }
  }

  function deleteResource() {
    if (!deletion) return;
    const { target } = deletion;
    if (target.kind === 'project') store.removeProject(target.id);
    if (target.kind === 'task') store.removeTask(target.id);
    if (target.kind === 'document') store.removeDocument(target.id);
    if (target.kind === 'meeting') store.removeMeeting(target.id);
    setDeletion(null);
    closeDialog();
    notify('success', `${target.kind[0].toUpperCase()}${target.kind.slice(1)} deleted`);
  }

  const searchResults: DashboardSearchResult[] = [
    ...state.projects.map((project) => ({
      id: `project:${project.id}`,
      title: project.name,
      detail: 'Project',
      keywords: `${project.name} ${project.description} ${project.priority}`,
      target: { kind: 'project', id: project.id } as const,
    })),
    ...state.tasks.map((task) => ({
      id: `task:${task.id}`,
      title: task.title,
      detail: `Task · ${task.status}`,
      keywords: `${task.title} ${task.detailTitle} ${task.description} ${task.tag} ${task.priority}`,
      target: { kind: 'task', id: task.id } as const,
    })),
    ...state.documents.map((document) => ({
      id: `document:${document.id}`,
      title: document.title,
      detail: `${document.kind} · ${document.status}`,
      keywords: `${document.title} ${document.kind} ${document.kind === 'form' ? document.description : document.client}`,
      target: { kind: 'document', id: document.id } as const,
    })),
    ...state.meetings.map((meeting) => ({
      id: `meeting:${meeting.id}`,
      title: meeting.title,
      detail: 'Meeting',
      keywords: `${meeting.title} ${meeting.agenda}`,
      target: { kind: 'meeting', id: meeting.id } as const,
    })),
  ].filter((result) => result.keywords.toLowerCase().includes(query.trim().toLowerCase()));

  const actions: DashboardContentActions = {
    openTarget,
    openProject,
    changeSection,
    exportActivity,
    openActivity,
    createProject: () => setDialog({ kind: 'action', action: 'New Project' }),
    deleteProject: (project) =>
      setDeletion({
        target: { kind: 'project', id: project.id },
        title: 'Delete project?',
        description: `“${project.name}” and all its tasks and comments will be removed.`,
      }),
    toggleProjectFavorite: store.toggleProjectFavorite,
    completeProject: store.completeProject,
    saveTask: store.saveTask,
    deleteTask: (task) =>
      setDeletion({
        target: { kind: 'task', id: task.id },
        title: 'Delete task?',
        description: `“${task.title}” and its comments will be removed from this project.`,
      }),
    createTask: () => setDialog({ kind: 'action', action: 'Create Task' }),
    invite: () => setDialog({ kind: 'action', action: 'Invite' }),
    createMeeting: () => setDialog({ kind: 'meeting', id: null }),
    openDocument: (document) => openTarget({ kind: 'document', id: document.id }),
    createDocument: (kind) => setDialog({ kind: 'document', id: null, documentKind: kind }),
    saveDocument,
    deleteDocument: (document) =>
      setDeletion({
        target: { kind: 'document', id: document.id },
        title: `Delete ${document.kind}?`,
        description: `“${document.title}” will be permanently removed from this dashboard.`,
      }),
    editMilestones: () => setDialog({ kind: 'milestones' }),
    readAll: () => {
      store.markAllRead();
      notify('success', 'All updates marked as read');
    },
    manageFavorites: () => setDialog({ kind: 'favorites' }),
  };

  return (
    <section className={styles.dashboard} aria-label={`${projectName} project dashboard`} lang="en">
      <DashboardSidebar
        section={section}
        onSectionChange={changeSection}
        collapsed={collapsedPreference ?? autoCollapsed}
        onCollapse={() => setCollapsedPreference(!(collapsedPreference ?? autoCollapsed))}
        favorites={favorites}
        unreadCount={unreadCount}
        onCreate={actions.createTask}
        onFavorite={openTarget}
        onAddFavorite={actions.manageFavorites}
        onViewFavorites={() => {
          changeSection('Portfolio');
          setPortfolioTab('Favourites');
        }}
        onHelp={() => setDialog({ kind: 'action', action: 'Help Center' })}
        projectName={projectName}
        onBack={onBack}
      />
      <div className={styles.workbench}>
        <DashboardToolbar
          section={section}
          query={query}
          onQueryChange={setQuery}
          results={searchResults}
          onOpen={openTarget}
          memberIds={state.memberIds}
          unreadCount={unreadCount}
          updatedAt={state.updatedAt}
          onBack={onBack}
          onShare={() => void copyLink()}
          onNotify={() => setDialog({ kind: 'action', action: 'Notifications' })}
          onInvite={actions.invite}
          onViewProjects={() => changeSection('Portfolio')}
        />
        <div ref={scrollArea} className={styles.content}>
          <DashboardContent
            state={state}
            section={section}
            query={query}
            status={status}
            onStatusChange={setStatus}
            portfolioTab={portfolioTab}
            onPortfolioTabChange={setPortfolioTab}
            documentKind={documentKind}
            onDocumentKindChange={setDocumentKind}
            storageError={storageError}
            actions={actions}
          />
        </div>
      </div>
      <DashboardDialogs
        dialog={dialog}
        scopeKey={scopeKey}
        store={store}
        onClose={closeDialog}
        onOpenTarget={openTarget}
        onOpenProject={(id) => setDialog({ kind: 'project', id })}
        onCreateTask={(id) => setDialog({ kind: 'action', action: 'Create Task', projectId: id })}
        onDeleteProject={actions.deleteProject}
        onSaveDocument={saveDocument}
        onSaved={(message) => notify('success', message)}
      />
      {deletion ? (
        <DashboardDeleteDialog
          title={deletion.title}
          description={deletion.description}
          onClose={() => setDeletion(null)}
          onDelete={deleteResource}
        />
      ) : null}
    </section>
  );
}
