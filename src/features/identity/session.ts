import { foucAuthApi, type FoucAuthApi } from './auth-api';
import { clearAuthLocalState } from './return-to';

export const authEntryPath = '/auth';

export type SignInEntryReason = 'expired' | 'signed-out';

export function buildAuthEntryUrl(reason?: SignInEntryReason): string {
  return reason ? `${authEntryPath}?reason=${reason}` : authEntryPath;
}

export type FoucSignOutResult = { ok: true } | { ok: false; cause: unknown };

/**
 * Revokes the Fouc session (`POST /api/auth/sign-out`) and clears local auth
 * artifacts. A failed revocation is reported honestly — the cookie session
 * may still be alive — while local state is still cleared.
 */
export async function performFoucSignOut(options: {
  api?: FoucAuthApi;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
} = {}): Promise<FoucSignOutResult> {
  const api = options.api ?? foucAuthApi;
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
