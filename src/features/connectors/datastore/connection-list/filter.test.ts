import { describe, expect, test } from 'bun:test';
import { filterConnections, unassignedProject } from './filter';
import type { ConnectionListRow } from './types';

const rows: ConnectionListRow[] = [
  {
    id: 'dev',
    name: '开发库',
    target: 'dev.sqlite',
    targetTitle: '/dev.sqlite',
    projectIds: ['alpha'],
    tags: ['开发'],
    favorite: true,
    status: 'passed',
  },
  {
    id: 'cache',
    name: '缓存',
    target: 'redis:6379',
    targetTitle: 'redis:6379',
    projectIds: ['beta'],
    tags: ['缓存'],
    favorite: false,
    status: 'untested',
  },
  {
    id: 'shared',
    name: '共享库',
    target: 'shared.sqlite',
    targetTitle: '/shared.sqlite',
    projectIds: ['alpha', 'beta'],
    tags: ['开发', '测试'],
    favorite: false,
    status: 'failed',
  },
  {
    id: 'local',
    name: '本机库',
    target: 'local.sqlite',
    targetTitle: '/local.sqlite',
    projectIds: [],
    tags: ['本机'],
    favorite: true,
    status: 'passed',
  },
];
const names = new Map([
  ['alpha', '产品研发'],
  ['beta', '业务分析'],
]);
const defaults = { search: '', projects: [], tags: [], onlyFavorites: false };
const ids = (filters: Partial<Parameters<typeof filterConnections>[1]>) =>
  filterConnections(rows, { ...defaults, ...filters }, names).map((row) => row.id);

describe('connection multi-select filtering', () => {
  test('selecting multiple projects includes either project and unassigned can join the selection', () => {
    expect(ids({ projects: ['alpha', 'beta'] })).toEqual(['dev', 'cache', 'shared']);
    expect(ids({ projects: ['alpha', unassignedProject] })).toEqual(['dev', 'shared', 'local']);
  });
  test('multiple tags match any selected tag while project and tag groups intersect', () => {
    expect(ids({ tags: ['开发', '本机'] })).toEqual(['dev', 'shared', 'local']);
    expect(ids({ projects: ['beta'], tags: ['开发', '本机'] })).toEqual(['shared']);
  });
  test('search and favorites still combine with the multi-select filters', () => {
    expect(
      ids({ search: '产品研发', projects: ['alpha', 'beta'], tags: ['开发'], onlyFavorites: true }),
    ).toEqual(['dev']);
    expect(ids({ projects: ['beta'], tags: ['本机'] })).toEqual([]);
  });
  test('clearing selections restores all rows without changing their order or metadata', () => {
    expect(ids({})).toEqual(['dev', 'cache', 'shared', 'local']);
    expect(rows[2].projectIds).toEqual(['alpha', 'beta']);
  });
});
