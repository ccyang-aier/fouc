import { afterAll, beforeAll, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, StrictMode, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { useProjectResources as ReadResources } from './project-resources';

type ResourceState = ReturnType<typeof ReadResources>;
let browser: Window;
let root: Root;
let resources: ResourceState;
let session: { status: 'anonymous' } | { status: 'authenticated'; user: { id: string } } = {
  status: 'anonymous',
};
let listCalls = 0;
let completeList: (projects: { id: string; name: string }[]) => void;
let completeCreate: ((project: { id: string; name: string }) => void) | undefined;
let delayCreate = false;
let completeRename: ((project: { id: string; name: string }) => void) | undefined;
let delayRename = false;
let completeRemove: (() => void) | undefined;
let delayRemove = false;
let renameFailure: Error | null = null;
let removeFailure: Error | null = null;
let renderResources: () => React.ReactNode;

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of [
    'document',
    'navigator',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MutationObserver',
    'getComputedStyle',
    'localStorage',
  ])
    globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  mock.module('@/features/identity/identity-provider', () => ({
    useIdentity: () => ({ session }),
  }));
  mock.module('./project-client', () => ({
    projectClient: {
      list: () => {
        listCalls++;
        return new Promise((resolve) => {
          completeList = resolve;
        });
      },
      create: async (name: string) =>
        delayCreate
          ? new Promise((resolve) => {
              completeCreate = resolve;
            })
          : { id: 'cloud-created', name },
      rename: async (id: string, name: string) => {
        if (renameFailure) throw renameFailure;
        return delayRename
          ? new Promise((resolve) => {
              completeRename = resolve;
            })
          : { id, name };
      },
      remove: async () => {
        if (removeFailure) throw removeFailure;
        if (delayRemove)
          await new Promise<void>((resolve) => {
            completeRemove = resolve;
          });
      },
    },
  }));
  const { ProjectResourceProvider, useProjectResources } = await import('./project-resources');
  function Capture() {
    const value = useProjectResources();
    useEffect(() => {
      resources = value;
    }, [value]);
    return null;
  }
  renderResources = () => (
    <ProjectResourceProvider>
      <Capture />
    </ProjectResourceProvider>
  );
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterAll(async () => {
  await act(async () => root.unmount());
  await browser.happyDOM.abort();
});

async function render() {
  await act(async () => {
    root.render(renderResources());
    await Promise.resolve();
  });
}

test('local projects and selection survive identity changes and a late server directory response', async () => {
  localStorage.setItem(
    'fouc.local-projects',
    JSON.stringify([
      { id: 'local-a', name: '本机 A' },
      { id: 'local-b', name: '本机 B' },
    ]),
  );
  await render();
  expect(listCalls).toBe(0);
  expect(resources.projects.map((project) => project.source)).toEqual(['local', 'local']);
  await act(async () => resources.selectProject('local-b'));
  expect(resources.selectedProject?.id).toBe('local-b');

  session = { status: 'authenticated', user: { id: 'user-a' } };
  await render();
  expect(listCalls).toBe(1);
  expect(resources.selectedProject?.id).toBe('local-b');
  let createdId: string | undefined;
  await act(async () => {
    createdId = (await resources.createProject('新本机项目', 'local'))?.id;
  });
  await act(async () => {
    completeList([{ id: 'cloud-a', name: '私有项目 A' }]);
    await Promise.resolve();
  });
  expect(resources.projects.map((project) => project.id)).toEqual([
    'local-a',
    'local-b',
    createdId!,
    'cloud-a',
  ]);
  expect(resources.selectedProject?.id).toBe(createdId);
  expect(resources.projects.find((project) => project.id === 'cloud-a')?.source).toBe('server');

  await act(async () => resources.selectProject('cloud-a'));
  session = { status: 'anonymous' };
  await render();
  expect(listCalls).toBe(1);
  expect(resources.projects.map((project) => project.id)).toEqual([
    'local-a',
    'local-b',
    createdId!,
  ]);
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
  await act(async () => {
    creating = resources.createProject('新服务端项目', 'server');
  });
  await act(async () => {
    completeList([{ id: 'existing-cloud', name: '已有服务端项目' }]);
    await Promise.resolve();
  });
  expect(resources.projects.some((project) => project.id === 'existing-cloud')).toBe(true);
  await act(async () => {
    completeCreate!({ id: 'new-cloud', name: '新服务端项目' });
    await creating;
  });
  expect(
    resources.projects
      .filter((project) => project.source === 'server')
      .map((project) => project.id),
  ).toEqual(['existing-cloud', 'new-cloud']);
  expect(resources.selectedProject?.id).toBe('new-cloud');
  expect(localStorage.getItem('fouc.local-projects')).not.toContain('服务端项目');
  delayCreate = false;
});

test('local renaming persists the real project name and invalid mutations report failure', async () => {
  session = { status: 'anonymous' };
  localStorage.setItem(
    'fouc.local-projects',
    JSON.stringify([{ id: 'local-rename', name: '原名称' }]),
  );
  localStorage.setItem('fouc.project.active', JSON.stringify('local-rename'));
  await render();
  let renamed = false;
  await act(async () => {
    renamed = await resources.renameProject('local-rename', '  新名称  ');
  });
  expect(renamed).toBe(true);
  expect(resources.selectedProject).toEqual({
    id: 'local-rename',
    name: '新名称',
    source: 'local',
  });
  expect(JSON.parse(localStorage.getItem('fouc.local-projects')!)).toEqual([
    { id: 'local-rename', name: '新名称' },
  ]);
  await act(async () => {
    expect(await resources.renameProject('local-rename', '   ')).toBe(false);
    expect(await resources.renameProject('missing-project', '新名称')).toBe(false);
    expect(await resources.removeProject('missing-project')).toBe(false);
  });
  expect(resources.selectedProject?.name).toBe('新名称');
  expect(resources.error).toBeNull();
});

test('forbidden server mutations report failure and preserve the project, selection, favorite and panel', async () => {
  session = { status: 'authenticated', user: { id: 'user-member' } };
  localStorage.setItem('fouc.local-projects', JSON.stringify([]));
  localStorage.setItem('fouc.project.active', JSON.stringify('shared-project'));
  await render();
  await act(async () => {
    completeList([{ id: 'shared-project', name: '团队项目' }]);
    await Promise.resolve();
  });
  await act(async () => {
    resources.setFavorite('shared-project', true);
    resources.setManagementPanel('settings');
  });
  const persisted = localStorage.getItem('fouc.local-projects');
  const forbidden = Object.assign(new Error('Resource management permission is required.'), {
    status: 403,
  });
  renameFailure = forbidden;
  removeFailure = forbidden;
  let renamed = true;
  let removed = true;
  await act(async () => {
    renamed = await resources.renameProject('shared-project', '被拒绝的名称');
  });
  expect(renamed).toBe(false);
  expect(resources.error).toBe(forbidden.message);
  expect(resources.projects).toEqual([
    { id: 'shared-project', name: '团队项目', source: 'server' },
  ]);
  await act(async () => {
    removed = await resources.removeProject('shared-project');
  });
  expect(removed).toBe(false);
  expect(resources.error).toBe(forbidden.message);
  expect(resources.selectedProject?.id).toBe('shared-project');
  expect(resources.projects).toEqual([
    { id: 'shared-project', name: '团队项目', source: 'server' },
  ]);
  expect(resources.favorites).toEqual(['shared-project']);
  expect(resources.managementPanel).toBe('settings');
  expect(localStorage.getItem('fouc.local-projects')).toBe(persisted);
  expect(JSON.parse(localStorage.getItem('fouc.project.active')!)).toBe('shared-project');

  renameFailure = null;
  removeFailure = null;
  await act(async () => {
    renamed = await resources.renameProject('shared-project', '已保存的名称');
  });
  expect(renamed).toBe(true);
  expect(resources.selectedProject?.name).toBe('已保存的名称');
  expect(resources.error).toBeNull();
  expect(localStorage.getItem('fouc.local-projects')).not.toContain('已保存的名称');
  await act(async () => {
    removed = await resources.removeProject('shared-project');
  });
  expect(removed).toBe(true);
  expect(resources.projects).toEqual([]);
  expect(resources.selectedProject).toBeNull();
  expect(resources.favorites).toEqual([]);
  expect(resources.managementPanel).toBeNull();
});

for (const mutation of ['rename', 'remove', 'create'] as const) {
  test(`a late server ${mutation} after logout cannot overwrite the new identity's local projects`, async () => {
    session = { status: 'authenticated', user: { id: `user-pending-${mutation}` } };
    localStorage.setItem('fouc.local-projects', JSON.stringify([]));
    localStorage.setItem('fouc.project.active', JSON.stringify('old-cloud'));
    localStorage.setItem('fouc.project.selection.guest', JSON.stringify([]));
    await render();
    await act(async () => {
      completeList([{ id: 'old-cloud', name: '旧身份项目' }]);
      await Promise.resolve();
    });
    const oldResources = resources;
    delayRename = mutation === 'rename';
    delayRemove = mutation === 'remove';
    delayCreate = mutation === 'create';
    let pending!: Promise<unknown>;
    await act(async () => {
      pending =
        mutation === 'rename'
          ? oldResources.renameProject('old-cloud', '迟到的名称')
          : mutation === 'remove'
            ? oldResources.removeProject('old-cloud')
            : oldResources.createProject('迟到的服务端项目', 'server');
    });

    session = { status: 'anonymous' };
    await render();
    let localId: string | undefined;
    await act(async () => {
      localId = (await resources.createProject('退出后新建的本机项目', 'local'))?.id;
    });
    await act(async () => {
      resources.setFavorite(localId!, true);
      resources.setManagementPanel('settings');
    });
    const localProjects = localStorage.getItem('fouc.local-projects');
    const activeProject = localStorage.getItem('fouc.project.active');
    const favorites = localStorage.getItem('fouc.project.selection.guest');
    let result: unknown;
    await act(async () => {
      if (mutation === 'rename') completeRename!({ id: 'old-cloud', name: '迟到的名称' });
      else if (mutation === 'remove') completeRemove!();
      else completeCreate!({ id: 'late-cloud', name: '迟到的服务端项目' });
      result = await pending;
    });

    expect(result).toBe(mutation === 'create' ? null : false);
    expect(resources.projects).toEqual([
      { id: localId!, name: '退出后新建的本机项目', source: 'local' },
    ]);
    expect(resources.selectedProject?.id).toBe(localId);
    expect(resources.favorites).toEqual([localId!]);
    expect(resources.managementPanel).toBe('settings');
    expect(resources.error).toBeNull();
    expect(localStorage.getItem('fouc.local-projects')).toBe(localProjects);
    expect(localStorage.getItem('fouc.project.active')).toBe(activeProject);
    expect(localStorage.getItem('fouc.project.selection.guest')).toBe(favorites);
    delayRename = false;
    delayRemove = false;
    delayCreate = false;
  });
}

test('StrictMode effect replay leaves the current project scope available for mutations', async () => {
  session = { status: 'authenticated', user: { id: 'user-strict-mode' } };
  localStorage.setItem('fouc.local-projects', JSON.stringify([]));
  localStorage.setItem('fouc.project.active', JSON.stringify('strict-cloud'));
  await act(async () => {
    root.render(<StrictMode>{renderResources()}</StrictMode>);
    await Promise.resolve();
  });
  await act(async () => {
    completeList([{ id: 'strict-cloud', name: '原名称' }]);
    await Promise.resolve();
  });
  let renamed = false;
  await act(async () => {
    renamed = await resources.renameProject('strict-cloud', 'StrictMode 保存成功');
  });
  expect(renamed).toBe(true);
  expect(resources.selectedProject?.name).toBe('StrictMode 保存成功');
  expect(resources.error).toBeNull();
});
