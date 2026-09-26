import { describe, expect, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import { invalidationSegmentsForEvent } from '../collaboration/workspace-events';
import { knowledgeQueryKeys } from './query-keys';
import { knowledgeKeysForSegments, knowledgeKeyForSegment, knowledgeWorkspaceRootKey } from './invalidation';

const workspaceId = '0b0a6e26-0000-4000-8000-2fd4c1c1f001';

describe('knowledgeKeyForSegment', () => {
  test('maps every B06 event segment onto its U01 key', () => {
    expect(knowledgeKeyForSegment(workspaceId, ['pages'])).toEqual(knowledgeQueryKeys.pages(workspaceId));
    expect(knowledgeKeyForSegment(workspaceId, ['access'])).toEqual(knowledgeQueryKeys.access(workspaceId));
    expect(knowledgeKeyForSegment(workspaceId, ['comments'])).toEqual(knowledgeQueryKeys.comments(workspaceId));
    expect(knowledgeKeyForSegment(workspaceId, ['notifications'])).toEqual(knowledgeQueryKeys.notifications(workspaceId));
    expect(knowledgeKeyForSegment(workspaceId, ['databases'])).toEqual(knowledgeQueryKeys.databases(workspaceId));
    expect(knowledgeKeyForSegment(workspaceId, ['assets'])).toEqual(knowledgeQueryKeys.assets(workspaceId));
    expect(knowledgeKeyForSegment(workspaceId, ['aiTasks'])).toEqual(knowledgeQueryKeys.aiTasks(workspaceId));
  });

  test('unknown or nested segments fail safe to the workspace root key', () => {
    expect(knowledgeKeyForSegment(workspaceId, ['unknown'])).toEqual(knowledgeQueryKeys.workspace(workspaceId));
    expect(knowledgeKeyForSegment(workspaceId, ['pages', 'extra'])).toEqual(knowledgeQueryKeys.workspace(workspaceId));
    expect(knowledgeKeyForSegment(workspaceId, [])).toEqual(knowledgeQueryKeys.workspace(workspaceId));
  });
});

describe('knowledgeKeysForSegments', () => {
  test('deduplicates overlapping segments of one event', () => {
    expect(knowledgeKeysForSegments(workspaceId, [['pages'], ['access'], ['pages']])).toEqual([
      knowledgeQueryKeys.pages(workspaceId),
      knowledgeQueryKeys.access(workspaceId),
    ]);
  });

  test('covers every segment the B06 contract can emit', () => {
    const eventTypes = [
      'page.created', 'page.updated', 'page.moved', 'page.deleted', 'acl.changed',
      'comment.changed', 'notification.created', 'database.rows.changed', 'asset.updated', 'ai.task.changed',
    ] as const;
    for (const type of eventTypes) {
      const keys = knowledgeKeysForSegments(workspaceId, invalidationSegmentsForEvent({ type }));
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(key[0]).toBe(workspaceId);
      }
    }
  });

  test('an empty segment list invalidates nothing', () => {
    expect(knowledgeKeysForSegments(workspaceId, [])).toEqual([]);
  });
});

describe('workspace-scope invalidation on a real QueryClient', () => {
  test('page events invalidate the pages and access keys of this workspace only', async () => {
    const queryClient = new QueryClient();
    const otherWorkspace = '11111111-2222-4333-8444-555555555555';
    queryClient.setQueryData(knowledgeQueryKeys.pages(workspaceId), []);
    queryClient.setQueryData(knowledgeQueryKeys.access(workspaceId), null);
    queryClient.setQueryData(knowledgeQueryKeys.comments(workspaceId), []);
    queryClient.setQueryData(knowledgeQueryKeys.pages(otherWorkspace), []);

    for (const key of knowledgeKeysForSegments(workspaceId, invalidationSegmentsForEvent({ type: 'page.updated' }))) {
      await queryClient.invalidateQueries({ queryKey: key });
    }

    expect(queryClient.getQueryState(knowledgeQueryKeys.pages(workspaceId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(knowledgeQueryKeys.access(workspaceId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(knowledgeQueryKeys.comments(workspaceId))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(knowledgeQueryKeys.pages(otherWorkspace))?.isInvalidated).toBe(false);
  });

  test('the reconnect root key invalidates every cached key of the workspace', async () => {
    const queryClient = new QueryClient();
    for (const key of [knowledgeQueryKeys.pages(workspaceId), knowledgeQueryKeys.aiTasks(workspaceId)]) {
      queryClient.setQueryData(key, []);
    }
    await queryClient.invalidateQueries({ queryKey: knowledgeWorkspaceRootKey(workspaceId) });
    expect(queryClient.getQueryState(knowledgeQueryKeys.pages(workspaceId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(knowledgeQueryKeys.aiTasks(workspaceId))?.isInvalidated).toBe(true);
  });
});
