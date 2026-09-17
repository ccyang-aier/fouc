import { describe, expect, test } from 'bun:test';
import { DtsRuntime } from './provider';

describe('DTS provider guardrails', () => {
  test('requires a runtime session before any API call', async () => {
    const runtime = new DtsRuntime('dts-personal');
    await expect(runtime.list({ filter: 'myTodos', page: 1, pageSize: 20 })).rejects.toMatchObject({ code: 'authentication_required' });
  });

  test('classifies an SSO redirect as an expired session', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(null, {
      status: 302,
      headers: { location: 'https://uniportal.xfusion.com/login' },
    })) as unknown as typeof fetch;
    try {
      const runtime = new DtsRuntime('dts-personal');
      runtime.importCookies([{ name: 'session', value: 'stale', domain: 'clouddragon.xfusion.com', path: '/', secure: true, httpOnly: true, expiresAt: null }]);
      await expect(runtime.identity()).rejects.toMatchObject({ code: 'session_expired', status: 401 });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
