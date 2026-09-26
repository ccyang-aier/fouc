import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { TRPCClient } from '@trpc/client';
import type { KnowledgeApiRouter } from './api-types';
import { getKnowledgeApiOrigin, knowledgeTrpcUrl } from './endpoint';
import { normalizeKnowledgeError } from './errors';

/**
 * Typed tRPC client factory for the knowledge API (U01).
 *
 * Every procedure call is typed by the backend's `KnowledgeApiRouter`; no URL
 * is ever hand-written beyond the single `knowledgeTrpcUrl` contract helper.
 * The transport honors the A00 limits (batch of at most 10 calls, URL of at
 * most 8 KiB) and always sends cookies (`credentials: 'include'`), which is
 * the session credential for browser clients.
 */

export type KnowledgeTrpcClient = TRPCClient<KnowledgeApiRouter>;
export type KnowledgeFetch = typeof fetch;

export function createKnowledgeTrpcClient(origin: string, workspaceId: string, fetchImpl: KnowledgeFetch = fetch): KnowledgeTrpcClient {
  return createTRPCClient<KnowledgeApiRouter>({
    links: [
      httpBatchLink({
        url: knowledgeTrpcUrl(origin, workspaceId),
        maxItems: 10,
        maxURLLength: 8192,
        fetch: (input, init) => fetchImpl(input, { ...init, credentials: 'include' }),
      }),
    ],
  });
}

/** One client per (origin, workspace) transport URL; per-call state travels in options, not in the client. */
export function createKnowledgeClientCache(fetchImpl: KnowledgeFetch = fetch) {
  const clients = new Map<string, KnowledgeTrpcClient>();
  return {
    get(origin: string, workspaceId: string): KnowledgeTrpcClient {
      const url = knowledgeTrpcUrl(origin, workspaceId);
      let client = clients.get(url);
      if (!client) {
        client = createKnowledgeTrpcClient(origin, workspaceId, fetchImpl);
        clients.set(url, client);
      }
      return client;
    },
  };
}

const clientCache = createKnowledgeClientCache();

export async function getKnowledgeTrpcClient(workspaceId: string): Promise<KnowledgeTrpcClient> {
  const { origin } = await getKnowledgeApiOrigin();
  return clientCache.get(origin, workspaceId);
}

/**
 * Runs one API call with the layer's uniform error and cancellation semantics:
 * endpoint failures and tRPC/network failures normalize to `KnowledgeDataError`,
 * while an already-aborted `signal` keeps the original cause so the query
 * layer recognizes its own cancellation. `call` must forward `signal` into the
 * tRPC request options.
 */
export async function runKnowledgeCall<T>(
  workspaceId: string,
  signal: AbortSignal | undefined,
  call: (client: KnowledgeTrpcClient) => Promise<T>,
): Promise<T> {
  try {
    const client = await getKnowledgeTrpcClient(workspaceId);
    return await call(client);
  } catch (cause) {
    throw normalizeKnowledgeError(cause, signal);
  }
}
