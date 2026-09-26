import { describe, expect, test } from 'bun:test';
import {
  createKnowledgeOriginProvider,
  knowledgeApiDevOrigin,
  knowledgeApiUrlEnvName,
  knowledgeTrpcUrl,
  parseKnowledgeApiOrigin,
  resolveKnowledgeApiOrigin,
  type KnowledgeEndpointDeps,
} from './endpoint';
import { isKnowledgeDataError } from './errors';

const workspace = '20000000-0000-4000-8000-000000000000';

function deps(overrides: Partial<KnowledgeEndpointDeps> = {}): KnowledgeEndpointDeps {
  return {
    runtime: () => 'web',
    invokeTauriCommand: () => Promise.reject(new Error('not a Tauri runtime')),
    environmentUrl: () => undefined,
    isProduction: () => false,
    ...overrides,
  };
}

describe('parseKnowledgeApiOrigin', () => {
  test('accepts http and https origins and normalizes a trailing slash', () => {
    expect(parseKnowledgeApiOrigin('https://api.fouc.example')).toBe('https://api.fouc.example');
    expect(parseKnowledgeApiOrigin('https://api.fouc.example/')).toBe('https://api.fouc.example');
    expect(parseKnowledgeApiOrigin('http://127.0.0.1:8710')).toBe('http://127.0.0.1:8710');
  });

  test('rejects paths, queries, fragments, credentials, other schemes and non-URLs', () => {
    for (const raw of ['https://api.example/api', 'https://api.example/?x=1', 'https://api.example/#f', 'https://user:pass@api.example', 'ws://api.example', 'not a url']) {
      expect(() => parseKnowledgeApiOrigin(raw)).toThrow('Invalid knowledge API origin');
    }
  });
});

describe('knowledgeTrpcUrl', () => {
  test('builds the A00 transport URL for one workspace', () => {
    expect(knowledgeTrpcUrl('https://api.fouc.example', workspace)).toBe(`https://api.fouc.example/api/knowledge/${workspace}/trpc`);
  });

  test('validates the origin and the workspaceId', () => {
    expect(() => knowledgeTrpcUrl('https://api.example/path', workspace)).toThrow('Invalid knowledge API origin');
    expect(() => knowledgeTrpcUrl('https://api.fouc.example', 'not-a-uuid')).toThrow('workspaceId must be a UUID');
  });
});

describe('resolveKnowledgeApiOrigin', () => {
  test('desktop resolves the sidecar endpoint through the Tauri command', async () => {
    const origin = await resolveKnowledgeApiOrigin(deps({
      runtime: () => 'tauri',
      invokeTauriCommand: (command) => Promise.resolve(command === 'get_backend_endpoint' ? { baseUrl: 'http://127.0.0.1:8710', token: 'unused' } : null),
    }));
    expect(origin).toEqual({ origin: 'http://127.0.0.1:8710', source: 'sidecar' });
  });

  test('desktop failures are loud endpoint errors, never a silent web fallback', async () => {
    const invokeFailure = resolveKnowledgeApiOrigin(deps({ runtime: () => 'tauri', invokeTauriCommand: () => Promise.reject(new Error('shell down')) }));
    expect(invokeFailure).rejects.toMatchObject({ code: 'ENDPOINT' });

    const invalidShape = resolveKnowledgeApiOrigin(deps({ runtime: () => 'tauri', invokeTauriCommand: () => Promise.resolve({}) }));
    expect(invalidShape).rejects.toMatchObject({ code: 'ENDPOINT' });
  });

  test('web uses the configured deployment origin', async () => {
    const origin = await resolveKnowledgeApiOrigin(deps({ environmentUrl: () => 'https://knowledge.internal.example/' }));
    expect(origin).toEqual({ origin: 'https://knowledge.internal.example', source: 'configured' });
  });

  test('an invalid configured origin is a clear endpoint error naming the variable', async () => {
    const invalid = resolveKnowledgeApiOrigin(deps({ environmentUrl: () => 'https://api.example/api' }));
    await expect(invalid).rejects.toMatchObject({ code: 'ENDPOINT' });
    const error = await invalid.catch((cause) => cause);
    expect(isKnowledgeDataError(error)).toBe(true);
    expect(error.message).toContain(knowledgeApiUrlEnvName);
  });

  test('web development falls back to the local sidecar; production without configuration fails', async () => {
    expect(await resolveKnowledgeApiOrigin(deps())).toEqual({ origin: knowledgeApiDevOrigin, source: 'dev' });
    await expect(resolveKnowledgeApiOrigin(deps({ isProduction: () => true }))).rejects.toMatchObject({ code: 'ENDPOINT' });
  });

  test('the data layer is browser-only', async () => {
    await expect(resolveKnowledgeApiOrigin(deps({ runtime: () => 'server' }))).rejects.toMatchObject({ code: 'ENDPOINT' });
  });

  test('the provider memoizes: the environment is inspected once per document', async () => {
    let environmentCalls = 0;
    const provider = createKnowledgeOriginProvider(deps({ environmentUrl: () => { environmentCalls += 1; return 'https://api.fouc.example'; } }));
    await provider();
    await provider();
    expect(environmentCalls).toBe(1);
  });
});
