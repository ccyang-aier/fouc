'use client';

import { AppAlert } from '@/components/app-alert';
import { useTranslation } from '@/lib/i18n';
import { ActivityMap, MilestoneTracker } from './dashboard-charts';
import type { DashboardActivity, DashboardDocumentKind, DashboardProject, DashboardState, DashboardTarget } from './dashboard-model';
import { DashboardOverview } from './dashboard-overview';
import { ActivityPanel, MeetingsPanel, TeamPanel, TodayProjects } from './dashboard-panels';
import { selectMilestones, selectProjects } from './dashboard-selectors';
import type { ProjectDashboardDestination } from './project-dashboard';
import { messages } from './i18n/dashboard-content';
import styles from './dashboard.module.css';

export interface DashboardContentActions {
  openTarget: (target: DashboardTarget) => void;
  openProject: (id: string) => void;
  createProject: () => void;
  deleteProject: (project: DashboardProject) => void;
  toggleProjectFavorite: (id: string) => void;
  completeProject: (id: string) => void;
  invite: () => void;
  createMeeting: () => void;
  createDocument: (kind: DashboardDocumentKind) => void;
  editMilestones: () => void;
  exportActivity: () => void;
  openActivity: (activity: DashboardActivity) => void;
  navigate: (view: ProjectDashboardDestination) => void;
}

export function DashboardContent({ state, storageError, actions }: {
  state: DashboardState;
  storageError: boolean;
  actions: DashboardContentActions;
}) {
  const { t } = useTranslation(messages);
  const projects = selectProjects(state).filter((summary) => summary.project.featured);

  return (
    <>
      {storageError ? (
        <AppAlert tone="warning" title={t('Changes can’t be saved on this device')} description={t('Browser storage is full or unavailable. Remove attached files or allow storage, then save again.')} />
      ) : null}
      <DashboardOverview state={state} onCreateDocument={actions.createDocument} onNavigate={actions.navigate} />
      <div className={styles.mainGrid}>
        <div className={styles.leftColumn}>
          <ActivityMap tasks={state.tasks} meetings={state.meetings} onOpenTarget={actions.openTarget} />
          <TodayProjects
            projects={projects}
            onOpen={actions.openProject}
            onToggleFavorite={actions.toggleProjectFavorite}
            onComplete={actions.completeProject}
            onDelete={actions.deleteProject}
            onCreate={actions.createProject}
            onExpand={() => actions.navigate('tasks')}
          />
        </div>
        <div className={styles.rightColumn}>
          <TeamPanel memberIds={state.memberIds} onInvite={actions.invite} onViewAll={() => actions.navigate('members')} />
          <MeetingsPanel meetings={state.meetings} onOpen={(id) => actions.openTarget({ kind: 'meeting', id })} onCreate={actions.createMeeting} />
        </div>
      </div>
      <div className={styles.analyticsGrid}>
        <MilestoneTracker points={selectMilestones(state)} onEdit={actions.editMilestones} />
        <ActivityPanel activities={state.activities} onOpen={actions.openActivity} onExport={actions.exportActivity} />
      </div>
    </>
  );
}
