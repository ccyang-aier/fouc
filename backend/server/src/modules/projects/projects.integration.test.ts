import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createAuthTestServer, responseCookie, testPassword } from '../../platform/identity/auth-test-server';
import type { AuthTestServer } from '../../platform/identity/auth-test-server';
import { createWorkspaceRoutes } from '../workspaces/http';
import { createWorkspaceService } from '../workspaces/service';
import { createProjectRoutes } from './http';
import { createProjectService } from './service';

let server: AuthTestServer;
let ownerCookie: string;
let outsiderCookie: string;

async function actor(name: string) {
  const email = `${name}@projects.test`;
  expect((await server.request('/sign-up/email', { email, name, password: testPassword })).status).toBe(200);
  expect((await server.request(server.verificationPath(email))).status).toBe(302);
  return responseCookie(await server.request('/sign-in/email', { email, password: testPassword }));
}

function request(cookie: string, path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', body?: unknown) {
  return fetch(`${server.origin}/api/workspaces${path}`, {
    method, headers: { origin: server.webOrigin, cookie, ...(method === 'GET' ? {} : { 'content-type': 'application/json' }) },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
}

beforeAll(async () => {
  server = await createAuthTestServer({ mount(app, { auth, database }) {
    app.route('/', createWorkspaceRoutes(auth, createWorkspaceService(database.pool)));
    app.route('/', createProjectRoutes(auth, createProjectService(database.pool)));
  } });
  ownerCookie = await actor('owner');
  outsiderCookie = await actor('outsider');
}, 30_000);
afterAll(async () => { await server?.close(); }, 30_000);

test('projects are siblings under a workspace and cannot be listed or mutated through another workspace', async () => {
  const firstSpaceResponse = await request(ownerCookie, '', 'POST', { name: 'First', kind: 'team' });
  const secondSpaceResponse = await request(ownerCookie, '', 'POST', { name: 'Second', kind: 'team' });
  const first = await firstSpaceResponse.json() as { id: string };
  const second = await secondSpaceResponse.json() as { id: string };
  expect(firstSpaceResponse.status).toBe(201);
  expect(secondSpaceResponse.status).toBe(201);
  const firstProjectResponse = await request(ownerCookie, `/${first.id}/projects`, 'POST', { name: 'Project A' });
  expect(firstProjectResponse.status).toBe(201);
  const project = await firstProjectResponse.json() as { id: string; workspaceId: string; name: string };
  expect(project.workspaceId).toBe(first.id);
  expect((await (await request(ownerCookie, `/${first.id}/projects`)).json() as { items: unknown[] }).items).toContainEqual(project);
  expect((await (await request(ownerCookie, `/${second.id}/projects`)).json() as { items: unknown[] }).items).toEqual([]);
  expect((await request(ownerCookie, `/${second.id}/projects/${project.id}`, 'PATCH', { name: 'Crossed' })).status).toBe(404);
  expect((await request(outsiderCookie, `/${first.id}/projects`)).status).toBe(404);
  expect((await request(outsiderCookie, `/${first.id}/projects`, 'POST', { name: 'Unauthorized' })).status).toBe(404);
  expect((await request(ownerCookie, `/${first.id}/projects/${project.id}`, 'PATCH', { name: 'Renamed' })).status).toBe(200);
  expect((await request(ownerCookie, `/${first.id}/projects/${project.id}`, 'DELETE')).status).toBe(200);
  expect((await (await request(ownerCookie, `/${first.id}/projects`)).json() as { items: unknown[] }).items).toEqual([]);
});
