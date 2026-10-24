import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { ChannelSnapshot } from '@fouc/shared/chats';
import { createAuthTestServer, responseCookie, testPassword, type AuthTestServer } from '../../platform/identity/auth-test-server';
import type { S3ObjectStorage } from '../../platform/storage/s3';
import { createProjectRoutes } from '../projects/http';
import { createProjectService } from '../projects/service';
import { createChannelRoutes } from './http';
import { createChannelService } from './service';

let server: AuthTestServer;
type Actor = { cookie: string; userId: string };
let owner: Actor, member: Actor, outsider: Actor, projectId: string;
const objects = new Map<string, { bytes: Uint8Array; mime: string }>();
const storage: S3ObjectStorage = {
  async putObject(key, bytes, mime) { objects.set(key, { bytes, mime }); },
  async openObject(key) { const object = objects.get(key); if (!object) throw new Error('Missing test object'); return new Response(object.bytes.slice().buffer, { headers: { 'content-type': object.mime } }); },
  async deleteObject(key) { return objects.delete(key); },
  async statObject(key) { const value = objects.get(key); return value ? { size: value.bytes.length, mime: value.mime, etag: 'test' } : undefined; },
  presignUpload() { throw new Error('Not used'); }, presignDownload() { throw new Error('Not used'); },
};
async function actor(name: string): Promise<Actor> {
  const email = `${name}@channels.test`;
  expect((await server.request('/sign-up/email', { email, name, password: testPassword })).status).toBe(200);
  expect((await server.request(server.verificationPath(email))).status).toBe(302);
  const cookie = responseCookie(await server.request('/sign-in/email', { email, password: testPassword }));
  const identity = await (await fetch(`${server.origin}/test/identity`, { headers: { cookie } })).json() as { userId: string };
  return { cookie, userId: identity.userId };
}
function request(actor: Actor, path: string, method = 'GET', body?: unknown) {
  return fetch(`${server.origin}/api/projects/${projectId}/channels${path}`, {
    method, headers: { origin: server.webOrigin, cookie: actor.cookie, ...(method === 'GET' ? {} : { 'content-type': 'application/json' }) },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
}
async function create(name: string, memberIds: string[] = []) {
  const response = await request(owner, '', 'POST', { name, memberIds });
  expect(response.status).toBe(201);
  return response.json() as Promise<ChannelSnapshot>;
}
beforeAll(async () => {
  server = await createAuthTestServer({ mount(app, { auth, database }) {
    app.route('/', createProjectRoutes(auth, createProjectService(database.pool)));
    app.route('/', createChannelRoutes(auth, createChannelService(database.pool, storage)));
  } });
  owner = await actor('channel-owner'); member = await actor('channel-member'); outsider = await actor('channel-outsider');
  const response = await fetch(`${server.origin}/api/projects`, { method: 'POST', headers: { origin: server.webOrigin, cookie: owner.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Channel permissions' }) });
  expect(response.status).toBe(201);
  projectId = (await response.json() as { id: string }).id;
  await server.database.admin.query("INSERT INTO resources.project_member(project_id,user_id,role) VALUES ($1,$2,'member')", [projectId, member.userId]);
}, 30_000);
afterAll(async () => { await server?.close(); }, 30_000);

test('channels require project AND channel membership and reject injected authors or scope', async () => {
  const snapshot = await create('Private design'); const base = `/${snapshot.channel.id}`;
  expect((await request(member, base)).status).toBe(404);
  expect((await request(outsider, base)).status).toBe(404);
  expect((await request(owner, base, 'PATCH', { projectId, name: 'Injected' })).status).toBe(400);
  expect((await request(owner, `${base}/members`, 'POST', { userIds: [outsider.userId] })).status).toBe(400);
  expect((await request(owner, `${base}/members`, 'POST', { userIds: [member.userId] })).status).toBe(200);
  expect((await request(member, `${base}/messages`, 'POST', { body: 'Owned by member', authorId: owner.userId })).status).toBe(400);
  const sent = await (await request(member, `${base}/messages`, 'POST', { body: 'Owned by member' })).json() as ChannelSnapshot;
  expect(sent.messages[0]!.authorId).toBe(sent.actorId);
  expect((await request(owner, `${base}/messages/${sent.messages[0]!.id}`, 'PATCH', { body: 'Impersonated' })).status).toBe(403);
  expect((await request(member, base, 'PATCH', { name: 'No admin rights' })).status).toBe(403);
  const other = await create('Other channel');
  expect((await request(owner, `/${other.channel.id}/messages/${sent.messages[0]!.id}`, 'PATCH', { body: 'Cross channel' })).status).toBe(404);
});
test('message, thread, reaction, poll and channel settings retain permissions', async () => {
  let snapshot = await create('Discussion', [member.userId]); const base = `/${snapshot.channel.id}`;
  snapshot = await (await request(owner, `${base}/messages`, 'POST', { kind: 'topic', title: 'Release', body: 'Scope agreement' })).json() as ChannelSnapshot;
  const topicId = snapshot.messages[0]!.id;
  snapshot = await (await request(member, `${base}/messages`, 'POST', { body: 'Reply', threadId: topicId })).json() as ChannelSnapshot;
  expect(snapshot.messages[1]!.threadId).toBe(topicId);
  snapshot = await (await request(member, `${base}/messages/${topicId}/reactions`, 'POST', { emoji: '👍' })).json() as ChannelSnapshot;
  expect(snapshot.messages[0]!.reactions[0]!.userIds).toEqual([snapshot.actorId]);
  snapshot = await (await request(member, `${base}/messages/${topicId}/reactions`, 'POST', { emoji: '👍' })).json() as ChannelSnapshot;
  expect(snapshot.messages[0]!.reactions).toEqual([]);
  snapshot = await (await request(owner, `${base}/messages`, 'POST', { kind: 'poll', poll: { question: 'Which day?', options: ['Friday', 'Monday'] } })).json() as ChannelSnapshot;
  expect(snapshot.channel.lastMessage).toBe('Which day?');
  const poll = snapshot.messages.find(message => message.kind === 'poll')!;
  snapshot = await (await request(member, `${base}/messages/${poll.id}/votes`, 'POST', { optionId: poll.poll!.options[0]!.id })).json() as ChannelSnapshot;
  snapshot = await (await request(member, `${base}/messages/${poll.id}/votes`, 'POST', { optionId: poll.poll!.options[1]!.id })).json() as ChannelSnapshot;
  const voted = snapshot.messages.find(message => message.id === poll.id)!.poll!;
  expect(voted.options.map(option => option.voterIds.length)).toEqual([0, 1]);
  expect((await request(owner, `${base}/messages/${poll.id}`, 'PATCH', { closed: true })).status).toBe(200);
  expect((await request(member, `${base}/messages/${poll.id}/votes`, 'POST', { optionId: poll.poll!.options[0]!.id })).status).toBe(409);
  expect((await request(owner, base, 'PATCH', { permissions: { post: 'admins', invite: 'admins' } })).status).toBe(200);
  expect((await request(member, `${base}/messages`, 'POST', { body: 'Denied' })).status).toBe(403);
  expect((await request(member, `${base}/members`, 'POST', { userIds: [owner.userId] })).status).toBe(403);
});
test('Agent results are accepted only from their owner in an active channel', async () => {
  let snapshot = await create('Agent team', [member.userId]); const base = `/${snapshot.channel.id}`;
  snapshot = await (await request(member, `${base}/agents`, 'POST', { name: 'My Codex', installationId: 'local-codex' })).json() as ChannelSnapshot;
  const agent = snapshot.members.find(item => item.kind === 'agent')!;
  expect(agent.agentOwnerId).toBe(member.userId);
  expect((await request(owner, `${base}/agents/${agent.id}/messages`, 'POST', { body: 'Spoofed' })).status).toBe(403);
  snapshot = await (await request(member, `${base}/agents/${agent.id}/messages`, 'POST', { body: 'Real device result', execution: { sessionId: 'device-session', runId: 'device-run' } })).json() as ChannelSnapshot;
  expect(snapshot.messages[0]!.authorKind).toBe('agent'); expect(snapshot.messages[0]!.authorId).toBe(agent.id);
  const human = snapshot.members.find(item => item.userId === member.userId && item.kind === 'user')!;
  expect((await request(owner, `${base}/members/${human.id}`, 'DELETE')).status).toBe(200);
  expect((await request(member, `${base}/agents/${agent.id}/messages`, 'POST', { body: 'After removal' })).status).toBe(404);
});
test('channel roles cannot be escalated by members or assigned to Agent identities', async () => {
  let snapshot = await create('Role changes', [member.userId]); const base = `/${snapshot.channel.id}`;
  const participant = snapshot.members.find(item => item.userId === member.userId)!;
  expect((await request(member, `${base}/members/${participant.id}`, 'PATCH', { role: 'admin' })).status).toBe(403);
  expect((await request(owner, `${base}/members/${participant.id}`, 'PATCH', { role: 'admin' })).status).toBe(200);
  expect((await request(member, base, 'PATCH', { description: 'An admin can update channel settings.' })).status).toBe(200);
  expect((await request(member, base, 'DELETE')).status).toBe(403);
  snapshot = await (await request(member, `${base}/agents`, 'POST', { name: 'Agent', installationId: 'test-role-agent' })).json() as ChannelSnapshot;
  const agent = snapshot.members.find(item => item.kind === 'agent')!;
  expect((await request(owner, `${base}/members/${agent.id}`, 'PATCH', { role: 'admin' })).status).toBe(403);
  expect((await request(owner, `${base}/members/${snapshot.members.find(item => item.role === 'owner')!.id}`, 'DELETE')).status).toBe(403);
});
test('deleting a member-owned thread cannot silently orphan other people’s replies', async () => {
  let snapshot = await create('Thread ownership', [member.userId]); const base = `/${snapshot.channel.id}`;
  snapshot = await (await request(member, `${base}/messages`, 'POST', { kind: 'topic', title: 'A shared topic', body: 'Member root' })).json() as ChannelSnapshot;
  const rootId = snapshot.messages[0]!.id;
  expect((await request(owner, `${base}/messages`, 'POST', { body: 'Owner reply', threadId: rootId })).status).toBe(201);
  expect((await request(member, `${base}/messages/${rootId}`, 'DELETE')).status).toBe(403);
  snapshot = await (await request(owner, base)).json() as ChannelSnapshot;
  expect(snapshot.messages).toHaveLength(2);
  expect((await request(owner, `${base}/messages/${rootId}`, 'DELETE')).status).toBe(200);
  expect((await (await request(owner, base)).json() as ChannelSnapshot).messages).toHaveLength(0);
});
test('attachments become channel assets once, require membership and clean up with messages', async () => {
  const snapshot = await create('Files'); const base = `/${snapshot.channel.id}`;
  const form = new FormData(); form.set('input', JSON.stringify({ body: '' }));
  form.append('files', new File(['# Design\nA real document.'], 'design.md', { type: 'text/markdown' }));
  const sent = await fetch(`${server.origin}/api/projects/${projectId}/channels${base}/messages`, { method: 'POST', headers: { origin: server.webOrigin, cookie: owner.cookie }, body: form });
  expect(sent.status).toBe(201);
  const result = await sent.json() as ChannelSnapshot; const message = result.messages[0]!; const file = message.attachments[0]!;
  expect(result.channel.lastMessage).toBe('design.md');
  expect(file.name).toBe('design.md'); expect('objectKey' in file).toBe(false); expect(objects.size).toBe(1);
  expect((await (await request(owner, `${base}/assets`)).json() as { items: unknown[] }).items).toEqual([file]);
  const download = `${base}/messages/${message.id}/attachments/${file.id}`;
  expect((await request(member, download)).status).toBe(404);
  expect(await (await request(owner, download)).text()).toContain('# Design');
  expect((await request(owner, `${base}/messages/${message.id}`, 'DELETE')).status).toBe(200); expect(objects.size).toBe(0);
});
test('message pagination preserves messages with equal microsecond timestamps and channel scope', async () => {
  const snapshot = await create('History'); const base = `/${snapshot.channel.id}`;
  for (const body of ['First', 'Second', 'Third']) expect((await request(owner, `${base}/messages`, 'POST', { body })).status).toBe(201);
  await server.database.admin.query("UPDATE resources.chat_message SET created_at = '2026-10-24T01:00:00.000001Z' WHERE project_id=$1 AND channel_id=$2", [projectId, snapshot.channel.id]);
  const latest = await (await request(owner, `${base}/messages?limit=1`)).json() as { items: { id: string }[]; hasMore: boolean };
  const previous = await (await request(owner, `${base}/messages?limit=2&before=${latest.items[0]!.id}`)).json() as { items: { id: string }[]; hasMore: boolean };
  expect(latest.hasMore).toBe(true); expect(previous.hasMore).toBe(false); expect(previous.items).toHaveLength(2);
  expect(new Set([...previous.items, ...latest.items].map(message => message.id)).size).toBe(3);
  expect((await request(member, `${base}/messages?limit=1`)).status).toBe(404);
});
test('concurrent first reads of a project-visible channel create a single participant identity', async () => {
  const created = await request(owner, '', 'POST', { name: 'Open project channel', visibility: 'project' });
  expect(created.status).toBe(201);
  const channel = await created.json() as ChannelSnapshot;
  const responses = await Promise.all([request(member, `/${channel.channel.id}`), request(member, `/${channel.channel.id}`)]);
  expect(responses.map(response => response.status)).toEqual([200, 200]);
  const snapshot = await responses[1]!.json() as ChannelSnapshot;
  expect(snapshot.members.filter(participant => participant.userId === member.userId && participant.kind === 'user')).toHaveLength(1);
  expect((await request(outsider, `/${channel.channel.id}`)).status).toBe(404);
});
