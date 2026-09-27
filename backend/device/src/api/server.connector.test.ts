import { describe, expect, test } from 'bun:test';
import { createApp } from './server';

function testApp() {
  const connectors = {
    listProviders: () => [], listInstances: () => [],
    completeDtsConnect: async () => ({ authState: 'valid', healthState: 'healthy' }),
  };
  return createApp({
    registry: {} as never,
    supervisor: {} as never,
    connectors: connectors as never,
    token: 'frontend-token',
    internalToken: 'native-only-token',
    devNoAuth: true,
  }).app;
}

describe('connector internal authentication boundary', () => {
  test('development no-auth never bypasses the native handoff token', async () => {
    const response = await testApp().request('/internal/connectors/dts/auth-handoff', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-fouc-internal-token': 'wrong-token' },
      body: JSON.stringify({ interactionId: 'test', cookies: [] }),
    });
    expect(response.status).toBe(401);
  });

  test('accepts a handoff carrying the dedicated native token', async () => {
    const response = await testApp().request('/internal/connectors/dts/auth-handoff', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-fouc-internal-token': 'native-only-token' },
      body: JSON.stringify({ interactionId: 'test', cookies: [] }),
    });
    expect(response.status).toBe(200);
    expect((await response.json() as { ok: boolean }).ok).toBe(true);
  });
});
