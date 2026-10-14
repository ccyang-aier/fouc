import { BackendRequestError } from '@/lib/backend';
import { setLocale } from '@/lib/i18n';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { messages as dtsGraphMessages } from '../../dts/i18n/dts-relationship-graph';
import { createUiMessages, uiFailure, uiText } from '../../i18n/ui-message';
import { messages as mongoExportMessages } from '../../mongo/i18n/mongo-workbench';
import { expiryLabel } from '../bulk/model';
import { RedisByteField } from '../redis-byte-field';
import { bytesToDraft, draftToBytes } from '../redis-mutation-model';
import { redisInteger, redisSlowlogTime } from '../redis-observability-model';
import { redisStreamDuration } from '../redis-stream-model';
import { messages as byteMessages } from './redis-byte-field';
import { messages as workbenchMessages } from './redis-workbench';

let browser: Window;
let root: Root | undefined;
let host: HTMLDivElement;
const previous = new Map<string, unknown>();
beforeAll(() => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'MutationObserver',
    'getComputedStyle',
    'localStorage',
    'IS_REACT_ACT_ENVIRONMENT',
  ]) {
    previous.set(key, globals[key]);
    globals[key] =
      key === 'window'
        ? browser
        : key === 'IS_REACT_ACT_ENVIRONMENT'
          ? true
          : (browser as unknown as Record<string, unknown>)[key];
  }
});
beforeEach(() => {
  setLocale('zh-CN');
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  host?.remove();
});
afterAll(async () => {
  await browser.happyDOM.abort();
  const globals = globalThis as Record<string, unknown>;
  for (const [key, value] of previous) {
    if (value === undefined) delete globals[key];
    else globals[key] = value;
  }
});

test('owned connector formatters localize display without rounding protocol integers', () => {
  expect(redisInteger('9007199254740993', 'en-US')).toBe('9,007,199,254,740,993');
  expect(redisInteger(null, 'zh-CN')).toBe('未知');
  expect(redisInteger(null, 'en-US')).toBe('Unknown');
  expect(redisStreamDuration('61000', 'en-US')).toBe('1m 1s');
  expect(redisStreamDuration('61000', 'zh-CN')).toBe('1 分 1 秒');
  expect(redisSlowlogTime('1700000000', 'en-US')).not.toContain('年');
  expect(expiryLabel('-1', 'en-US')).toBe('Persistent');
  expect(expiryLabel('-1', 'zh-CN')).toBe('永久');
  const payload = 'AP8=';
  expect(draftToBytes(bytesToDraft(payload))).toBe(payload);
});

test('structured feedback and fixed metadata switch languages while source values stay raw', () => {
  const feedback = createUiMessages(workbenchMessages).message('变更已执行 · {v0} ms', { v0: 25 });
  expect(uiText(feedback, 'zh-CN')).toBe('变更已执行 · 25 ms');
  expect(uiText(feedback, 'en-US')).toBe('Change executed · 25 ms');
  expect(uiText(createUiMessages(mongoExportMessages).message('Native driver'), 'zh-CN')).toBe(
    '原生驱动',
  );
  expect(uiText(createUiMessages(dtsGraphMessages).message('一般'), 'en-US')).toBe('Normal');
  expect(uiText('user:key:原文', 'en-US')).toBe('user:key:原文');
  expect(uiText('{"客户":{"$numberLong":"9007199254740993"}}', 'en-US')).toBe(
    '{"客户":{"$numberLong":"9007199254740993"}}',
  );
  const graphUi = createUiMessages(dtsGraphMessages);
  const custom = graphUi.message('已删除{v0}', { v0: '一般' });
  expect(uiText(custom, 'en-US')).toBe('Deleted 一般');
  expect(uiText(graphUi.message('已删除{v0}', { v0: graphUi.message('一般') }), 'en-US')).toBe(
    'Deleted Normal',
  );
  for (const value of ['一般', '未知', 'Native driver', '已删除{v0}', '变更已执行 · {v0} ms']) {
    expect(uiText(value, 'en-US')).toBe(value);
    expect(uiText(value, 'zh-CN')).toBe(value);
    expect(uiText(new Error(value), 'en-US')).toBe(value);
  }
});

test('an existing coded or UI error keeps its cause and changes language on render', () => {
  const uiError = createUiMessages(byteMessages).error('此值包含二进制字节，请使用 Base64 编辑。');
  const state = uiFailure(uiError);
  expect(uiText(state, 'zh-CN')).toContain('二进制');
  expect(uiText(state, 'en-US')).toBe('This value contains binary bytes. Edit with Base64.');
  const issue = {
    code: 'connection-options-url.connectionUrlContainsAnInvalidPercentEscape',
    values: {},
    message: 'opaque fallback',
  };
  const backendError = new BackendRequestError(issue.message, 400, 'VALIDATION', issue);
  expect(uiFailure(backendError)).toBe(backendError);
  expect(uiText(backendError, 'zh-CN')).toContain('连接');
  expect(uiText(backendError, 'en-US')).toContain('percent');
  expect(uiFailure(issue)).toBe(issue);
});

test('a byte editor preserves the same input, focus, selection and binary bytes while its validation switches', async () => {
  const value = bytesToDraft('AP8=');
  const view = <RedisByteField label="User-defined field" value={value} onChange={() => {}} />;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(view));
  const input = host.querySelector<HTMLInputElement>('input')!;
  input.focus();
  input.setSelectionRange(2, 2);
  const select = host.querySelector<HTMLSelectElement>('select')!;
  await act(async () => {
    select.value = 'text';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('二进制');
  input.focus();
  input.setSelectionRange(2, 2);
  await act(async () => setLocale('en-US'));
  expect(host.querySelector('input')).toBe(input);
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(2);
  expect(input.value).toBe('AP8=');
  expect(select.value).toBe('base64');
  expect(host.querySelector('[role="alert"]')?.textContent).toBe(
    'This value contains binary bytes. Edit with Base64.',
  );
  expect(host.textContent).toContain('UTF-8 text');
  expect(renderToString(view)).toContain('UTF-8 文本');
});
