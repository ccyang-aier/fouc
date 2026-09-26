import { describe, expect, test } from 'bun:test';
import { KnowledgeDataError } from '../data/errors';
import {
  authEntryPath,
  buildAuthEntryUrl,
  fetchKnowledgeSessionUser,
  isUnauthorizedKnowledgeError,
  performKnowledgeSignOut,
} from './session';
import { authPendingEmailStorageKey, authReturnToStorageKey, type AuthReturnStorage } from './return-to';
import type { KnowledgeAuthApi } from './auth-api';

function memoryStorage(initial: Record<string, string> = {}): AuthReturnStorage & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    dump: () => Object.fromEntries(data),
  };
}

function fakeApi(overrides: Partial<KnowledgeAuthApi> = {}): KnowledgeAuthApi {
  return {
    listOAuthProviders: async () => [],
    signInWithPassword: async () => ({ user: { id: 'u', email: 'e', name: 'n', emailVerified: true } }),
    signUpWithEmail: async () => ({ user: { id: 'u', email: 'e', name: 'n', emailVerified: false } }),
    sendVerificationEmail: async () => ({ status: true }),
    signOut: async () => ({ success: true }),
    getSession: async () => null,
    startSocialSignIn: async () => ({ url: 'https://idp', redirect: true }),
    ...overrides,
  };
}

describe('isUnauthorizedKnowledgeError — data layer 401 detection', () => {
  test('accepts the UNAUTHENTICATED code and any 401 status', () => {
    expect(isUnauthorizedKnowledgeError(new KnowledgeDataError('UNAUTHENTICATED'))).toBe(true);
    expect(isUnauthorizedKnowledgeError(new KnowledgeDataError('FORBIDDEN', { httpStatus: 401 }))).toBe(true);
  });

  test('rejects other codes, statuses and foreign errors', () => {
    expect(isUnauthorizedKnowledgeError(new KnowledgeDataError('FORBIDDEN'))).toBe(false);
    expect(isUnauthorizedKnowledgeError(new KnowledgeDataError('UNAVAILABLE', { httpStatus: 503 }))).toBe(false);
    expect(isUnauthorizedKnowledgeError(new KnowledgeDataError('RATE_LIMITED', { httpStatus: 429 }))).toBe(false);
    expect(isUnauthorizedKnowledgeError(new Error('no'))).toBe(false);
    expect(isUnauthorizedKnowledgeError(null)).toBe(false);
  });
});

describe('buildAuthEntryUrl', () => {
  test('reason is optional and encoded as a query param', () => {
    expect(buildAuthEntryUrl()).toBe(authEntryPath);
    expect(buildAuthEntryUrl('expired')).toBe('/auth?reason=expired');
    expect(buildAuthEntryUrl('signed-out')).toBe('/auth?reason=signed-out');
  });
});

describe('performKnowledgeSignOut', () => {
  test('revokes the server session and clears local auth state', async () => {
    let signOutCalls = 0;
    const api = fakeApi({ signOut: async () => { signOutCalls++; return { success: true }; } });
    const storage = memoryStorage({ [authReturnToStorageKey]: '/knowledge', [authPendingEmailStorageKey]: 'a@b.c' });
    const result = await performKnowledgeSignOut({ api, storage });
    expect(result).toEqual({ ok: true });
    expect(signOutCalls).toBe(1);
    expect(storage.dump()).toEqual({});
  });

  test('a failed revocation reports the cause but still clears local state', async () => {
    const api = fakeApi({ signOut: () => Promise.reject(new Error('network down')) });
    const storage = memoryStorage({ [authReturnToStorageKey]: '/knowledge' });
    const result = await performKnowledgeSignOut({ api, storage });
    expect(result.ok).toBe(false);
    expect((result as { cause: unknown }).cause instanceof Error).toBe(true);
    expect(storage.dump()).toEqual({});
  });
});

describe('fetchKnowledgeSessionUser', () => {
  test('returns the user for a live session, null otherwise', async () => {
    const user = { id: 'u1', email: 'user@example.com', name: '阿明', emailVerified: true };
    expect(await fetchKnowledgeSessionUser(fakeApi({ getSession: async () => ({ session: { id: 's1', userId: 'u1', expiresAt: '2026-10-03T00:00:00Z' }, user }) }))).toEqual(user);
    expect(await fetchKnowledgeSessionUser(fakeApi({ getSession: async () => ({ session: null, user: null }) }))).toBeNull();
    expect(await fetchKnowledgeSessionUser(fakeApi({ getSession: async () => null }))).toBeNull();
  });
});
