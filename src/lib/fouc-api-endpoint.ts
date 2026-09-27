import type { AppRuntime } from '@/lib/runtime-client';
class ApiEndpointError extends Error { readonly code = 'ENDPOINT'; }

/**
 * Shared Fouc API endpoint resolution.
 *
 * - Desktop (Tauri shell): the local sidecar endpoint, asked from the Rust shell
 *   via the same `get_backend_endpoint` command as src/lib/backend.ts. The
 *   knowledge API authenticates with cookie sessions or PATs, so the sidecar
 *   token is intentionally not used here.
 * - Web (SaaS / private deployment): the API origin configured through
 *   `NEXT_PUBLIC_FOUC_API_URL` (origin only, no path).
 * - Web dev fallback: the local sidecar `http://127.0.0.1:8710`. In production
 *   builds a missing configuration is a loud error, never a silent fallback.
 */

export const foucApiUrlEnvName = 'NEXT_PUBLIC_FOUC_API_URL';
export const foucApiDevOrigin = 'http://127.0.0.1:8710';

/** Accepts an http(s) origin (optional trailing slash) and returns it in normalized origin form. */
export function parseFoucApiOrigin(raw: string): string {
  const invalid = (reason: string) =>
    new ApiEndpointError(`Invalid Fouc API origin: ${reason} (got "${raw}")`);
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

export type FoucApiOrigin = { origin: string; source: 'sidecar' | 'configured' | 'dev' };

/** Injectable environment of the resolver; the browser binding is at the bottom of this module. */
export type FoucEndpointDeps = {
  runtime: () => AppRuntime;
  invokeTauriCommand: (command: string) => Promise<unknown>;
  environmentUrl: () => string | undefined;
  isProduction: () => boolean;
  browserOrigin?: () => string;
};

export async function resolveFoucApiOrigin(deps: FoucEndpointDeps): Promise<FoucApiOrigin> {
  const runtime = deps.runtime();
  if (runtime === 'server') {
    throw new ApiEndpointError('The Fouc API endpoint is only resolved in the browser.');
  }
  if (runtime === 'tauri') {
    let raw: unknown;
    try {
      raw = await deps.invokeTauriCommand('get_backend_endpoint');
    } catch {
      throw new ApiEndpointError('The desktop sidecar endpoint could not be resolved.');
    }
    const baseUrl = (raw as { baseUrl?: unknown } | null)?.baseUrl;
    if (typeof baseUrl !== 'string' || !baseUrl) {
      throw new ApiEndpointError('The desktop shell returned an invalid sidecar endpoint.');
    }
    return { origin: parseFoucApiOrigin(baseUrl), source: 'sidecar' };
  }
  const configured = deps.environmentUrl();
  if (configured !== undefined && configured !== '') {
    try {
      return { origin: sameSiteDevelopmentOrigin(parseFoucApiOrigin(configured), deps), source: 'configured' };
    } catch {
      throw new ApiEndpointError(`${foucApiUrlEnvName} is not a valid API origin: "${configured}"`);
    }
  }
  if (deps.isProduction()) {
    throw new ApiEndpointError(`Set ${foucApiUrlEnvName} to the Fouc API origin of this deployment.`);
  }
  return { origin: sameSiteDevelopmentOrigin(foucApiDevOrigin, deps), source: 'dev' };
}

/** Memoizes resolution: the endpoint is fixed for the lifetime of the document. */
export function createFoucOriginProvider(deps: FoucEndpointDeps): () => Promise<FoucApiOrigin> {
  let resolved: Promise<FoucApiOrigin> | null = null;
  return () => (resolved ??= resolveFoucApiOrigin(deps));
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

/** Loopback names are different cookie sites. All modules must share the browser's site in development. */
export function sameSiteDevelopmentOrigin(origin: string, deps: Pick<FoucEndpointDeps, 'isProduction' | 'browserOrigin'>): string {
  if (deps.isProduction() || !deps.browserOrigin) return origin;
  const api = new URL(origin);
  const browser = new URL(deps.browserOrigin());
  const loopback = new Set(['localhost', '127.0.0.1']);
  if (api.protocol === browser.protocol && loopback.has(api.hostname) && loopback.has(browser.hostname)) api.hostname = browser.hostname;
  return api.origin;
}

const browserDeps: FoucEndpointDeps = {
  runtime: browserRuntime,
  invokeTauriCommand: (command) => {
    const invoke = tauriInvoke();
    if (!invoke) return Promise.reject(new Error('Tauri invoke is unavailable.'));
    return invoke(command);
  },
  environmentUrl: () => process.env.NEXT_PUBLIC_FOUC_API_URL,
  browserOrigin: () => window.location.origin,
  isProduction: () => process.env.NODE_ENV === 'production',
};

export const getFoucApiOrigin = createFoucOriginProvider(browserDeps);
