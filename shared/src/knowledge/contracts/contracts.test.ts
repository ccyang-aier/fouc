import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  actorSchema, assetSourceSchema, createPageInputSchema, databaseDefinitionSchema, movePageInputSchema,
  outboxEventSchema, pageSchema, principal, principalSchema, queryDatabaseInputSchema,
  transcriptSegmentSchema, updatePageInputSchema, uploadIntentSchema, workspaceEventSchema,
} from './index';

const id = '01991428-716d-7453-8d22-f8dc8e0a9081';
const workspaceId = '01991428-716d-7453-8d22-f8dc8e0a9082';
const teamspaceId = '01991428-716d-7453-8d22-f8dc8e0a9083';
const other = '01991428-716d-7453-8d22-f8dc8e0a9084';
const page = { id, workspaceId, teamspaceId, kind: 'doc', parentId: null, databaseId: null, title: '设计' };
const occurredAt = '2026-09-26T00:00:00.000Z';

test('offline-created metadata has validated IDs and never accepts body or actor injection', () => {
  assert.equal(createPageInputSchema.parse(page).inheritsPermissions, true);
  for (const extra of [{ content: 'second source' }, { createdBy: other }, { actor: { userId: other } }]) {
    assert.equal(createPageInputSchema.safeParse({ ...page, ...extra }).success, false);
  }
  assert.equal(createPageInputSchema.safeParse({ ...page, workspaceId: 'other' }).success, false);
  assert.equal(createPageInputSchema.safeParse({ ...page, workspaceId: undefined }).success, false);
});

test('page kinds and parent/database identities cannot contradict the domain', () => {
  for (const change of [{ kind: 'row' }, { databaseId: other }, { parentId: id }, { kind: 'row', databaseId: id }]) {
    assert.equal(createPageInputSchema.safeParse({ ...page, ...change }).success, false);
  }
  assert.equal(createPageInputSchema.parse({ ...page, kind: 'row', databaseId: other }).kind, 'row');
  assert.equal(movePageInputSchema.safeParse({ workspaceId, pageId: id, parentId: id, teamspaceId, afterPageId: null, operationId: other }).success, false);
});

test('metadata reads use a single page shape without hidden body fields', () => {
  const value = { ...createPageInputSchema.parse(page), position: 'a0', path: `p_${id.replaceAll('-', '')}`, createdBy: other, createdAt: occurredAt, updatedAt: occurredAt, deletedAt: null };
  const { afterPageId: _after, ...record } = value;
  assert.equal(pageSchema.parse(record).title, '设计');
  assert.equal(updatePageInputSchema.safeParse({ workspaceId, pageId: id }).success, false);
  assert.equal(updatePageInputSchema.safeParse({ workspaceId, pageId: id, title: '', kind: 'row' }).success, false);
});

test('principals and actor variants cannot impersonate arbitrary namespaces', () => {
  for (const kind of ['user', 'group', 'workspace', 'link'] as const) assert.equal(principal(kind, id), `${kind}:${id}`);
  for (const value of [`root:${id}`, `user:${id}:full`, 'user:*', 'user:']) assert.equal(principalSchema.safeParse(value).success, false);
  assert.equal(actorSchema.safeParse({ kind: 'agent', userId: id }).success, false);
  assert.equal(actorSchema.safeParse({ kind: 'mcp', userId: id, taskId: other, clientName: 'Cursor' }).success, true);
});

test('database definitions reject duplicate fields, malformed options and unsafe property keys', () => {
  const property = { id: 'status', name: '状态', type: 'select', options: [{ id: 'todo', label: '待办', color: 'gray' }] };
  assert.equal(databaseDefinitionSchema.safeParse({ workspaceId, pageId: id, properties: [property] }).success, true);
  assert.equal(databaseDefinitionSchema.safeParse({ workspaceId, pageId: id, properties: [property, property] }).success, false);
  assert.equal(databaseDefinitionSchema.safeParse({ workspaceId, pageId: id, properties: [{ ...property, options: undefined }] }).success, false);
  assert.equal(createPageInputSchema.safeParse({ ...page, properties: { constructor: 'unsafe' } }).success, false);
  assert.equal(queryDatabaseInputSchema.parse({ workspaceId, databaseId: id }).limit, 50);
  assert.equal(queryDatabaseInputSchema.safeParse({ workspaceId, databaseId: id, filters: [{ propertyId: 'status', operator: 'eq' }] }).success, false);
});

test('events are scoped and cannot nest a different workspace', () => {
  const event = { id, workspaceId, type: 'page.moved', ids: [other], occurredAt };
  assert.equal(workspaceEventSchema.safeParse(event).success, true);
  assert.equal(workspaceEventSchema.safeParse({ ...event, type: 'unknown' }).success, false);
  assert.equal(outboxEventSchema.safeParse({ workspaceId: teamspaceId, topic: 'workspace.event', event }).success, false);
});

test('assets and timed transcripts reject malformed addresses and invalid durations', () => {
  assert.equal(assetSourceSchema.safeParse(`asset:${'a'.repeat(64)}`).success, true);
  assert.equal(assetSourceSchema.safeParse('asset:../other-tenant').success, false);
  assert.equal(uploadIntentSchema.safeParse({ workspaceId, hash: 'a'.repeat(64), mime: 'image/png', size: 12, name: 'diagram.png' }).success, true);
  assert.equal(uploadIntentSchema.safeParse({ workspaceId, hash: 'a'.repeat(64), mime: 'image/png', size: -1, name: 'diagram.png' }).success, false);
  assert.equal(transcriptSegmentSchema.safeParse({ start: 5, end: 3, text: 'bad' }).success, false);
});
