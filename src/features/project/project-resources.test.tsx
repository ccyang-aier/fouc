import { afterAll, beforeAll, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { useProjectResources as ReadResources } from './project-resources';

type ResourceState = ReturnType<typeof ReadResources>;
let browser: Window;
let root: Root;
let resources: ResourceState;
let session: { status: 'anonymous' } | { status: 'authenticated'; user: { id: string } } = { status: 'anonymous' };
let listCalls = 0;
let completeList: (projects: { id: string; name: string }[]) => void;
let completeCreate: ((project: { id: string; name: string }) => void) | undefined;
let delayCreate = false;
let renderResources: () => React.ReactNode;

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MutationObserver', 'getComputedStyle', 'localStorage']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  mock.module('@/features/identity/identity-provider', () => ({ useIdentity: () => ({ session }) }));
  mock.module('./project-client', () => ({ projectClient: {
    list: () => { listCalls++; return new Promise(resolve => { completeList = resolve; }); },
    create: async (name: string) => delayCreate ? new Promise(resolve => { completeCreate = resolve; }) : { id: 'cloud-created', name },
    rename: async (id: string, name: string) => ({ id, name }),
    remove: async () => {},
  } }));
  const { ProjectResourceProvider, useProjectResources } = await import('./project-resources');
  function Capture() {
    const value = useProjectResources();
    useEffect(() => { resources = value; }, [value]);
    return null;
  }
  renderResources = () => <ProjectResourceProvider><Capture /></ProjectResourceProvider>;
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });

async function render() { await act(async () => { root.render(renderResources()); await Promise.resolve(); }); }

test('local projects and selection survive identity changes and a late server directory response', async () => {
  localStorage.setItem('fouc.local-projects', JSON.stringify([{ id: 'local-a', name: '本机 A' }, { id: 'local-b', name: '本机 B' }]));
  await render();
  expect(listCalls).toBe(0);
  expect(resources.projects.map(project => project.source)).toEqual(['local', 'local']);
  await act(async () => resources.selectProject('local-b'));
  expect(resources.selectedProject?.id).toBe('local-b');

  session = { status: 'authenticated', user: { id: 'user-a' } };
  await render();
  expect(listCalls).toBe(1);
  expect(resources.selectedProject?.id).toBe('local-b');
  let createdId: string | undefined;
  await act(async () => { createdId = (await resources.createProject('新本机项目', 'local'))?.id; });
  await act(async () => { completeList([{ id: 'cloud-a', name: '私有项目 A' }]); await Promise.resolve(); });
  expect(resources.projects.map(project => project.id)).toEqual(['local-a', 'local-b', createdId!, 'cloud-a']);
  expect(resources.selectedProject?.id).toBe(createdId);
  expect(resources.projects.find(project => project.id === 'cloud-a')?.source).toBe('server');

  await act(async () => resources.selectProject('cloud-a'));
  session = { status: 'anonymous' };
  await render();
  expect(listCalls).toBe(1);
  expect(resources.projects.map(project => project.id)).toEqual(['local-a', 'local-b', createdId!]);
  expect(resources.selectedProject).toBeNull();
  expect(localStorage.getItem('fouc.local-projects')).not.toContain('私有项目 A');
  await act(async () => resources.selectProject(createdId!));
  expect(resources.selectedProject?.name).toBe('新本机项目');
});

test('a pending server creation preserves the directory that arrived while it was saving', async () => {
  session = { status: 'authenticated', user: { id: 'user-b' } };
  await render();
  delayCreate = true;
  let creating: Promise<unknown>;
  await act(async () => { creating = resources.createProject('新服务端项目', 'server'); });
  await act(async () => { completeList([{ id: 'existing-cloud', name: '已有服务端项目' }]); await Promise.resolve(); });
  expect(resources.projects.some(project => project.id === 'existing-cloud')).toBe(true);
  await act(async () => { completeCreate!({ id: 'new-cloud', name: '新服务端项目' }); await creating; });
  expect(resources.projects.filter(project => project.source === 'server').map(project => project.id)).toEqual(['existing-cloud', 'new-cloud']);
  expect(resources.selectedProject?.id).toBe('new-cloud');
  expect(localStorage.getItem('fouc.local-projects')).not.toContain('服务端项目');
  delayCreate = false;
});
