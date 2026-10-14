import { getLocale, type Locale } from '@/lib/i18n';
import { fixtureField } from '../i18n/display';
import type {
  DashboardFavorite,
  DashboardMilestonePoint,
  DashboardProjectSummary,
  DashboardState,
} from './dashboard-model';

export function selectProjects(state: DashboardState): DashboardProjectSummary[] {
  return state.projects.map((project) => {
    const tasks = state.tasks.filter((task) => task.projectId === project.id);
    const progress = tasks.length
      ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length)
      : 0;
    return {
      project,
      tasks,
      progress,
      status:
        tasks.length && tasks.every((task) => task.status === 'Completed')
          ? 'Completed'
          : tasks.some((task) => task.status === 'On Progress')
            ? 'On Progress'
            : 'To Do',
      people: [...new Set(tasks.flatMap((task) => task.cardPeople))],
      comments: tasks.reduce((sum, task) => sum + task.comments.length, 0),
      links: tasks.reduce(
        (sum, task) => sum + task.comments.filter((comment) => comment.attachment).length,
        0,
      ),
    };
  });
}

export function selectFavorites(
  state: DashboardState,
  locale: Locale = getLocale(),
): DashboardFavorite[] {
  return [
    ...state.projects
      .filter((project) => project.starred)
      .map((project) => ({
        id: `project:${project.id}`,
        label: fixtureField(project, 'favoriteLabel', locale),
        target: { kind: 'project', id: project.id } as const,
      })),
    ...state.tasks
      .filter((task) => task.starred)
      .map((task) => ({
        id: `task:${task.id}`,
        label: fixtureField(task, 'title', locale),
        target: { kind: 'task', id: task.id } as const,
      })),
    ...state.documents
      .filter((document) => document.starred)
      .map((document) => ({
        id: `document:${document.id}`,
        label: fixtureField(document, 'title', locale),
        target: { kind: 'document', id: document.id } as const,
      })),
  ];
}

export function selectStats(state: DashboardState) {
  return {
    projects: state.projects.length,
    tasks: state.tasks.length,
    inProgress: state.tasks.filter((task) => task.status === 'On Progress').length,
    completed: state.tasks.filter((task) => task.status === 'Completed').length,
  };
}

/** Historical completed work is explicitly recorded; current tasks contribute once, by due month. */
export function selectMilestones(state: DashboardState): DashboardMilestonePoint[] {
  const months = new Set([
    ...state.milestones.map((milestone) => milestone.month),
    ...state.tasks.map((task) => task.dueDate.slice(0, 7)),
  ]);
  return [...months].sort().map((month) => {
    const milestone = state.milestones.find((item) => item.month === month);
    return {
      month,
      target: milestone?.target ?? 0,
      actual:
        (milestone?.completed ?? 0) +
        state.tasks.filter((task) => task.status === 'Completed' && task.dueDate.startsWith(month))
          .length,
    };
  });
}
