import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createAuthTestServer, responseCookie, testPassword } from '../../platform/identity/auth-test-server';
import type { AuthTestServer } from '../../platform/identity/auth-test-server';
import { createProjectRoutes } from './http';
import { createProjectService } from './service';

let server: AuthTestServer;
let owner: { cookie: string; userId: string };
let outsider: { cookie: string; userId: string };

async function actor(name: string) {
  const email = `${name}@projects.test`;
  expect((await server.request('/sign-up/email', { email, name, password: testPassword })).status).toBe(200);
  expect((await server.request(server.verificationPath(email))).status).toBe(302);
  const cookie = responseCookie(await server.request('/sign-in/email', { email, password: testPassword }));
  const identity = await (await fetch(`${server.origin}/test/identity`, { headers: { cookie } })).json() as { userId: string };
  return { cookie, userId: identity.userId };
}

function request(actor: { cookie: string }, path = '', method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', body?: unknown) {
  return fetch(`${server.origin}/api/projects${path}`, {
    method, headers: { origin: server.webOrigin, cookie: actor.cookie, ...(method === 'GET' ? {} : { 'content-type': 'application/json' }) },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
}

beforeAll(async () => {
  server = await createAuthTestServer({ mount(app, { auth, database }) {
    app.route('/', createProjectRoutes(auth, createProjectService(database.pool)));
  } });
  owner = await actor('owner');
  outsider = await actor('outsider');
}, 30_000);
afterAll(async () => { await server?.close(); }, 30_000);

test('projects are independent roots and only their members can list or mutate them', async () => {
  const created = await request(owner, '', 'POST', { name: 'Project A' });
  expect(created.status).toBe(201);
  const project = await created.json() as { id: string; name: string };
  expect(Object.keys(project).sort()).toEqual(['id', 'name']);
  expect((await (await request(owner)).json() as { items: unknown[] }).items).toContainEqual(project);
  expect((await (await request(outsider)).json() as { items: unknown[] }).items).toEqual([]);
  expect((await request(outsider, `/${project.id}`, 'PATCH', { name: 'Unauthorized' })).status).toBe(404);
  expect((await request(outsider, `/${project.id}`, 'DELETE')).status).toBe(404);
  expect((await request(owner, `/${project.id}`, 'PATCH', { name: 'Renamed' })).status).toBe(200);
  expect((await request(owner, `/${project.id}`, 'PATCH', { name: 'Injected', projectId: project.id })).status).toBe(400);
  expect((await request(owner, `/${project.id}`, 'DELETE')).status).toBe(200);
  expect((await (await request(owner)).json() as { items: unknown[] }).items).toEqual([]);
  expect((await request(outsider, '', 'POST', { name: 'My project' })).status).toBe(201);
  expect((await (await request(owner)).json() as { items: unknown[] }).items).toEqual([]);
});

test('project role limits remain independent of other resource memberships', async () => {
  const response = await request(owner, '', 'POST', { name: 'Shared project' });
  expect(response.status).toBe(201);
  const project = await response.json() as { id: string; name: string };
  await server.database.admin.query("INSERT INTO resources.project_member(project_id,user_id,role) VALUES ($1,$2,'member')", [project.id, outsider.userId]);
  expect((await (await request(outsider)).json() as { items: { id: string }[] }).items.some((item) => item.id === project.id)).toBe(true);
  expect((await request(outsider, `/${project.id}`, 'PATCH', { name: 'Denied member' })).status).toBe(403);
  await server.database.admin.query("UPDATE resources.project_member SET role='admin' WHERE project_id=$1 AND user_id=$2", [project.id, outsider.userId]);
  expect((await request(outsider, `/${project.id}`, 'PATCH', { name: 'Admin rename' })).status).toBe(200);
  await server.database.admin.query('DELETE FROM resources.project_member WHERE project_id=$1 AND user_id=$2', [project.id, outsider.userId]);
  expect((await request(outsider, `/${project.id}`, 'DELETE')).status).toBe(404);
});
