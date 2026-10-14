'use client';

import { useTranslation } from '@/lib/i18n';
import { fixtureField, translateFixed } from '../i18n/display';
import { messages } from './i18n/dashboard-content';

import { AppAlert } from '@/components/app-alert';
import { ActivityMap, MilestoneTracker } from './dashboard-charts';
import { DashboardDocuments } from './dashboard-documents';
import type {
  DashboardActivity,
  DashboardDocument,
  DashboardDocumentKind,
  DashboardProject,
  DashboardState,
  DashboardStatus,
  DashboardTarget,
  DashboardTask,
} from './dashboard-model';
import { DashboardOverview } from './dashboard-overview';
import { ActivityPanel, MeetingsPanel, TeamPanel, TodayProjects } from './dashboard-panels';
import { selectMilestones, selectProjects, selectStats } from './dashboard-selectors';
import type { DashboardSection } from './dashboard-sidebar';
import { DashboardTaskList } from './dashboard-task-list';
import { DashboardButton, SegmentedControl } from './dashboard-ui';
import styles from './dashboard.module.css';

export type DashboardPortfolioTab = 'Projects' | 'Documents' | 'Favourites';
export interface DashboardContentActions {
  openTarget: (target: DashboardTarget) => void;
  openProject: (id: string) => void;
  createProject: () => void;
  deleteProject: (project: DashboardProject) => void;
  toggleProjectFavorite: (id: string) => void;
  completeProject: (id: string) => void;
  saveTask: (task: DashboardTask) => void;
  deleteTask: (task: DashboardTask) => void;
  createTask: () => void;
  invite: () => void;
  createMeeting: () => void;
  openDocument: (document: DashboardDocument) => void;
  createDocument: (kind: DashboardDocumentKind) => void;
  saveDocument: (document: DashboardDocument) => void;
  deleteDocument: (document: DashboardDocument) => void;
  editMilestones: () => void;
  exportActivity: () => void;
  openActivity: (activity: DashboardActivity) => void;
  readAll: () => void;
  changeSection: (section: DashboardSection, status?: DashboardStatus) => void;
  manageFavorites: () => void;
}

export function DashboardContent({
  state,
  section,
  query,
  status,
  onStatusChange,
  portfolioTab,
  onPortfolioTabChange,
  documentKind,
  onDocumentKindChange,
  storageError,
  actions,
}: {
  state: DashboardState;
  section: DashboardSection;
  query: string;
  status: DashboardStatus | 'All';
  onStatusChange: (status: DashboardStatus | 'All') => void;
  portfolioTab: DashboardPortfolioTab;
  onPortfolioTabChange: (tab: DashboardPortfolioTab) => void;
  documentKind: DashboardDocumentKind;
  onDocumentKindChange: (kind: DashboardDocumentKind) => void;
  storageError: boolean;
  actions: DashboardContentActions;
}) {
  const { t, locale } = useTranslation(messages);

  const search = query.trim().toLowerCase();
  const matches = (value: string) => !search || value.toLowerCase().includes(search);
  const tasks = state.tasks.filter(
    (task) =>
      matches(
        `${fixtureField(task, 'title', locale)} ${fixtureField(task, 'description', locale)} ${task.title} ${task.detailTitle} ${task.description} ${task.tag} ${task.priority}`,
      ) &&
      (status === 'All' || task.status === status),
  );
  const projects = selectProjects(state).filter(
    (summary) =>
      matches(
        `${fixtureField(summary.project, 'name', locale)} ${fixtureField(summary.project, 'description', locale)} ${summary.project.name} ${summary.project.description} ${summary.project.priority} ${summary.tasks.map((task) => `${task.title} ${task.detailTitle} ${task.tag}`).join(' ')}`,
      ) &&
      (status === 'All' || summary.status === status),
  );
  const documents = state.documents.filter((document) =>
    matches(
      `${fixtureField(document, 'title', locale)} ${document.title} ${document.kind} ${document.kind === 'form' ? document.description : document.client}`,
    ),
  );
  const projectProps = {
    projects,
    onOpen: actions.openProject,
    onToggleFavorite: actions.toggleProjectFavorite,
    onComplete: actions.completeProject,
    onDelete: actions.deleteProject,
    onCreate: actions.createProject,
    onExpand: () => actions.changeSection(section === 'Dashboard' ? 'Portfolio' : 'Dashboard'),
    expanded: section !== 'Dashboard',
  };
  const taskProps = {
    tasks,
    projects: state.projects,
    onOpen: (id: string) => actions.openTarget({ kind: 'task', id }),
    onCreate: actions.createTask,
    onSave: actions.saveTask,
    onDelete: actions.deleteTask,
  };
  const activityProps = {
    activities: state.activities.filter((activity) =>
      matches(
        `${fixtureField(activity, 'subject', locale)} ${fixtureField(activity, 'text', locale)} ${activity.actor} ${activity.subject} ${activity.text}`,
      ),
    ),
    onOpen: actions.openActivity,
    onExport: actions.exportActivity,
  };
  const chartProps = {
    tasks: state.tasks,
    meetings: state.meetings,
    onOpenTarget: actions.openTarget,
  };
  const milestoneProps = { points: selectMilestones(state), onEdit: actions.editMilestones };
  const totals = selectStats(state);

  return (
    <>
      {storageError ? (
        <AppAlert
          tone="warning"
          title={t('Changes can’t be saved on this device')}
          description={t(
            'Browser storage is full or unavailable. Remove attached files or allow storage, then save again.',
          )}
        />
      ) : null}
      {section === 'Dashboard' ? (
        <>
          <DashboardOverview
            state={state}
            onCreateDocument={actions.createDocument}
            onViewStat={actions.changeSection}
          />
          <div className={styles.mainGrid}>
            <div className={styles.leftColumn}>
              <ActivityMap {...chartProps} />
              <TodayProjects
                {...projectProps}
                projects={projects.filter((summary) => search || summary.project.featured)}
              />
            </div>
            <div className={styles.rightColumn}>
              <TeamPanel memberIds={state.memberIds} onInvite={actions.invite} />
              <MeetingsPanel
                meetings={state.meetings}
                onOpen={(id) => actions.openTarget({ kind: 'meeting', id })}
                onCreate={actions.createMeeting}
              />
            </div>
          </div>
          <div className={styles.analyticsGrid}>
            <MilestoneTracker {...milestoneProps} />
            <ActivityPanel {...activityProps} />
          </div>
        </>
      ) : null}
      {section === 'My Task' ? (
        <>
          <TaskFilters
            status={status}
            onChange={onStatusChange}
            count={tasks.length}
            unit="Tasks"
          />
          <DashboardTaskList {...taskProps} />
        </>
      ) : null}
      {section === 'Portfolio' ? (
        <>
          <div className={styles.filterBar}>
            <SegmentedControl
              items={['Projects', 'Documents', 'Favourites'] as const}
              value={portfolioTab}
              onChange={onPortfolioTabChange}
              label={t('Portfolio contents')}
            />
            {portfolioTab === 'Favourites' ? (
              <DashboardButton tone="neutral" onClick={actions.manageFavorites}>
                {t('Manage favourites')}
              </DashboardButton>
            ) : null}
          </div>
          {portfolioTab === 'Projects' ? (
            <>
              <TaskFilters
                status={status}
                onChange={onStatusChange}
                count={projects.length}
                unit="Projects"
              />
              <TodayProjects {...projectProps} />
            </>
          ) : null}
          {portfolioTab === 'Documents' ? (
            <DashboardDocuments
              documents={documents}
              kind={documentKind}
              onKindChange={onDocumentKindChange}
              onOpen={actions.openDocument}
              onCreate={actions.createDocument}
              onSave={actions.saveDocument}
              onDelete={actions.deleteDocument}
            />
          ) : null}
          {portfolioTab === 'Favourites' ? (
            <div className={styles.favoritePortfolio}>
              <TodayProjects
                {...projectProps}
                projects={projects.filter((summary) => summary.project.starred)}
              />
              <DashboardTaskList {...taskProps} tasks={tasks.filter((task) => task.starred)} />
              <DashboardDocuments
                documents={documents.filter((document) => document.starred)}
                kind={documentKind}
                onKindChange={onDocumentKindChange}
                onOpen={actions.openDocument}
                onCreate={actions.createDocument}
                onSave={actions.saveDocument}
                onDelete={actions.deleteDocument}
              />
            </div>
          ) : null}
        </>
      ) : null}
      {section === 'Reporting' ? (
        <>
          <ActivityMap {...chartProps} />
          <div className={styles.analyticsGrid}>
            <MilestoneTracker {...milestoneProps} />
            <ActivityPanel {...activityProps} />
          </div>
        </>
      ) : null}
      {section === 'Accounts' ? (
        <TeamPanel expanded memberIds={state.memberIds} onInvite={actions.invite} />
      ) : null}
      {section === 'Inbox' ? (
        <ActivityPanel {...activityProps} inbox onReadAll={actions.readAll} />
      ) : null}
      {section === 'Goals' ? (
        <>
          <div className={styles.goalSummary}>
            <h2>
              {totals.completed} {t('of')} {totals.tasks} {t('tasks completed')}
            </h2>
            <div
              className={styles.goalProgress}
              role="progressbar"
              aria-label={t('Overall task completion')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={totals.tasks ? Math.round((totals.completed / totals.tasks) * 100) : 0}
            >
              <span
                style={{ width: `${totals.tasks ? (totals.completed / totals.tasks) * 100 : 0}%` }}
              />
            </div>
          </div>
          <MilestoneTracker {...milestoneProps} />
          <TaskFilters
            status={status}
            onChange={onStatusChange}
            count={tasks.length}
            unit="tasks"
          />
          <DashboardTaskList {...taskProps} />
        </>
      ) : null}
    </>
  );
}

function TaskFilters({
  status,
  onChange,
  count,
  unit,
}: {
  status: DashboardStatus | 'All';
  onChange: (value: DashboardStatus | 'All') => void;
  count: number;
  unit: string;
}) {
  const { t, locale } = useTranslation(messages);

  return (
    <div className={styles.filterBar}>
      <SegmentedControl
        items={['All', 'To Do', 'On Progress', 'Completed'] as const}
        value={status}
        onChange={onChange}
        label={t('Filter {v0} by status', { v0: translateFixed(unit, locale) })}
      />
      <span>
        {count} {translateFixed(unit, locale)}
      </span>
    </div>
  );
}
