import type { AppRuntime } from '@/lib/runtime-client';
import { KnowledgeDataError } from './errors';

/**
 * Knowledge API endpoint resolution (U01).
 *
 * - Desktop (Tauri shell): the local sidecar endpoint, asked from the Rust shell
 *   via the same `get_backend_endpoint` command as src/lib/backend.ts. The
 *   knowledge API authenticates with cookie sessions or PATs, so the sidecar
 *   token is intentionally not used here.
 * - Web (SaaS / private deployment): the API origin configured through
 *   `NEXT_PUBLIC_KNOWLEDGE_API_URL` (origin only, no path).
 * - Web dev fallback: the local sidecar `http://127.0.0.1:8710`. In production
 *   builds a missing configuration is a loud error, never a silent fallback.
 */

export const knowledgeApiUrlEnvName = 'NEXT_PUBLIC_KNOWLEDGE_API_URL';
export const knowledgeApiDevOrigin = 'http://127.0.0.1:8710';
export const knowledgeApiPathPrefix = '/api/knowledge';

const workspaceIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts an http(s) origin (optional trailing slash) and returns it in normalized origin form. */
export function parseKnowledgeApiOrigin(raw: string): string {
  const invalid = (reason: string) =>
    new KnowledgeDataError('ENDPOINT', { message: `Invalid knowledge API origin: ${reason} (got "${raw}")` });
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalid('not a URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw invalid('only http(s) origins are supported');
  if (url.username || url.password) throw invalid('credentials are not part of the origin');
  if (url.pathname !== '/' || url.search || url.hash) throw invalid('origin only, without path, query or fragment');
  return url.origin;
}

/** The tRPC transport URL for one workspace: `<origin>/api/knowledge/<workspaceId>/trpc` (A00 contract). */
export function knowledgeTrpcUrl(origin: string, workspaceId: string): string {
  if (!workspaceIdPattern.test(workspaceId)) {
    throw new KnowledgeDataError('INVALID_REQUEST', { message: 'workspaceId must be a UUID.' });
  }
  return `${parseKnowledgeApiOrigin(origin)}${knowledgeApiPathPrefix}/${workspaceId}/trpc`;
}

export type KnowledgeApiOrigin = { origin: string; source: 'sidecar' | 'configured' | 'dev' };

/** Injectable environment of the resolver; the browser binding is at the bottom of this module. */
export type KnowledgeEndpointDeps = {
  runtime: () => AppRuntime;
  invokeTauriCommand: (command: string) => Promise<unknown>;
  environmentUrl: () => string | undefined;
  isProduction: () => boolean;
};

export async function resolveKnowledgeApiOrigin(deps: KnowledgeEndpointDeps): Promise<KnowledgeApiOrigin> {
  const runtime = deps.runtime();
  if (runtime === 'server') {
    throw new KnowledgeDataError('ENDPOINT', { message: 'The knowledge API endpoint is only resolved in the browser.' });
  }
  if (runtime === 'tauri') {
    let raw: unknown;
    try {
      raw = await deps.invokeTauriCommand('get_backend_endpoint');
    } catch (cause) {
      throw new KnowledgeDataError('ENDPOINT', { message: 'The desktop sidecar endpoint could not be resolved.', cause });
    }
    const baseUrl = (raw as { baseUrl?: unknown } | null)?.baseUrl;
    if (typeof baseUrl !== 'string' || !baseUrl) {
      throw new KnowledgeDataError('ENDPOINT', { message: 'The desktop shell returned an invalid sidecar endpoint.' });
    }
    return { origin: parseKnowledgeApiOrigin(baseUrl), source: 'sidecar' };
  }
  const configured = deps.environmentUrl();
  if (configured !== undefined && configured !== '') {
    try {
      return { origin: parseKnowledgeApiOrigin(configured), source: 'configured' };
    } catch (cause) {
      throw new KnowledgeDataError('ENDPOINT', { message: `${knowledgeApiUrlEnvName} is not a valid API origin: "${configured}"`, cause });
    }
  }
  if (deps.isProduction()) {
    throw new KnowledgeDataError('ENDPOINT', { message: `Set ${knowledgeApiUrlEnvName} to the knowledge API origin of this deployment.` });
  }
  return { origin: knowledgeApiDevOrigin, source: 'dev' };
}

/** Memoizes resolution: the endpoint is fixed for the lifetime of the document. */
export function createKnowledgeOriginProvider(deps: KnowledgeEndpointDeps): () => Promise<KnowledgeApiOrigin> {
  let resolved: Promise<KnowledgeApiOrigin> | null = null;
  return () => (resolved ??= resolveKnowledgeApiOrigin(deps));
}

type TauriWindow = Window & { __TAURI__?: { core?: { invoke?: (command: string) => Promise<unknown> } } };

function tauriInvoke(): ((command: string) => Promise<unknown>) | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as TauriWindow).__TAURI__?.core?.invoke;
}

/** Same runtime detection as src/lib/runtime-client.ts; imported type-only to stay testable outside the browser. */
function browserRuntime(): AppRuntime {
  if (typeof window === 'undefined') return 'server';
  return tauriInvoke() ? 'tauri' : 'web';
}

const browserDeps: KnowledgeEndpointDeps = {
  runtime: browserRuntime,
  invokeTauriCommand: (command) => {
    const invoke = tauriInvoke();
    if (!invoke) return Promise.reject(new Error('Tauri invoke is unavailable.'));
    return invoke(command);
  },
  environmentUrl: () => process.env.NEXT_PUBLIC_KNOWLEDGE_API_URL,
  isProduction: () => process.env.NODE_ENV === 'production',
};

export const getKnowledgeApiOrigin = createKnowledgeOriginProvider(browserDeps);
