import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import type { TaskBoardDetail, TaskBoardSummary, TaskComment } from '@fouc/shared/tasks';
import { boardTask, taskBoard, taskBoardMember, taskColumn, taskComment } from '../../platform/database/resources/schema';
import { withProject } from '../../platform/database/resources/transaction';
import { inspectFoucDatabase } from '../../platform/database/initialize-status';
import { taskBoardPermissionSql } from '../../platform/database/resources/task-rls';
import { createAuthTestServer, responseCookie, testPassword } from '../../platform/identity/auth-test-server';
import type { AuthTestServer } from '../../platform/identity/auth-test-server';
import { createProjectRoutes } from '../projects/http';
import { createProjectService } from '../projects/service';
import { createTaskBoardRoutes } from './http';
import { createTaskBoardService } from './service';

type Actor = { cookie: string; userId: string; sessionId: string };
let server: AuthTestServer;
let owner: Actor;
let editor: Actor;
let viewer: Actor;
let admin: Actor;
let outsider: Actor;
let projectId: string;

async function actor(name: string): Promise<Actor> {
  const email = `${name}@taskboards.test`;
  expect((await server.request('/sign-up/email', { email, name, password: testPassword })).status).toBe(200);
  expect((await server.request(server.verificationPath(email))).status).toBe(302);
  const cookie = responseCookie(await server.request('/sign-in/email', { email, password: testPassword }));
  const identity = await (await fetch(`${server.origin}/test/identity`, { headers: { cookie } })).json() as { userId: string; sessionId: string };
  return { cookie, ...identity };
}

function request(actor: Actor, path = '', method = 'GET', body?: unknown, scope = projectId) {
  return fetch(`${server.origin}/api/projects/${scope}/task-boards${path}`, { method,
    headers: { origin: server.webOrigin, cookie: actor.cookie, ...(method === 'GET' ? {} : { 'content-type': 'application/json' }) },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
}

async function detail(response: Response): Promise<TaskBoardDetail> {
  if (!response.ok) throw new Error(`Unexpected task response ${response.status}: ${await response.text()}`);
  return response.json() as Promise<TaskBoardDetail>;
}

async function board(visibility?: 'private' | 'project' | 'invited') {
  return detail(await request(owner, '', 'POST', { name: `Board ${visibility ?? 'default'}`, ...(visibility ? { visibility } : {}) }));
}

beforeAll(async () => {
  server = await createAuthTestServer({ mount(app, { auth, database }) {
    app.route('/', createProjectRoutes(auth, createProjectService(database.pool)));
    app.route('/', createTaskBoardRoutes(auth, createTaskBoardService(database.pool)));
  } });
  owner = await actor('owner');
  editor = await actor('editor');
  viewer = await actor('viewer');
  admin = await actor('project-admin');
  outsider = await actor('outsider');
  const created = await fetch(`${server.origin}/api/projects`, { method: 'POST', headers: { origin: server.webOrigin, cookie: owner.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Task project' }) });
  expect(created.status).toBe(201);
  projectId = (await created.json() as { id: string }).id;
  for (const [member, role] of [[editor, 'member'], [viewer, 'member'], [admin, 'admin']] as const) {
    await server.database.admin.query('INSERT INTO resources.project_member(project_id,user_id,role) VALUES ($1,$2,$3)', [projectId, member.userId, role]);
  }
}, 60_000);

afterAll(async () => { await server?.close(); }, 30_000);

test('new boards are private; project administration never bypasses board privacy', async () => {
  const created = await board();
  expect(created.visibility).toBe('private');
  expect(created.permission).toBe('owner');
  expect(created.members.map(member => member.userId)).toEqual([owner.userId]);
  expect(created.columns.map(column => [column.name, column.isDone])).toEqual([['待处理', false], ['进行中', false], ['待审核', false], ['已完成', true]]);
  expect(created.tasks).toEqual([]);
  expect(created.taskCount).toBe(0);
  for (const actor of [viewer, admin]) {
    expect((await request(actor, `/${created.id}`)).status).toBe(404);
    const listed = await (await request(actor)).json() as { items: TaskBoardSummary[] };
    expect(listed.items.some(item => item.id === created.id)).toBe(false);
    expect((await request(actor, `/${created.id}`, 'DELETE')).status).toBe(404);
  }
  expect((await request(owner, `/${created.id}/members`, 'POST', { userId: viewer.userId })).status).toBe(400);
  expect((await request(outsider, `/${created.id}`)).status).toBe(404);
  const renamed = await detail(await request(owner, `/${created.id}`, 'PATCH', { name: 'My private board' }));
  expect(renamed.name).toBe('My private board');
  expect(renamed.visibility).toBe('private');
});

test('project boards start read-only and explicit editors cannot administer them', async () => {
  let created = await board('project');
  created = await detail(await request(owner, `/${created.id}`, 'PATCH', { name: 'Team board' }));
  expect(created.visibility).toBe('project');
  const seen = await detail(await request(viewer, `/${created.id}`));
  expect(seen.permission).toBe('viewer');
  expect(seen.members).toHaveLength(4);
  expect((await request(admin, `/${created.id}`, 'PATCH', { name: 'No admin bypass' })).status).toBe(403);
  expect((await request(viewer, `/${created.id}/tasks`, 'POST', { title: 'Denied', columnId: created.columns[0]!.id })).status).toBe(403);
  created = await detail(await request(owner, `/${created.id}/members`, 'POST', { userId: editor.userId, role: 'editor' }));
  expect((await detail(await request(editor, `/${created.id}`))).permission).toBe('editor');
  expect((await request(editor, `/${created.id}/members`, 'POST', { userId: viewer.userId, role: 'editor' })).status).toBe(403);
  expect((await request(editor, `/${created.id}`, 'DELETE')).status).toBe(403);
  expect((await request(owner, `/${created.id}/members`, 'POST', { userId: outsider.userId, role: 'viewer' })).status).toBe(404);
  const withTask = await detail(await request(editor, `/${created.id}/tasks`, 'POST', { title: 'Team work', columnId: created.columns[0]!.id, assigneeIds: [viewer.userId] }));
  expect(withTask.tasks[0]?.assigneeIds).toEqual([viewer.userId]);
  await request(owner, `/${created.id}/members/${editor.userId}`, 'DELETE');
  expect((await detail(await request(editor, `/${created.id}`))).permission).toBe('viewer');
});

test('invitation ACL, assignment and stale project membership are enforced on each request', async () => {
  const created = await board('invited');
  expect((await request(viewer, `/${created.id}`)).status).toBe(404);
  await detail(await request(owner, `/${created.id}/members`, 'POST', { userId: viewer.userId }));
  const seen = await detail(await request(viewer, `/${created.id}`));
  expect(seen.permission).toBe('viewer');
  expect((await request(viewer, `/${created.id}/columns`, 'POST', { name: 'Denied' })).status).toBe(403);
  expect((await request(owner, `/${created.id}/tasks`, 'POST', { title: 'Invalid assignment', columnId: created.columns[0]!.id, assigneeIds: [editor.userId] })).status).toBe(400);
  const assigned = await detail(await request(owner, `/${created.id}/tasks`, 'POST', { title: 'Assigned', columnId: created.columns[0]!.id, assigneeIds: [viewer.userId] }));
  await server.database.admin.query('DELETE FROM resources.project_member WHERE project_id=$1 AND user_id=$2', [projectId, viewer.userId]);
  expect((await request(viewer, `/${created.id}`)).status).toBe(404);
  expect((await detail(await request(owner, `/${created.id}`))).tasks[0]?.assigneeIds).toEqual([]);
  const unrelatedEdit = await detail(await request(owner, `/${created.id}/tasks/${assigned.tasks[0]!.id}`, 'PATCH', { title: 'Updated after member removal' }));
  expect(unrelatedEdit.tasks[0]).toMatchObject({ title: 'Updated after member removal', assigneeIds: [] });
  expect((await request(owner, `/${created.id}/tasks/${assigned.tasks[0]!.id}`, 'PATCH', { assigneeIds: [viewer.userId] })).status).toBe(400);
  await server.database.admin.query("INSERT INTO resources.project_member(project_id,user_id,role) VALUES ($1,$2,'member')", [projectId, viewer.userId]);
  // Rejoining the project does not restore an old board invitation.
  expect((await request(viewer, `/${created.id}`)).status).toBe(404);
  await detail(await request(owner, `/${created.id}/members`, 'POST', { userId: viewer.userId, role: 'editor' }));
  expect((await detail(await request(viewer, `/${created.id}`))).permission).toBe('editor');
  await detail(await request(owner, `/${created.id}`, 'PATCH', { visibility: 'private' }));
  expect((await request(viewer, `/${created.id}`)).status).toBe(404);
});

test('tasks retain all fields, stable checklist IDs, accurate progress and deterministic moves', async () => {
  let created = await board();
  const [todo, progress, , done] = created.columns;
  created = await detail(await request(owner, `/${created.id}/tasks`, 'POST', { columnId: todo!.id, title: 'First', description: 'Plain task details', priority: 'urgent', dueDate: '2026-11-04', labels: ['Design', 'Design'], assigneeIds: [owner.userId], checklist: [{ title: 'Outline', done: true }, { title: 'Review' }] }));
  const first = created.tasks[0]!;
  expect(first).toMatchObject({ title: 'First', description: 'Plain task details', priority: 'urgent', dueDate: '2026-11-04', labels: ['Design'], assigneeIds: [owner.userId], commentCount: 0 });
  expect(first.checklist[0]?.id).toBeString();
  expect(first.checklist.map(item => item.done)).toEqual([true, false]);
  created = await detail(await request(owner, `/${created.id}/tasks`, 'POST', { columnId: todo!.id, title: 'Second' }));
  const second = created.tasks.find(task => task.title === 'Second')!;
  created = await detail(await request(owner, `/${created.id}/tasks/${second.id}/move`, 'POST', { columnId: todo!.id, beforeTaskId: first.id }));
  expect(created.tasks.filter(task => task.columnId === todo!.id).map(task => task.id)).toEqual([second.id, first.id]);
  created = await detail(await request(owner, `/${created.id}/tasks/${second.id}/move`, 'POST', { columnId: progress!.id, beforeTaskId: null }));
  expect(created.tasks.find(task => task.id === second.id)?.columnId).toBe(progress!.id);
  expect((await request(owner, `/${created.id}/tasks/${first.id}/move`, 'POST', { columnId: todo!.id, beforeTaskId: second.id })).status).toBe(400);
  created = await detail(await request(owner, `/${created.id}/tasks/${first.id}`, 'PATCH', { columnId: done!.id, checklist: first.checklist.map(item => ({ ...item, done: true })) }));
  expect(created.tasks.find(task => task.id === first.id)?.checklist.map(item => item.id)).toEqual(first.checklist.map(item => item.id));
  expect(created.taskCount).toBe(2);
  expect(created.completedCount).toBe(1);
  created = await detail(await request(owner, `/${created.id}/tasks/${first.id}`, 'PATCH', { title: 'First refined' }));
  expect(created.tasks.find(task => task.id === first.id)).toMatchObject({ title: 'First refined', description: 'Plain task details', priority: 'urgent', dueDate: '2026-11-04', assigneeIds: [owner.userId], labels: ['Design'] });
  const summary = (await (await request(owner)).json() as { items: TaskBoardSummary[] }).items.find(item => item.id === created.id)!;
  expect(summary).toMatchObject({ taskCount: 2, completedCount: 1 });
  const removed = await detail(await request(owner, `/${created.id}/tasks/${second.id}`, 'DELETE'));
  expect(removed.tasks.map(task => task.id)).toEqual([first.id]);
  expect((await request(owner, `/${created.id}/columns/${done!.id}`, 'DELETE')).status).toBe(409);
  // Deleting a populated board cascades its tasks, columns and comments cleanly.
  expect((await request(owner, `/${created.id}`, 'DELETE')).status).toBe(200);
  expect((await request(owner, `/${created.id}`)).status).toBe(404);
});

test('columns support editing and complete ordering while foreign resource IDs are rejected', async () => {
  let created = await board();
  const foreign = await board();
  const withForeignTask = await detail(await request(owner, `/${foreign.id}/tasks`, 'POST', { columnId: foreign.columns[0]!.id, title: 'Foreign task' }));
  expect((await request(owner, `/${created.id}/tasks/${withForeignTask.tasks[0]!.id}`, 'PATCH', { title: 'Foreign task edit' })).status).toBe(404);
  const columns = created.columns.map(column => column.id);
  created = await detail(await request(owner, `/${created.id}/columns`, 'POST', { name: 'Blocked', color: 'rose' }));
  const added = created.columns.find(column => column.name === 'Blocked')!;
  created = await detail(await request(owner, `/${created.id}/columns/${added.id}`, 'PATCH', { name: '待确认', isDone: true }));
  expect(created.columns.find(column => column.id === added.id)).toMatchObject({ name: '待确认', color: 'rose', isDone: true });
  created = await detail(await request(owner, `/${created.id}/columns/reorder`, 'POST', { columnIds: [added.id, ...columns] }));
  expect(created.columns.map(column => column.id)).toEqual([added.id, ...columns]);
  expect((await request(owner, `/${created.id}/columns/reorder`, 'POST', { columnIds: columns })).status).toBe(400);
  expect((await request(owner, `/${created.id}/columns/reorder`, 'POST', { columnIds: [added.id, added.id] })).status).toBe(400);
  expect((await request(owner, `/${created.id}/tasks`, 'POST', { columnId: foreign.columns[0]!.id, title: 'Foreign column' })).status).toBe(404);
  expect((await request(owner, `/${created.id}/columns/${foreign.columns[0]!.id}`, 'PATCH', { name: 'Foreign' })).status).toBe(404);
  expect((await request(owner, `/${created.id}/tasks/${randomUUID()}`, 'PATCH', { title: 'Unknown' })).status).toBe(404);
  created = await detail(await request(owner, `/${created.id}/columns/${added.id}`, 'DELETE'));
  expect(created.columns.map(column => column.id)).toEqual(columns);
});

test('only writers create comments; authors and board owners can delete comments', async () => {
  let created = await board('project');
  await detail(await request(owner, `/${created.id}/members`, 'POST', { userId: editor.userId, role: 'editor' }));
  await detail(await request(owner, `/${created.id}/members`, 'POST', { userId: admin.userId, role: 'editor' }));
  created = await detail(await request(owner, `/${created.id}/tasks`, 'POST', { columnId: created.columns[0]!.id, title: 'Discussion' }));
  const task = created.tasks[0]!;
  expect((await request(viewer, `/${created.id}/tasks/${task.id}/comments`, 'POST', { body: 'Read-only' })).status).toBe(403);
  const response = await request(editor, `/${created.id}/tasks/${task.id}/comments`, 'POST', { body: 'Ready for review' });
  expect(response.status).toBe(201);
  const comment = await response.json() as TaskComment;
  expect(comment).toMatchObject({ authorId: editor.userId, authorName: 'editor', body: 'Ready for review' });
  expect((await (await request(viewer, `/${created.id}/tasks/${task.id}/comments`)).json() as { items: TaskComment[] }).items.map(item => item.id)).toEqual([comment.id]);
  expect((await detail(await request(owner, `/${created.id}`))).tasks[0]?.commentCount).toBe(1);
  expect((await request(admin, `/${created.id}/tasks/${task.id}/comments/${comment.id}`, 'DELETE')).status).toBe(403);
  expect((await request(editor, `/${created.id}/tasks/${task.id}/comments/${comment.id}`, 'DELETE')).status).toBe(200);
  const second = await (await request(editor, `/${created.id}/tasks/${task.id}/comments`, 'POST', { body: 'Second comment' })).json() as TaskComment;
  expect((await request(owner, `/${created.id}/tasks/${task.id}/comments/${second.id}`, 'DELETE')).status).toBe(200);
  expect((await detail(await request(owner, `/${created.id}`))).tasks[0]?.commentCount).toBe(0);
});

test('HTTP rejects untrusted origin, malformed input, scope injection and cross-project IDs', async () => {
  const created = await board();
  expect((await request(owner, '', 'POST', { name: '' })).status).toBe(400);
  expect((await request(owner, '/not-a-uuid')).status).toBe(400);
  expect((await request(owner, '', 'POST', { name: 'Scope spoof', projectId: randomUUID() })).status).toBe(400);
  expect((await request(owner, `/${created.id}`, 'PATCH', {})).status).toBe(400);
  expect((await request(owner, `/${created.id}/tasks`, 'POST', { title: 'Invalid date', columnId: created.columns[0]!.id, dueDate: '2026-02-30' })).status).toBe(400);
  expect((await request(owner, `/${created.id}/tasks`, 'POST', { title: 'Injected', columnId: created.columns[0]!.id, createdBy: viewer.userId })).status).toBe(400);
  expect((await request(owner, `/${created.id}`, 'GET', undefined, randomUUID())).status).toBe(404);
  expect((await fetch(`${server.origin}/api/projects/${projectId}/task-boards`, { headers: { origin: 'https://untrusted.example', cookie: owner.cookie } })).status).toBe(403);
  expect((await fetch(`${server.origin}/api/projects/${projectId}/task-boards`, { headers: { origin: server.webOrigin } })).status).toBe(401);
});

test('HTTP accepts supported multilingual task drafts and rejects bodies over 128 KiB', async () => {
  const created = await board();
  const description = '任务说明'.repeat(1_500);
  const checklist = Array.from({ length: 100 }, (_, index) => ({ title: '验'.repeat(236) + String(index).padStart(4, '0'), done: false }));
  const payload = { columnId: created.columns[0]!.id, title: '完整任务内容', description, checklist };
  expect(new TextEncoder().encode(JSON.stringify(payload)).byteLength).toBeGreaterThan(16 * 1_024);
  const response = await request(owner, `/${created.id}/tasks`, 'POST', payload);
  expect(response.status).toBe(201);
  const task = (await detail(response)).tasks[0]!;
  expect(task.description).toBe(description);
  expect(task.checklist.map(item => item.title)).toEqual(checklist.map(item => item.title));
  const revisedDescription = '更新内容'.repeat(1_500);
  const revisedChecklist = task.checklist.map(item => ({ ...item, done: true }));
  const updated = await request(owner, `/${created.id}/tasks/${task.id}`, 'PATCH', { description: revisedDescription, checklist: revisedChecklist });
  expect(updated.status).toBe(200);
  expect((await detail(updated)).tasks[0]).toMatchObject({ description: revisedDescription, checklist: revisedChecklist });
  const oversized = await request(owner, `/${created.id}/tasks/${task.id}`, 'PATCH', { description: '超'.repeat(50_000) });
  expect(oversized.status).toBe(413);
  expect(await oversized.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
});

test('PostgreSQL RLS itself hides private board content and prevents viewer writes', async () => {
  let created = await board('private');
  created = await detail(await request(owner, `/${created.id}/tasks`, 'POST', { title: 'Hidden content', columnId: created.columns[0]!.id }));
  await withProject(server.database.pool, projectId, admin.sessionId, async db => {
    for (const table of [taskBoard, taskBoardMember, taskColumn, boardTask, taskComment]) {
      const rows = await db.execute<{ id: string }>(sql`SELECT * FROM ${table}`);
      expect(rows.rows.some(row => row.id === created.id || created.tasks.some(task => task.id === row.id) || created.columns.some(column => column.id === row.id))).toBe(false);
    }
  });
  const visible = await board('project');
  let failed = false;
  try {
    await withProject(server.database.pool, projectId, viewer.sessionId, async db => {
      await db.execute(sql`INSERT INTO resources.board_task(project_id,board_id,id,column_id,title,position,created_by) VALUES (${projectId}::uuid,${visible.id}::uuid,${randomUUID()}::uuid,${visible.columns[0]!.id}::uuid,'Denied direct SQL',1,${viewer.userId}::uuid)`);
    });
  } catch { failed = true; }
  expect(failed).toBe(true);
  const noScope = await server.database.pool.query('SELECT * FROM resources.task_board');
  expect(noScope.rowCount).toBe(0);
});

test('deployment validation detects a weakened board permission function', async () => {
  try {
    await server.database.admin.query("CREATE OR REPLACE FUNCTION resources.task_board_permission(target_project uuid, target_board uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET row_security=off AS $$ SELECT 'owner'::text $$");
    const status = await inspectFoucDatabase(server.database.admin, server.database.pool);
    expect(status.state).toBe('incomplete');
    expect(status.issues).toContain('Task-board permission function differs from current definition');
  } finally {
    await server.database.admin.query(taskBoardPermissionSql.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION'));
  }
});
