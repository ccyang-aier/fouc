import { describe, expect, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import { invalidateKnowledgeQueries } from './query-client';
import { knowledgeQueryKeys } from './query-keys';

const alpha = '10000000-0000-4000-8000-000000000000';
const beta = '30000000-0000-4000-8000-000000000000';

describe('knowledgeQueryKeys', () => {
  test('the workspaceId is the top-level namespace of every key', () => {
    expect(knowledgeQueryKeys.workspace(alpha)).toEqual([alpha, 'knowledge']);
    expect(knowledgeQueryKeys.access(alpha)).toEqual([alpha, 'knowledge', 'access']);
    expect(knowledgeQueryKeys.access(beta)).toEqual([beta, 'knowledge', 'access']);
  });

  test('workspace keys of different workspaces never collide', () => {
    expect(knowledgeQueryKeys.workspace(alpha)).not.toEqual(knowledgeQueryKeys.workspace(beta));
  });
});

describe('invalidateKnowledgeQueries', () => {
  test('invalidating the workspace namespace covers its fine-grained keys only for that workspace', async () => {
    const client = new QueryClient();
    client.setQueryData(knowledgeQueryKeys.access(alpha), { workspaceId: alpha });
    client.setQueryData(knowledgeQueryKeys.access(beta), { workspaceId: beta });

    await invalidateKnowledgeQueries(client, knowledgeQueryKeys.workspace(alpha));

    expect(client.getQueryState(knowledgeQueryKeys.access(alpha))?.isInvalidated).toBe(true);
    expect(client.getQueryState(knowledgeQueryKeys.access(beta))?.isInvalidated).toBe(false);
  });

  test('fine-grained invalidation stays inside one key', async () => {
    const client = new QueryClient();
    client.setQueryData(knowledgeQueryKeys.access(alpha), { workspaceId: alpha });
    client.setQueryData(knowledgeQueryKeys.access(beta), { workspaceId: beta });

    await invalidateKnowledgeQueries(client, knowledgeQueryKeys.access(alpha));

    expect(client.getQueryState(knowledgeQueryKeys.access(alpha))?.isInvalidated).toBe(true);
    expect(client.getQueryState(knowledgeQueryKeys.access(beta))?.isInvalidated).toBe(false);
  });
});
