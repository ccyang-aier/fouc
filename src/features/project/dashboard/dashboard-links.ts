import type { DashboardTarget } from './dashboard-model';

const targetParameters = {
  task: 'dashboardTask',
  project: 'dashboardProject',
  document: 'dashboardDocument',
  meeting: 'dashboardMeeting',
} as const;

export function dashboardLink(currentUrl: string, scope: string, target?: DashboardTarget) {
  const url = new URL(currentUrl);
  url.searchParams.set('view', 'projects');
  url.searchParams.set('dashboardScope', scope);
  for (const parameter of Object.values(targetParameters)) url.searchParams.delete(parameter);
  if (target) url.searchParams.set(targetParameters[target.kind], target.id);
  return url.toString();
}

export function readDashboardLink(currentUrl: string, scope: string) {
  const parameters = new URL(currentUrl).searchParams;
  const entries = Object.entries(targetParameters) as [DashboardTarget['kind'], string][];
  const match = entries.find(([, parameter]) => parameters.has(parameter));
  const linkScope = parameters.get('dashboardScope');
  const wrongProject = Boolean((linkScope || match) && linkScope !== scope);
  const target: DashboardTarget | null =
    !wrongProject && match ? { kind: match[0], id: parameters.get(match[1])! } : null;
  return { wrongProject, target };
}
