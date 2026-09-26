/**
 * Session recovery seam (A04).
 *
 * Consumers of the knowledge data layer treat an UNAUTHENTICATED (401)
 * outcome as "session expired": save where the user was, send them to the
 * sign-in entry, and after a successful sign-in the entry restores that
 * target (`returnTo`). Sign-out revokes the server session first, then
 * clears local artifacts and returns to the entry via a full navigation —
 * the document reload also drops every in-memory query cache.
 */

import { isKnowledgeDataError } from '../data/errors';
import { knowledgeAuthApi, type KnowledgeAuthApi, type KnowledgeAuthUser } from './auth-api';
import { clearAuthLocalState, currentLocationReturnTo, saveAuthReturnTo } from './return-to';

export const authEntryPath = '/auth';

export type SignInEntryReason = 'expired' | 'signed-out';

export function buildAuthEntryUrl(reason?: SignInEntryReason): string {
  return reason ? `${authEntryPath}?reason=${reason}` : authEntryPath;
}

/** True for the data layer's 401 outcomes (code UNAUTHENTICATED or HTTP 401). */
export function isUnauthorizedKnowledgeError(error: unknown): boolean {
  return isKnowledgeDataError(error) && (error.code === 'UNAUTHENTICATED' || error.httpStatus === 401);
}

/**
 * Session-expiry entry point for knowledge data consumers: preserves the
 * current in-app location as the post-login target and navigates top-level
 * to the sign-in page. Pure logic around it (`returnTo` storage, the entry
 * URL) is covered by tests; wiring into the app shell belongs to Z03.
 */
export function redirectToKnowledgeSignIn(reason: SignInEntryReason = 'expired'): void {
  if (typeof window === 'undefined') return;
  saveAuthReturnTo(window.sessionStorage, currentLocationReturnTo(window.location.pathname, window.location.search));
  window.location.assign(buildAuthEntryUrl(reason));
}

export type KnowledgeSignOutResult = { ok: true } | { ok: false; cause: unknown };

/**
 * Revokes the Fouc session (`POST /api/auth/sign-out`) and clears local auth
 * artifacts. A failed revocation is reported honestly — the cookie session
 * may still be alive — while local state is still cleared.
 */
export async function performKnowledgeSignOut(options: {
  api?: KnowledgeAuthApi;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
} = {}): Promise<KnowledgeSignOutResult> {
  const api = options.api ?? knowledgeAuthApi;
  const storage = options.storage ?? (typeof window === 'undefined' ? null : window.sessionStorage);
  try {
    await api.signOut();
  } catch (cause) {
    if (storage) clearAuthLocalState(storage);
    return { ok: false, cause };
  }
  if (storage) clearAuthLocalState(storage);
  return { ok: true };
}

/** Browser binding: sign out, then return to the entry page with a notice. */
export async function signOutAndReturnToSignIn(): Promise<KnowledgeSignOutResult> {
  const result = await performKnowledgeSignOut();
  if (typeof window !== 'undefined') window.location.assign(buildAuthEntryUrl('signed-out'));
  return result;
}

/**
 * On-demand session re-validation (page refresh, OAuth callback): `null`
 * when no live session exists; transport/server failures throw the
 * normalized auth-flow error so callers can offer an explicit retry.
 */
export async function fetchKnowledgeSessionUser(api: KnowledgeAuthApi = knowledgeAuthApi): Promise<KnowledgeAuthUser | null> {
  const info = await api.getSession();
  return info?.session && info?.user ? info.user : null;
}
