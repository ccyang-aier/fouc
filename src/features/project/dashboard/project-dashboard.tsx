'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppAlert } from '@/components/app-alert-provider';
import { useTranslation } from '@/lib/i18n';
import { fixtureField, translateFixed } from '../i18n/display';
import { DashboardDeleteDialog } from './dashboard-actions';
import { DashboardContent, type DashboardContentActions } from './dashboard-content';
import { DashboardDialogs, type DashboardDialog } from './dashboard-dialogs';
import { csvCell, downloadFile } from './dashboard-download';
import { readDashboardLink } from './dashboard-links';
import type { DashboardActivity, DashboardDocument, DashboardProject, DashboardTarget } from './dashboard-model';
import { messages } from './i18n/project-dashboard';
import styles from './dashboard.module.css';
import { useDashboard } from './use-dashboard';

export type ProjectDashboardDestination = 'tasks' | 'members' | 'assets';

interface ProjectDashboardProps {
  projectName: string;
  scopeKey: string;
  onNavigate: (view: ProjectDashboardDestination) => void;
}

/** Remount local interaction state when the principal or selected project changes. */
export function ProjectDashboard(props: ProjectDashboardProps) {
  return <ProjectDashboardCanvas key={props.scopeKey} {...props} />;
}

function ProjectDashboardCanvas({ projectName, scopeKey, onNavigate }: ProjectDashboardProps) {
  const { t, locale } = useTranslation(messages);
  const store = useDashboard(scopeKey);
  const { state, storageError } = store;
  const { notify } = useAppAlert();
  const [dialog, setDialog] = useState<DashboardDialog | null>(null);
  const [deletion, setDeletion] = useState<DashboardProject | null>(null);
  const restoredLink = useRef(false);

  function openProject(id: string) {
    const tasks = state.tasks.filter((task) => task.projectId === id);
    setDialog(tasks.length === 1 ? { kind: 'task', id: tasks[0].id } : { kind: 'project', id });
  }

  function openTarget(target: DashboardTarget) {
    if (target.kind === 'project' && state.projects.some((item) => item.id === target.id)) {
      openProject(target.id);
      return;
    }
    if (target.kind === 'task' && state.tasks.some((item) => item.id === target.id)) {
      setDialog({ kind: 'task', id: target.id });
      return;
    }
    if (target.kind === 'meeting' && state.meetings.some((item) => item.id === target.id)) {
      setDialog({ kind: 'meeting', id: target.id });
      return;
    }
    if (target.kind === 'document') {
      const document = state.documents.find((item) => item.id === target.id);
      if (document) {
        setDialog({ kind: 'document', id: document.id, documentKind: document.kind });
        return;
      }
    }
    notify('warning', t('This item is no longer available in this dashboard'));
  }

  useEffect(() => {
    if (!store.hydrated || restoredLink.current) return;
    restoredLink.current = true;
    const { wrongProject, target } = readDashboardLink(window.location.href, scopeKey);
    if (wrongProject) {
      notify('warning', t('Open the Fouc project this link belongs to.'));
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
    else notify('warning', t('This item is no longer available in this dashboard'));
  }, [store.hydrated, t, scopeKey, state.tasks, state.documents, state.meetings, state.projects, notify]);

  function closeDialog() {
    setDialog(null);
    const url = new URL(window.location.href);
    for (const key of ['dashboardTask', 'dashboardProject', 'dashboardDocument', 'dashboardMeeting', 'dashboardScope'])
      url.searchParams.delete(key);
    window.history.replaceState(null, '', url);
  }

  function exportActivity() {
    const rows = state.activities.map((item) => [
      fixtureField(item, 'actor', locale),
      fixtureField(item, 'text', locale),
      fixtureField(item, 'subject', locale),
      fixtureField(item, 'time', locale),
      translateFixed(item.read ? 'Read' : 'Unread', locale),
    ].map(csvCell).join(','));
    downloadFile('project-activity.csv', [
      ['Actor', 'Action', 'Subject', 'Time', 'Status'].map((key) => translateFixed(key, locale)).map(csvCell).join(','),
      ...rows,
    ].join('\r\n'), 'text/csv;charset=utf-8');
    notify('success', t('Activity exported'));
  }

  function openActivity(activity: DashboardActivity) {
    store.markRead(activity.id);
    openTarget(activity.target);
  }

  function saveDocument(document: DashboardDocument) {
    store.saveDocument(document);
    setDialog((current) => current?.kind === 'document' ? { ...current, id: document.id } : current);
  }

  const actions: DashboardContentActions = {
    openTarget,
    openProject,
    createProject: () => setDialog({ kind: 'action', action: 'New Project' }),
    deleteProject: setDeletion,
    toggleProjectFavorite: store.toggleProjectFavorite,
    completeProject: store.completeProject,
    invite: () => setDialog({ kind: 'action', action: 'Invite' }),
    createMeeting: () => setDialog({ kind: 'meeting', id: null }),
    createDocument: (kind) => setDialog({ kind: 'document', id: null, documentKind: kind }),
    editMilestones: () => setDialog({ kind: 'milestones' }),
    exportActivity,
    openActivity,
    navigate: onNavigate,
  };

  return (
    <section className={styles.dashboard} aria-label={t('{v0} project dashboard', { v0: projectName })} lang={locale}>
      <div className={styles.content}>
        <DashboardContent state={state} storageError={storageError} actions={actions} />
      </div>
      <DashboardDialogs
        dialog={dialog}
        scopeKey={scopeKey}
        store={store}
        onClose={closeDialog}
        onOpenTarget={openTarget}
        onOpenProject={(id) => setDialog({ kind: 'project', id })}
        onCreateTask={(id) => setDialog({ kind: 'action', action: 'Create Task', projectId: id })}
        onDeleteProject={setDeletion}
        onSaveDocument={saveDocument}
        onSaved={(message) => notify('success', message)}
      />
      {deletion ? (
        <DashboardDeleteDialog
          title={t('Delete {kind}?', { kind: translateFixed('Project', locale) })}
          description={t('“{name}” and all its tasks and comments will be removed.', { name: fixtureField(deletion, 'name', locale) })}
          onClose={() => setDeletion(null)}
          onDelete={() => {
            store.removeProject(deletion.id);
            setDeletion(null);
            closeDialog();
            notify('success', t('{kind} deleted', { kind: translateFixed('Project', locale) }));
          }}
        />
      ) : null}
    </section>
  );
}
