import { describe, expect, test } from 'bun:test';
import {
  deriveKnowledgeEntryPhase,
  entryPhaseShowsStage,
  knowledgeErrorCodeOf,
  type KnowledgeQuerySlice,
  type KnowledgeSessionGate,
} from './entry-state';

const authenticated: KnowledgeSessionGate = { status: 'authenticated' };

function slice(overrides: Partial<KnowledgeQuerySlice> & { status: KnowledgeQuerySlice['status'] }): KnowledgeQuerySlice {
  return { errorCode: null, count: null, ...overrides };
}

describe('knowledgeErrorCodeOf', () => {
  test('reads the normalized domain code of both data-layer error families', () => {
    expect(knowledgeErrorCodeOf({ code: 'UNAUTHENTICATED' })).toBe('UNAUTHENTICATED');
    expect(knowledgeErrorCodeOf(new Error('plain'))).toBeNull();
    expect(knowledgeErrorCodeOf(null)).toBeNull();
    expect(knowledgeErrorCodeOf({ code: 401 })).toBeNull();
  });
});

describe('deriveKnowledgeEntryPhase', () => {
  test('session gate comes first', () => {
    const busyWorkspaces = slice({ status: 'pending' });
    expect(deriveKnowledgeEntryPhase({ session: { status: 'checking' }, workspaces: busyWorkspaces, access: null, teamspaces: null })).toBe('session-checking');
    expect(deriveKnowledgeEntryPhase({ session: { status: 'error' }, workspaces: busyWorkspaces, access: null, teamspaces: null })).toBe('session-error');
    expect(deriveKnowledgeEntryPhase({ session: { status: 'anonymous' }, workspaces: busyWorkspaces, access: null, teamspaces: null })).toBe('auth-required');
  });

  test('authenticated without workspace data yet still counts as loading the list', () => {
    expect(deriveKnowledgeEntryPhase({ session: authenticated, workspaces: null, access: null, teamspaces: null })).toBe('workspaces-loading');
    expect(deriveKnowledgeEntryPhase({ session: authenticated, workspaces: slice({ status: 'pending' }), access: null, teamspaces: null })).toBe('workspaces-loading');
  });

  test('workspace list failures: expiry redirects, the rest surface as errors', () => {
    expect(deriveKnowledgeEntryPhase({
      session: authenticated,
      workspaces: slice({ status: 'error', errorCode: 'UNAUTHENTICATED' }),
      access: null,
      teamspaces: null,
    })).toBe('auth-required');
    expect(deriveKnowledgeEntryPhase({
      session: authenticated,
      workspaces: slice({ status: 'error', errorCode: 'NETWORK' }),
      access: null,
      teamspaces: null,
    })).toBe('workspaces-error');
  });

  test('an account with no workspace reaches the empty state, not the stage', () => {
    expect(deriveKnowledgeEntryPhase({
      session: authenticated,
      workspaces: slice({ status: 'success', count: 0 }),
      access: null,
      teamspaces: null,
    })).toBe('workspaces-empty');
  });

  test('access snapshot gates the stage: pending, forbidden and transport error', () => {
    const workspaces = slice({ status: 'success', count: 2 });
    expect(deriveKnowledgeEntryPhase({ session: authenticated, workspaces, access: null, teamspaces: null })).toBe('workspace-loading');
    expect(deriveKnowledgeEntryPhase({ session: authenticated, workspaces, access: slice({ status: 'pending' }), teamspaces: null })).toBe('workspace-loading');
    expect(deriveKnowledgeEntryPhase({ session: authenticated, workspaces, access: slice({ status: 'error', errorCode: 'FORBIDDEN' }), teamspaces: null })).toBe('workspace-forbidden');
    expect(deriveKnowledgeEntryPhase({ session: authenticated, workspaces, access: slice({ status: 'error', errorCode: 'UNAVAILABLE' }), teamspaces: null })).toBe('workspace-error');
    expect(deriveKnowledgeEntryPhase({ session: authenticated, workspaces, access: slice({ status: 'error', errorCode: 'UNAUTHENTICATED' }), teamspaces: null })).toBe('auth-required');
  });

  test('teamspace directory gates the tree: loading, guest-forbidden, error and ready', () => {
    const workspaces = slice({ status: 'success', count: 1 });
    const access = slice({ status: 'success' });
    expect(deriveKnowledgeEntryPhase({ session: authenticated, workspaces, access, teamspaces: null })).toBe('tree-loading');
    expect(deriveKnowledgeEntryPhase({ session: authenticated, workspaces, access, teamspaces: slice({ status: 'pending' }) })).toBe('tree-loading');
    expect(deriveKnowledgeEntryPhase({ session: authenticated, workspaces, access, teamspaces: slice({ status: 'error', errorCode: 'FORBIDDEN' }) })).toBe('tree-forbidden');
    expect(deriveKnowledgeEntryPhase({ session: authenticated, workspaces, access, teamspaces: slice({ status: 'error', errorCode: 'ORGANIZATION_UNAVAILABLE' }) })).toBe('tree-error');
    expect(deriveKnowledgeEntryPhase({ session: authenticated, workspaces, access, teamspaces: slice({ status: 'error', errorCode: 'UNAUTHENTICATED' }) })).toBe('auth-required');
    expect(deriveKnowledgeEntryPhase({ session: authenticated, workspaces, access, teamspaces: slice({ status: 'success', count: 0 }) })).toBe('ready');
    expect(deriveKnowledgeEntryPhase({ session: authenticated, workspaces, access, teamspaces: slice({ status: 'success', count: 3 }) })).toBe('ready');
  });

  test('an empty teamspace directory is still the ready stage (empty tree state)', () => {
    expect(entryPhaseShowsStage('ready')).toBe(true);
  });
});

describe('entryPhaseShowsStage', () => {
  test('gate screens render alone; access-confirmed phases render the three-column stage', () => {
    for (const phase of ['session-checking', 'session-error', 'auth-required', 'workspaces-loading', 'workspaces-error', 'workspaces-empty'] as const) {
      expect(entryPhaseShowsStage(phase)).toBe(false);
    }
    for (const phase of ['workspace-loading', 'workspace-error', 'workspace-forbidden', 'tree-loading', 'tree-forbidden', 'tree-error', 'ready'] as const) {
      expect(entryPhaseShowsStage(phase)).toBe(true);
    }
  });
});
