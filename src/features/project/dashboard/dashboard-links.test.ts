import { expect, test } from 'bun:test';
import { dashboardLink, readDashboardLink } from './dashboard-links';

test('a task link restores only within its principal, project and source, even when IDs repeat', () => {
  const link = dashboardLink('http://localhost:3000/?view=workbench', 'user:alice:local:A', {
    kind: 'task',
    id: 'brand',
  });
  expect(new URL(link).searchParams.get('view')).toBe('workbench');
  expect(readDashboardLink(link, 'user:alice:local:A')).toEqual({
    wrongProject: false,
    target: { kind: 'task', id: 'brand' },
  });
  expect(readDashboardLink(link, 'user:alice:local:B')).toEqual({ wrongProject: true, target: null });
  expect(readDashboardLink(link, 'user:alice:server:A')).toEqual({ wrongProject: true, target: null });
  expect(readDashboardLink(link, 'user:bob:local:A')).toEqual({ wrongProject: true, target: null });
});

test('copying another object or the dashboard removes stale object selectors', () => {
  const original = dashboardLink('http://localhost:3000/?view=workbench', 'server:A', {
    kind: 'task',
    id: 'brand',
  });
  const document = dashboardLink(original, 'server:A', { kind: 'document', id: 'proposal-a' });
  expect(new URL(document).searchParams.has('dashboardTask')).toBe(false);
  expect(readDashboardLink(document, 'server:A').target).toEqual({
    kind: 'document',
    id: 'proposal-a',
  });
  const dashboard = dashboardLink(document, 'server:A');
  expect(readDashboardLink(dashboard, 'server:A')).toEqual({ wrongProject: false, target: null });
  expect(readDashboardLink(dashboard, 'local:A').wrongProject).toBe(true);
});

test('unscoped object URLs never open a same-named object in the current project', () => {
  expect(
    readDashboardLink('http://localhost:3000/?view=workbench&dashboardTask=brand', 'local:A'),
  ).toEqual({ wrongProject: true, target: null });
  expect(readDashboardLink('http://localhost:3000/?view=workbench', 'local:A')).toEqual({
    wrongProject: false,
    target: null,
  });
});
