import { setLocale } from '@/lib/i18n';
import type { ConnectorConnectInteraction } from '@fouc/shared';
import { expect, test } from 'bun:test';
import { openDtsAuthWindow } from './api';

test('the native DTS auth bridge receives the event language without changing its identity or URL', async () => {
  const globals = globalThis as Record<string, unknown>;
  const previousWindow = globals.window;
  const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
  globals.window = {
    localStorage: {
      setItem() {},
      getItem() {
        return null;
      },
    },
    __TAURI__: {
      core: {
        invoke: async (command: string, args?: Record<string, unknown>) => {
          calls.push({ command, args });
        },
      },
    },
  };
  const interaction: ConnectorConnectInteraction = {
    interactionId: 'interaction-dts',
    kind: 'open_managed_web_session',
    url: 'https://dts.example.com/auth?nonce=keep%2F原文',
    expiresAt: 0,
  };
  try {
    setLocale('zh-CN');
    await openDtsAuthWindow(interaction);
    setLocale('en-US');
    await openDtsAuthWindow(interaction);
    expect(calls).toEqual([
      {
        command: 'open_dts_auth',
        args: { interactionId: interaction.interactionId, url: interaction.url, title: '登录 DTS' },
      },
      {
        command: 'open_dts_auth',
        args: {
          interactionId: interaction.interactionId,
          url: interaction.url,
          title: 'Sign in to DTS',
        },
      },
    ]);
  } finally {
    setLocale('zh-CN');
    if (previousWindow === undefined) delete globals.window;
    else globals.window = previousWindow;
  }
});
