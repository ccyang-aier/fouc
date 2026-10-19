import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { TASK_COMMENT_IMAGE_MAX_BYTES } from '@fouc/shared/tasks';
import type { TaskBoardDetail, TaskComment } from '@fouc/shared/tasks';
import { createAuthTestServer, responseCookie, testPassword } from '../../platform/identity/auth-test-server';
import type { AuthTestServer } from '../../platform/identity/auth-test-server';
import { S3StorageError } from '../../platform/storage/s3';
import { createProjectRoutes } from '../projects/http';
import { createProjectService } from '../projects/service';
import type { TaskCommentImageStorage } from './comment-images';
import { createTaskBoardRoutes } from './http';
import { createTaskBoardService } from './service';

type Actor = { cookie: string; userId: string };
let server: AuthTestServer;
let owner: Actor;
let editor: Actor;
let viewer: Actor;
let outsider: Actor;
let projectId: string;
const objects = new Map<string, { bytes: Uint8Array; mime: string }>();
let failPutNumber = 0;
let putNumber = 0;
let failDelete = false;
const storage: TaskCommentImageStorage = {
  async putObject(key, bytes, mime) {
    objects.set(key, { bytes: bytes.slice(), mime });
    if (failPutNumber && ++putNumber === failPutNumber) throw new Error('Simulated object write failure');
  },
  async openObject(key) {
    const object = objects.get(key);
    if (!object) throw new S3StorageError('OBJECT_MISSING');
    return new Response(Buffer.from(object.bytes), { headers: { 'Content-Type': object.mime } });
  },
  async deleteObject(key) {
    if (failDelete) throw new Error('Simulated delete failure');
    return objects.delete(key);
  },
};
const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=', 'base64');
const png = (name = 'review.png') => new File([pngBytes], name, { type: 'image/png' });

async function actor(name: string): Promise<Actor> {
  const email = `${name}@comment-images.test`;
  expect((await server.request('/sign-up/email', { email, name, password: testPassword })).status).toBe(200);
  expect((await server.request(server.verificationPath(email))).status).toBe(302);
  const cookie = responseCookie(await server.request('/sign-in/email', { email, password: testPassword }));
  const identity = await (await fetch(`${server.origin}/test/identity`, { headers: { cookie } })).json() as { userId: string };
  return { cookie, ...identity };
}

function request(actor: Actor, path = '', method = 'GET', body?: unknown, scope = projectId) {
  return fetch(`${server.origin}/api/projects/${scope}/task-boards${path}`, { method,
    headers: { origin: server.webOrigin, cookie: actor.cookie, ...(method === 'GET' || body instanceof FormData ? {} : { 'content-type': 'application/json' }) },
    body: method === 'GET' ? undefined : body instanceof FormData ? body : JSON.stringify(body ?? {}),
  });
}

async function createProject(name: string) {
  const response = await fetch(`${server.origin}/api/projects`, { method: 'POST', headers: { origin: server.webOrigin, cookie: owner.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
  expect(response.status).toBe(201);
  return (await response.json() as { id: string }).id;
}

async function board() {
  const created = await (await request(owner, '', 'POST', { name: 'Image discussion', visibility: 'project' })).json() as TaskBoardDetail;
  expect((await request(owner, `/${created.id}/members`, 'POST', { userId: editor.userId, role: 'editor' })).status).toBe(200);
  const updated = await (await request(owner, `/${created.id}/tasks`, 'POST', { title: 'Review', columnId: created.columns[0]!.id })).json() as TaskBoardDetail;
  return { board: updated, path: `/${created.id}/tasks/${updated.tasks[0]!.id}/comments` };
}

function multipart(files: readonly File[], body = '') {
  const form = new FormData();
  form.set('body', body);
  for (const file of files) form.append('images', file);
  return form;
}

async function publish(path: string, files: readonly File[] = [png()], body = '') {
  const response = await request(editor, path, 'POST', multipart(files, body));
  if (response.status !== 201) throw new Error(`Unexpected image comment response ${response.status}: ${await response.text()}`);
  return response.json() as Promise<TaskComment>;
}

const imagePath = (path: string, comment: TaskComment) => `${path}/${comment.id}/images/${comment.images[0]!.id}`;

beforeAll(async () => {
  server = await createAuthTestServer({ mount(app, { auth, database }) {
    app.route('/', createProjectRoutes(auth, createProjectService(database.pool)));
    app.route('/', createTaskBoardRoutes(auth, createTaskBoardService(database.pool, storage)));
  } });
  owner = await actor('image-owner');
  editor = await actor('image-editor');
  viewer = await actor('image-viewer');
  outsider = await actor('image-outsider');
  projectId = await createProject('Comment image project');
  for (const member of [editor, viewer]) await server.database.admin.query('INSERT INTO resources.project_member(project_id,user_id,role) VALUES ($1,$2,$3)', [projectId, member.userId, 'member']);
}, 60_000);

afterAll(async () => { await server?.close(); }, 30_000);

test('image-only comments persist metadata and serve authenticated private image bytes', async () => {
  const { path } = await board();
  const comment = await publish(path);
  expect(comment.body).toBe('');
  expect(comment.images).toHaveLength(1);
  expect(comment.images[0]).toMatchObject({ name: 'review.png', mime: 'image/png', size: pngBytes.byteLength });
  expect((await (await request(viewer, path)).json() as { items: TaskComment[] }).items).toEqual([comment]);
  const response = await request(viewer, imagePath(path, comment));
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('image/png');
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(pngBytes));
  const text = await (await request(editor, path, 'POST', { body: 'Looks good 🥳' })).json() as TaskComment;
  expect(text.images).toEqual([]);
});

test('image writes and reads enforce live project, board, task, comment and image boundaries', async () => {
  const { board: created, path } = await board();
  const count = objects.size;
  expect((await request(viewer, path, 'POST', multipart([png()]))).status).toBe(403);
  expect((await request(outsider, path, 'POST', multipart([png()]))).status).toBe(404);
  expect(objects.size).toBe(count);
  const comment = await publish(path, [png()], 'Review');
  expect((await request(outsider, imagePath(path, comment))).status).toBe(404);
  const foreign = await board();
  expect((await request(owner, imagePath(foreign.path, comment))).status).toBe(404);
  const foreignTask = path.replace(created.tasks[0]!.id, randomUUID());
  expect((await request(owner, imagePath(foreignTask, comment))).status).toBe(404);
  const otherProjectId = await createProject('Other image project');
  expect((await request(owner, imagePath(path, comment), 'GET', undefined, otherProjectId)).status).toBe(404);
  expect((await request(owner, `${path}/${comment.id}/images/${randomUUID()}`)).status).toBe(404);
  expect((await request(owner, `${path}/${randomUUID()}/images/${comment.images[0]!.id}`)).status).toBe(404);
  expect((await request(owner, `/${created.id}/members/${editor.userId}`, 'DELETE')).status).toBe(200);
  expect((await request(editor, path, 'POST', multipart([png()]))).status).toBe(403);
});

test('multipart validation rejects unsupported, spoofed, excessive and oversized image content', async () => {
  const { path } = await board();
  const count = objects.size;
  const cases = [
    [new File(['<svg></svg>'], 'vector.svg', { type: 'image/svg+xml' })],
    [new File(['Not an image'], 'fake.png', { type: 'image/png' })],
    [new File([pngBytes], 'mismatch.gif', { type: 'image/gif' })],
    [new File([], 'empty.png', { type: 'image/png' })],
    [new File([new Uint8Array(TASK_COMMENT_IMAGE_MAX_BYTES + 1)], 'big.png', { type: 'image/png' })],
    Array.from({ length: 5 }, () => png()),
  ];
  for (const files of cases) expect((await request(editor, path, 'POST', multipart(files))).status).toBe(400);
  expect((await request(editor, path, 'POST', { body: '' })).status).toBe(400);
  expect((await request(editor, path, 'POST', { body: 'x'.repeat(4_001) })).status).toBe(400);
  expect((await request(editor, path, 'POST', { body: 'Fake metadata', images: [{ id: randomUUID(), name: 'fake.png', mime: 'image/png', size: 2 }] })).status).toBe(400);
  const spoof = multipart([png()]);
  spoof.set('projectId', randomUUID());
  expect((await request(editor, path, 'POST', spoof)).status).toBe(400);
  expect(objects.size).toBe(count);
});

test('only multipart comment creation receives the larger body limit', async () => {
  const { board: created, path } = await board();
  const bytes = new Uint8Array(140 * 1_024);
  bytes.set(pngBytes);
  const response = await request(editor, path, 'POST', multipart([new File([bytes], 'large-valid.png', { type: 'image/png' })]));
  expect(response.status).toBe(201);
  expect((await request(editor, path, 'POST', { body: 'x'.repeat(140 * 1_024) })).status).toBe(413);
  expect((await request(editor, `/${created.id}/tasks`, 'POST', multipart([png()]))).status).toBe(415);
  const huge = new File([new Uint8Array(TASK_COMMENT_IMAGE_MAX_BYTES)], 'huge.png', { type: 'image/png' });
  expect((await request(editor, path, 'POST', multipart(Array.from({ length: 5 }, () => huge)))).status).toBe(413);
});

test('failed image writes clean every attempted object and leave no published comment', async () => {
  const { path } = await board();
  const count = objects.size;
  failPutNumber = 2;
  putNumber = 0;
  try { expect((await request(editor, path, 'POST', multipart([png(), png('second.png')]))).status).toBe(503); }
  finally { failPutNumber = 0; }
  expect(objects.size).toBe(count);
  expect((await (await request(owner, path)).json() as { items: TaskComment[] }).items).toEqual([]);
});

test('a database commit failure rolls back the comment and cleans its uploaded image', async () => {
  const { path } = await board();
  const count = objects.size;
  await server.database.admin.query(`CREATE FUNCTION resources.reject_test_image_comment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test comment rollback'; END $$;
    CREATE CONSTRAINT TRIGGER reject_test_image_comment AFTER INSERT ON resources.task_comment DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.body = '__rollback_image_comment__') EXECUTE FUNCTION resources.reject_test_image_comment();`);
  try { expect((await request(editor, path, 'POST', multipart([png()], '__rollback_image_comment__'))).status).toBe(503); }
  finally { await server.database.admin.query('DROP TRIGGER reject_test_image_comment ON resources.task_comment; DROP FUNCTION resources.reject_test_image_comment();'); }
  expect(objects.size).toBe(count);
  expect((await (await request(owner, path)).json() as { items: TaskComment[] }).items).toEqual([]);
});

test('removing comments, tasks and boards cleans only their owned image objects after commit', async () => {
  const first = await board();
  const comment = await publish(first.path);
  const second = await board();
  const retained = await publish(second.path);
  const before = objects.size;
  expect((await request(viewer, `${first.path}/${comment.id}`, 'DELETE')).status).toBe(403);
  expect(objects.size).toBe(before);
  expect((await request(editor, `${first.path}/${comment.id}`, 'DELETE')).status).toBe(200);
  expect(objects.size).toBe(before - 1);
  expect((await request(owner, imagePath(first.path, comment))).status).toBe(404);
  const taskComment = await publish(first.path);
  expect((await request(editor, first.path.replace('/comments', ''), 'DELETE')).status).toBe(200);
  expect((await request(owner, imagePath(first.path, taskComment))).status).toBe(404);
  expect((await request(owner, imagePath(second.path, retained))).status).toBe(200);
  const boardBefore = objects.size;
  expect((await request(owner, `/${second.board.id}`, 'DELETE')).status).toBe(200);
  expect(objects.size).toBe(boardBefore - 1);
});

test('object cleanup failure does not turn a committed comment removal into a failed request', async () => {
  const { path } = await board();
  const comment = await publish(path);
  failDelete = true;
  try { expect((await request(editor, `${path}/${comment.id}`, 'DELETE')).status).toBe(200); }
  finally { failDelete = false; }
  expect((await request(owner, imagePath(path, comment))).status).toBe(404);
  for (const key of objects.keys()) if (key.includes(`/${comment.id}/`)) objects.delete(key);
});
