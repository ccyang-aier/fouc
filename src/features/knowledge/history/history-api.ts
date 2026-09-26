/**
 * History panel API client (V03): the checkpoint surface is a plain session
 * route (`/api/knowledge/:ws/pages/:page/checkpoints`), not tRPC — the same
 * native-fetch seam as the organization client. P03 is enforced per request
 * server-side; the client maps failures to the structured data-layer codes.
 */

import { getKnowledgeApiOrigin } from '../data/endpoint';
import { KnowledgeDataError } from '../data/errors';

export interface PageCheckpointEntry {
  checkpointId: string;
  pageId: string;
  label: string | null;
  authors: string[];
  createdAt: string;
}

export interface PageCheckpointPreview extends PageCheckpointEntry {
  /** ProseMirror document JSON of the checkpointed body. */
  body: unknown;
}

export type NamedCheckpointResult = { outcome: 'created' | 'labeled'; checkpointId: string };

export type HistoryApiDeps = {
  resolveOrigin: () => Promise<{ origin: string }>;
  fetchImpl: typeof fetch;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Minimal shape check: the panel never renders an unvalidated body. */
export function parseCheckpointList(body: unknown): PageCheckpointEntry[] {
  if (!isRecord(body) || !Array.isArray(body.checkpoints)) return [];
  return body.checkpoints.flatMap((entry): PageCheckpointEntry[] => {
    if (!isRecord(entry) || typeof entry.checkpointId !== 'string' || typeof entry.createdAt !== 'string') return [];
    if (entry.label !== null && typeof entry.label !== 'string') return [];
    if (!Array.isArray(entry.authors) || entry.authors.some((author) => typeof author !== 'string')) return [];
    return [{ checkpointId: entry.checkpointId, pageId: String(entry.pageId ?? ''), label: entry.label as string | null, authors: entry.authors as string[], createdAt: entry.createdAt }];
  });
}

export function createHistoryApi(deps: HistoryApiDeps = { resolveOrigin: getKnowledgeApiOrigin, fetchImpl: fetch }) {
  async function request<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
    const { origin } = await deps.resolveOrigin();
    const response = await deps.fetchImpl(`${origin}${path}`, {
      method: init.method ?? 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (!response.ok) {
      const code = await response.json().then((payload) => (isRecord(payload) && typeof payload.code === 'string' ? payload.code : undefined)).catch(() => undefined);
      throw new KnowledgeDataError(response.status === 404 ? 'NOT_FOUND' : response.status === 403 ? 'FORBIDDEN' : 'UNAVAILABLE', { message: code ? `历史版本请求失败（${code}）` : '历史版本请求失败。' });
    }
    return (await response.json()) as T;
  }
  const base = (workspaceId: string, pageId: string) => `/api/knowledge/${workspaceId}/pages/${pageId}/checkpoints`;
  return {
    list(workspaceId: string, pageId: string): Promise<{ checkpoints: PageCheckpointEntry[] }> {
      return request<unknown>(base(workspaceId, pageId)).then((payload) => ({ checkpoints: parseCheckpointList(payload) }));
    },
    preview(workspaceId: string, pageId: string, checkpointId: string): Promise<PageCheckpointPreview> {
      return request<PageCheckpointPreview>(`${base(workspaceId, pageId)}/${checkpointId}`);
    },
    name(workspaceId: string, pageId: string, label: string): Promise<NamedCheckpointResult> {
      return request<NamedCheckpointResult>(base(workspaceId, pageId), { method: 'POST', body: { label } });
    },
  };
}

export type HistoryApi = ReturnType<typeof createHistoryApi>;
