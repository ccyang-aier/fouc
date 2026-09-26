'use client';

/**
 * Page-tree client surface (U03) on the U01 tRPC transport.
 *
 * The shared contracts own every input shape (`listPagesInputSchema`,
 * `createPageInputSchema`, …) and every output shape (`pageSchema`,
 * `pagePlacementSchema`, `pageLifecycleStateSchema`); the HTTP routes are
 * mounted by the API task, so until then each call fails honestly with the
 * transport's NOT_FOUND — never with fabricated data.
 *
 * The U01 router type does not list these procedures yet, so the calls go
 * through the tRPC client's dynamic `query`/`mutate` entry points and every
 * response is re-validated with the shared zod schemas at the boundary: the
 * type safety here comes from the contracts, not from trust in the wire.
 * Tests inject the transport through the same factory seam the organization
 * client uses (origin resolver + fetch implementation).
 */

import {
  createPageInputSchema,
  movePageInputSchema,
  pageLifecycleStateSchema,
  pagePlacementSchema,
  pageSchema,
  recyclePageInputSchema,
  restorePageInputSchema,
  updatePageInputSchema,
} from '@fouc/shared/knowledge/contracts';
import type { CreatePageInput, Page, PageLifecycleState, PagePlacement } from '@fouc/shared/knowledge/contracts';
import { getKnowledgeApiOrigin } from './endpoint';
import { KnowledgeDataError, normalizeKnowledgeError } from './errors';
import { createKnowledgeUntypedClientCache, type KnowledgeFetch, type KnowledgeUntypedTrpcClient } from './trpc-client';

// The shared barrel re-exports the zod schemas as values, so the page surface
// validates at runtime through the very contracts the server enforces —
// without adding zod to the browser bundle as a direct dependency.
const pageListResultSchema = pageSchema.array();

/** A response the shared contracts reject is an unavailable service, never data to render. */
function parsePagePayload<T>(schema: { safeParse(payload: unknown): { success: true; data: T } | { success: false } }, payload: unknown, procedure: string): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new KnowledgeDataError('UNAVAILABLE', { message: `页面树服务 ${procedure} 返回的数据不符合契约。` });
  }
  return parsed.data;
}

/** The shared input schemas mirror client-side: a programmer error fails fast as INVALID_REQUEST. */
function assertPageInput(schema: { safeParse(payload: unknown): { success: true } | { success: false } }, input: unknown, procedure: string): void {
  if (!schema.safeParse(input).success) {
    throw new KnowledgeDataError('INVALID_REQUEST', { message: `${procedure} 的输入不符合页面树契约。` });
  }
}

export type ListKnowledgePagesInput = { teamspaceId?: string; parentId?: string | null };

export type CreateKnowledgePageInput = CreatePageInput;
/** Mirror of `updatePageInputSchema` (the shared barrel exports no inferred type for it). */
export type UpdateKnowledgePageInput = { pageId: string; title?: string; icon?: string | null; cover?: string | null };
export type RecycleKnowledgePageInput = { pageId: string };
export type RestoreKnowledgePageInput = { pageId: string };
export type MoveKnowledgePageInput = {
  pageId: string;
  parentId: string | null;
  teamspaceId: string;
  afterPageId: string | null;
  operationId: string;
};

export type KnowledgePagesApi = {
  listPages(workspaceId: string, input?: ListKnowledgePagesInput, signal?: AbortSignal): Promise<Page[]>;
  createPage(workspaceId: string, input: CreateKnowledgePageInput, signal?: AbortSignal): Promise<PagePlacement>;
  updatePage(workspaceId: string, input: UpdateKnowledgePageInput, signal?: AbortSignal): Promise<Page>;
  movePage(workspaceId: string, input: MoveKnowledgePageInput, signal?: AbortSignal): Promise<PagePlacement>;
  recyclePage(workspaceId: string, input: RecycleKnowledgePageInput, signal?: AbortSignal): Promise<PageLifecycleState>;
  restorePage(workspaceId: string, input: RestoreKnowledgePageInput, signal?: AbortSignal): Promise<PageLifecycleState>;
};

/** Builds the page surface over one transport: an origin resolver plus a fetch implementation. */
export function createKnowledgePagesApi(deps: { resolveOrigin: () => Promise<string> | string; fetchImpl?: KnowledgeFetch }): KnowledgePagesApi {
  const cache = createKnowledgeUntypedClientCache(deps.fetchImpl);
  const run = async <T,>(workspaceId: string, signal: AbortSignal | undefined, invoke: (client: KnowledgeUntypedTrpcClient) => Promise<T>): Promise<T> => {
    try {
      const origin = await deps.resolveOrigin();
      return await invoke(cache.get(origin, workspaceId));
    } catch (cause) {
      throw normalizeKnowledgeError(cause, signal);
    }
  };

  return {
    async listPages(workspaceId, input = {}, signal) {
      const payload = await run(workspaceId, signal, (client) =>
        client.query('page.list', { workspaceId, ...input }, { signal }),
      );
      return parsePagePayload(pageListResultSchema, payload, 'page.list');
    },
    async createPage(workspaceId, input, signal) {
      assertPageInput(createPageInputSchema, input, 'page.create');
      const payload = await run(workspaceId, signal, (client) => client.mutation('page.create', input, { signal }));
      return parsePagePayload(pagePlacementSchema, payload, 'page.create');
    },
    async updatePage(workspaceId, input, signal) {
      assertPageInput(updatePageInputSchema, { ...input, workspaceId }, 'page.update');
      const payload = await run(workspaceId, signal, (client) => client.mutation('page.update', { workspaceId, ...input }, { signal }));
      return parsePagePayload(pageSchema, payload, 'page.update');
    },
    async movePage(workspaceId, input, signal) {
      assertPageInput(movePageInputSchema, { ...input, workspaceId }, 'page.move');
      const payload = await run(workspaceId, signal, (client) => client.mutation('page.move', { workspaceId, ...input }, { signal }));
      return parsePagePayload(pagePlacementSchema, payload, 'page.move');
    },
    async recyclePage(workspaceId, input, signal) {
      assertPageInput(recyclePageInputSchema, { ...input, workspaceId }, 'page.recycle');
      const payload = await run(workspaceId, signal, (client) => client.mutation('page.recycle', { workspaceId, ...input }, { signal }));
      return parsePagePayload(pageLifecycleStateSchema, payload, 'page.recycle');
    },
    async restorePage(workspaceId, input, signal) {
      assertPageInput(restorePageInputSchema, { ...input, workspaceId }, 'page.restore');
      const payload = await run(workspaceId, signal, (client) => client.mutation('page.restore', { workspaceId, ...input }, { signal }));
      return parsePagePayload(pageLifecycleStateSchema, payload, 'page.restore');
    },
  };
}

/** The browser binding: the U01 endpoint resolver plus the global fetch. */
export const knowledgePagesApi = createKnowledgePagesApi({
  resolveOrigin: async () => (await getKnowledgeApiOrigin()).origin,
});

// The names the tree operations controller consumes; one module reads as the
// complete page read/write surface.
export const fetchKnowledgePages = knowledgePagesApi.listPages;
export const createKnowledgePage = knowledgePagesApi.createPage;
export const updateKnowledgePage = knowledgePagesApi.updatePage;
export const moveKnowledgePage = knowledgePagesApi.movePage;
export const recycleKnowledgePage = knowledgePagesApi.recyclePage;
export const restoreKnowledgePage = knowledgePagesApi.restorePage;
