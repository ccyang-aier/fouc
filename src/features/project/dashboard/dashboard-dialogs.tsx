'use client';
import { useLocale } from '@/lib/i18n';

import { translateFixed } from '../i18n/display';
import { DashboardActionDialog, type DashboardAction } from './dashboard-actions';
import { DashboardDocumentDialog } from './dashboard-document-dialog';
import { DashboardFavoritesDialog, DashboardMilestoneDialog } from './dashboard-management-dialogs';
import { DashboardMeetingDialog } from './dashboard-meeting-dialog';
import type {
  DashboardDocument,
  DashboardDocumentKind,
  DashboardProject,
  DashboardTarget,
} from './dashboard-model';
import { DashboardProjectDialog } from './dashboard-project-dialog';
import { DashboardTaskDialog } from './dashboard-task-dialog';
import type { useDashboard } from './use-dashboard';

export type DashboardDialog =
  | { kind: 'task'; id: string }
  | { kind: 'project'; id: string }
  | { kind: 'document'; id: string | null; documentKind: DashboardDocumentKind }
  | { kind: 'meeting'; id: string | null }
  | { kind: 'action'; action: DashboardAction; projectId?: string }
  | { kind: 'favorites' }
  | { kind: 'milestones' };

export function DashboardDialogs({
  dialog,
  scopeKey,
  store,
  onClose,
  onOpenTarget,
  onOpenProject,
  onCreateTask,
  onDeleteProject,
  onSaveDocument,
  onSaved,
}: {
  dialog: DashboardDialog | null;
  scopeKey: string;
  store: ReturnType<typeof useDashboard>;
  onClose: () => void;
  onOpenTarget: (target: DashboardTarget) => void;
  onOpenProject: (id: string) => void;
  onCreateTask: (projectId: string) => void;
  onDeleteProject: (project: DashboardProject) => void;
  onSaveDocument: (document: DashboardDocument) => void;
  onSaved: (message: string) => void;
}) {
  const locale = useLocale();
  if (!dialog) return null;
  const { state } = store;
  switch (dialog.kind) {
    case 'task': {
      const task = state.tasks.find((item) => item.id === dialog.id);
      return task ? (
        <DashboardTaskDialog
          key={task.id}
          task={task}
          scopeKey={scopeKey}
          projects={state.projects}
          onOpenProject={onOpenProject}
          onClose={onClose}
          onSave={store.saveTask}
        />
      ) : null;
    }
    case 'project': {
      const project = state.projects.find((item) => item.id === dialog.id);
      return project ? (
        <DashboardProjectDialog
          key={project.id}
          project={project}
          tasks={state.tasks.filter((task) => task.projectId === project.id)}
          onClose={onClose}
          onSave={(next) => {
            store.saveProject(next);
            onSaved(translateFixed('Project saved', locale));
          }}
          onOpenTask={(id) => onOpenTarget({ kind: 'task', id })}
          onCreateTask={() => onCreateTask(project.id)}
          onDelete={onDeleteProject}
        />
      ) : null;
    }
    case 'document': {
      const document = state.documents.find((item) => item.id === dialog.id);
      return (
        <DashboardDocumentDialog
          key={dialog.id ?? `new-${dialog.documentKind}`}
          kind={dialog.documentKind}
          scopeKey={scopeKey}
          document={document}
          onClose={onClose}
          onSave={onSaveDocument}
          onDelete={(id) => {
            store.removeDocument(id);
            onClose();
          }}
        />
      );
    }
    case 'meeting': {
      const meeting = state.meetings.find((item) => item.id === dialog.id);
      return (
        <DashboardMeetingDialog
          key={dialog.id ?? 'new-meeting'}
          meeting={meeting}
          scopeKey={scopeKey}
          memberIds={state.memberIds}
          onClose={onClose}
          onSave={store.saveMeeting}
          onDelete={(id) => {
            store.removeMeeting(id);
            onClose();
          }}
        />
      );
    }
    case 'action':
      return (
        <DashboardActionDialog
          key={`${dialog.action}:${dialog.projectId ?? ''}`}
          action={dialog.action}
          state={state}
          initialProjectId={dialog.projectId}
          onClose={onClose}
          onCreateTask={store.createTask}
          onCreateProject={store.createProject}
          onInvite={store.saveMembers}
          onRead={store.markRead}
          onReadAll={store.markAllRead}
          onOpenTarget={onOpenTarget}
        />
      );
    case 'favorites':
      return (
        <DashboardFavoritesDialog
          state={state}
          onClose={onClose}
          onSave={(targets) => {
            store.saveFavorites(targets);
            onSaved(translateFixed('Favourites saved', locale));
          }}
        />
      );
    case 'milestones':
      return (
        <DashboardMilestoneDialog
          milestones={state.milestones}
          onClose={onClose}
          onSave={(milestones) => {
            store.saveMilestones(milestones);
            onSaved(translateFixed('Milestones saved', locale));
          }}
        />
      );
  }
}
