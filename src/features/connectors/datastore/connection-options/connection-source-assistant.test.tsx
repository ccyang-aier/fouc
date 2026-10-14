import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { defaultConnectionOptions } from '@fouc/shared/connection-options';
import type { ConnectionUrlFields } from '@fouc/shared/connection-options-url';
import { setLocale } from '@/lib/i18n';
import type { ConnectionSourceAssistant as AssistantComponent } from './connection-source-assistant';

let browser: Window, root: Root, Assistant: typeof AssistantComponent;
const fields: ConnectionUrlFields = {
  provider: 'postgres',
  host: 'localhost',
  port: 5432,
  username: '用户名称',
  password: 'PrivateSecret',
  database: 'MixedCaseDatabase',
  connectionOptions: defaultConnectionOptions('postgres'),
};

beforeAll(async () => {
  browser = new Window();
  const globals = globalThis as Record<string, unknown>;
  for (const name of [
    'document',
    'navigator',
    'HTMLElement',
    'HTMLInputElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
  ]) {
    globals[name] = (browser as unknown as Record<string, unknown>)[name];
  }
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  Assistant = (await import('./connection-source-assistant')).ConnectionSourceAssistant;
});
beforeEach(() => {
  setLocale('zh-CN');
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  setLocale('zh-CN');
  document.body.replaceChildren();
});
afterAll(async () => {
  await browser.happyDOM.abort();
});

async function mount() {
  await act(async () =>
    root.render(<Assistant provider="postgres" fields={fields} onApply={() => {}} />),
  );
  document.querySelector('details')!.open = true;
  return document.querySelector<HTMLTextAreaElement>('textarea')!;
}
function copyButton() {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
    /^复制 URL$|^Copy\s+URL$/.test(button.textContent!.trim()),
  )!;
}

test('existing copy feedback follows language without remounting or changing generated connection data', async () => {
  let copied = '';
  Object.defineProperty(browser.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        copied = text;
      },
    },
  });
  const text = await mount();
  const original = text.value;
  text.focus();
  await act(async () => copyButton().click());
  expect(document.querySelector('[role="status"]')?.textContent).toContain('未包含密码');
  expect(copied).toBe(original);
  expect(copied).not.toContain('PrivateSecret');
  expect(decodeURIComponent(copied)).toContain('用户名称');
  text.focus();
  await act(async () => setLocale('en-US'));
  expect(document.querySelector('textarea')).toBe(text);
  expect(document.activeElement).toBe(text);
  expect(text.value).toBe(original);
  expect(document.querySelector('[role="status"]')?.textContent).toBe(
    'Copied connection text without the password',
  );
  await act(async () => setLocale('zh-CN'));
  expect(document.querySelector('[role="status"]')?.textContent).toContain('未包含密码');
});

test('stored local errors retranslate while browser errors retain their original text', async () => {
  Object.defineProperty(browser.navigator, 'clipboard', { configurable: true, value: undefined });
  const text = await mount();
  await act(async () => copyButton().click());
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('剪贴板权限');
  await act(async () => setLocale('en-US'));
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    'Clipboard permission is unavailable',
  );
  expect(document.querySelector('textarea')).toBe(text);

  Object.defineProperty(browser.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async () => {
        throw new Error('Native browser error 用户内容');
      },
    },
  });
  await act(async () => copyButton().click());
  await act(async () => setLocale('zh-CN'));
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    'Native browser error 用户内容',
  );
});
