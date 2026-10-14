import { afterEach, beforeAll, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { BackendRequestError, backendFetch } from './backend';

const originalFetch = globalThis.fetch;
beforeAll(() => {
  Object.assign(globalThis, { window: new Window({ url: 'http://localhost:3000' }) });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('structured validation survives the device transport without rewriting user values', async () => {
  const issue = {
    code: 'connection.invalid',
    values: { name: '我的连接 $&' },
    message: '连接无效',
  };
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        ok: false,
        error: { code: 'INVALID_INPUT', message: issue.message, validation: issue },
      }),
      { status: 400 },
    )) as typeof fetch;
  try {
    await backendFetch('/api/database/relational');
    throw new Error('Expected request failure');
  } catch (error) {
    expect(error instanceof BackendRequestError).toBe(true);
    const requestError = error as BackendRequestError;
    expect(requestError.status).toBe(400);
    expect(requestError.code).toBe('INVALID_INPUT');
    expect(requestError.issue).toEqual(issue);
    expect(requestError.issue?.values.name).toBe('我的连接 $&');
  }
});

test('ordinary provider errors retain their original diagnostic and successful responses stay intact', async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        ok: false,
        error: { code: 'PROVIDER_FAILURE', message: 'External diagnostic 原文' },
      }),
      { status: 503 },
    )) as typeof fetch;
  await expect(backendFetch('/api/database/relational')).rejects.toMatchObject({
    status: 503,
    code: 'PROVIDER_FAILURE',
    message: 'External diagnostic 原文',
    issue: undefined,
  });
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: true, data: { name: '用户资源' } }))) as typeof fetch;
  expect(await backendFetch('/api/database/relational')).toEqual({ name: '用户资源' });
});
