import { describe, expect, test } from 'bun:test';
import { createKnowledgeResourceSelection, knowledgeResourceStorageKey } from './resource-selection';
import { createIdentitySessionStore } from '../identity/session-store';
import { foucAuthApi } from '../identity/auth-api';

describe('knowledge resource selection', () => {
  test('sign-in, sign-out and service failure do not replace the selected resource', async () => {
    const values = new Map<string, string>([[knowledgeResourceStorageKey('a'), 'workspace']]);
    const selection = createKnowledgeResourceSelection({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } }, 'a');
    let fail = false;
    const user = { id: 'user-a', name: '用户 A', email: 'a@fouc.test', emailVerified: true };
    const identity = createIdentitySessionStore({
      ...foucAuthApi,
      getSession: async () => {
        if (fail) throw new Error('service unavailable');
        return { user, session: { id: 'session-a', userId: user.id, expiresAt: '2099-01-01T00:00:00.000Z' } };
      },
      signOut: async () => ({ success: true }),
    });
    let changes = 0;
    selection.subscribe(() => { changes++; });
    await identity.completeSignIn();
    expect(identity.getSnapshot().status).toBe('authenticated');
    expect(selection.getSnapshot()).toBe('workspace');
    await identity.signOut();
    expect(identity.getSnapshot().status).toBe('anonymous');
    expect(selection.getSnapshot()).toBe('workspace');
    selection.select('local');
    fail = true;
    await identity.refresh(true);
    expect(identity.getSnapshot().status).toBe('error');
    expect(selection.getSnapshot()).toBe('local');
    expect(changes).toBe(1);
    expect(createKnowledgeResourceSelection({ getItem: (key) => values.get(key) ?? null, setItem: () => {} }, 'a').getSnapshot()).toBe('local');
  });

  test('blocked preference storage does not prevent selecting a resource', () => {
    const selection = createKnowledgeResourceSelection({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } }, 'a');
    expect(selection.getServerSnapshot()).toBeNull();
    expect(selection.getSnapshot()).toBe('local');
    selection.select('workspace');
    expect(selection.getSnapshot()).toBe('workspace');
  });
  test('resource preference belongs to the selected workspace', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    createKnowledgeResourceSelection(storage, 'a').select('workspace');
    expect(createKnowledgeResourceSelection(storage, 'b').getSnapshot()).toBe('local');
    expect(createKnowledgeResourceSelection(storage, 'a').getSnapshot()).toBe('workspace');
    expect(createKnowledgeResourceSelection(storage, 'server-space', 'workspace').getSnapshot()).toBe('workspace');
  });
});
