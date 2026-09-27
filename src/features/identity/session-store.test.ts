import { describe, expect, test } from 'bun:test';
import type { FoucAuthApi, FoucAuthSessionInfo } from './auth-api';
import { createIdentitySessionStore } from './session-store';

const user = { id: 'user', name: 'Fouc User', email: 'user@example.test', emailVerified: true };
const active: FoucAuthSessionInfo = { user, session: { id: 'session', userId: user.id, expiresAt: '2099-01-01T00:00:00Z' } };
function api(overrides: Partial<FoucAuthApi>): FoucAuthApi {
  return { getSession: async () => active, signOut: async () => ({ success: true }), ...overrides } as FoucAuthApi;
}

describe('global Fouc session', () => {
  test('concurrent module checks share one server request', async () => {
    let calls = 0;
    const store = createIdentitySessionStore(api({ getSession: async () => { calls++; return active; } }));
    await Promise.all([store.refresh(), store.refresh(), store.refresh()]);
    expect(calls).toBe(1);
    expect(store.getSnapshot()).toMatchObject({ status: 'authenticated', user });
  });
  test('a late session response cannot restore an expired identity', async () => {
    let resolve!: (value: FoucAuthSessionInfo) => void;
    const store = createIdentitySessionStore(api({ getSession: () => new Promise((done) => { resolve = done; }) }));
    const request = store.refresh();
    store.expire();
    resolve(active);
    await request;
    expect(store.getSnapshot().status).toBe('anonymous');
  });
  test('a successful password response without a retained cookie never reports login success', async () => {
    const store = createIdentitySessionStore(api({ getSession: async () => null }));
    await expect(store.completeSignIn()).rejects.toMatchObject({ code: 'SESSION_NOT_PERSISTED' });
    expect(store.getSnapshot().status).toBe('anonymous');
  });
  test('sign-out failure preserves the known identity; successful revocation clears it', async () => {
    let fail = true;
    const store = createIdentitySessionStore(api({ signOut: async () => { if (fail) throw new Error('offline'); return { success: true }; } }));
    await store.refresh();
    await expect(store.signOut()).rejects.toThrow('offline');
    expect(store.getSnapshot().status).toBe('authenticated');
    fail = false;
    await store.signOut();
    expect(store.getSnapshot().status).toBe('anonymous');
  });
  test('unverified users, expired sessions and mismatched principals are rejected', async () => {
    for (const info of [
      { ...active, user: { ...user, emailVerified: false } },
      { ...active, session: { ...active.session!, expiresAt: '2020-01-01T00:00:00Z' } },
      { ...active, session: { ...active.session!, userId: 'another-user' } },
    ]) {
      const store = createIdentitySessionStore(api({ getSession: async () => info }));
      await store.refresh();
      expect(store.getSnapshot().status).toBe('anonymous');
    }
  });
});
