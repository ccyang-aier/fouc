import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { createPermissionsFixture, type PermissionsFixture } from '../permissions/permissions-test-fixture';

let fixture: PermissionsFixture;
beforeAll(async () => { fixture = await createPermissionsFixture(); }, 30_000);
afterAll(async () => { await fixture?.close(); }, 30_000);

test('multiple knowledge bases belong to one workspace and creation does not create workspaces', async () => {
  const { organization, owner, alpha } = fixture;
  const before = await organization.listWorkspaces(owner.identity, {});
  const first = await organization.createKnowledgeBase(owner.identity, { workspaceId: alpha.id, name: '资料库' });
  const second = await organization.createKnowledgeBase(owner.identity, { workspaceId: alpha.id, name: '设计库' });
  expect(first.workspaceId).toBe(alpha.id);
  expect(first.id).not.toBe(alpha.id);
  expect(first.id).not.toBe(second.id);
  expect(await organization.listWorkspaces(owner.identity, {})).toEqual(before);
  const bases = await organization.listKnowledgeBases(owner.identity, { workspaceId: alpha.id });
  expect(bases.items).toContainEqual(first);
  expect(bases.items).toContainEqual(second);
  const folders = await organization.listTeamspaces(owner.identity, { workspaceId: alpha.id, knowledgeBaseId: first.id });
  expect(folders.items).toHaveLength(1);
  expect(folders.items[0]).toMatchObject({ workspaceId: alpha.id, knowledgeBaseId: first.id, name: '文档' });
  const secondFolders = await organization.listTeamspaces(owner.identity, { workspaceId: alpha.id, knowledgeBaseId: second.id });
  expect(secondFolders.items.map((folder) => folder.id)).not.toContain(folders.items[0]!.id);
});

test('foreign knowledge bases and missing knowledge base IDs fail before folder creation', async () => {
  const { organization, owner, alpha, betaKnowledgeBase, foreign, beta } = fixture;
  const base = await organization.createKnowledgeBase(owner.identity, { workspaceId: alpha.id, name: '隔离资料' });
  await expect(organization.createTeamspace(owner.identity, { workspaceId: alpha.id, knowledgeBaseId: betaKnowledgeBase.id, name: '跨空间' })).rejects.toMatchObject({ code: 'KNOWLEDGE_BASE_NOT_FOUND' });
  await expect(organization.createTeamspace(owner.identity, { workspaceId: alpha.id, knowledgeBaseId: randomUUID(), name: '缺失' })).rejects.toMatchObject({ code: 'KNOWLEDGE_BASE_NOT_FOUND' });
  await expect(organization.createTeamspace(owner.identity, { workspaceId: alpha.id, name: '无归属' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  expect((await organization.listKnowledgeBases(foreign.identity, { workspaceId: beta.id })).items.some((item) => item.id === base.id)).toBe(false);
  await expect(organization.listKnowledgeBases(owner.identity, { workspaceId: beta.id })).rejects.toMatchObject({ code: 'WORKSPACE_NOT_FOUND' });
  await expect(organization.createKnowledgeBase(fixture.reader.identity, { workspaceId: alpha.id, name: '无管理权限' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
});

test('REST directory and knowledge base filtering use the explicit workspace boundary', async () => {
  const { server, alpha, owner } = fixture;
  const headers = { cookie: owner.cookie, origin: server.webOrigin, 'content-type': 'application/json' };
  const created = await fetch(`${server.origin}/api/workspaces/${alpha.id}/knowledge-bases`, { method: 'POST', headers, body: JSON.stringify({ name: 'HTTP 资料库' }) });
  expect(created.status).toBe(201);
  const base = await created.json() as { id: string };
  const response = await fetch(`${server.origin}/api/workspaces/${alpha.id}/teamspaces?knowledgeBaseId=${base.id}`, { headers });
  expect(response.status).toBe(200);
  const folders = await response.json() as { items: { knowledgeBaseId: string }[] };
  expect(folders.items).toHaveLength(1);
  expect(folders.items.every((folder) => folder.knowledgeBaseId === base.id)).toBe(true);
  expect((await fetch(`${server.origin}/api/workspaces/${alpha.id}/knowledge-bases`, { headers: { origin: server.webOrigin } })).status).toBe(401);
});
