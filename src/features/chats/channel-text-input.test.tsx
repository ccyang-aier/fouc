import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test';
import { act, useEffect, useState, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import type { ChannelMember } from '@fouc/shared/chats';
import { CHANNEL_MESSAGE_MAX_LENGTH, channelDocumentText, channelTextDocument, limitChannelText } from './channel-text-document';
import type { ChannelTextInputHandle } from './channel-text-input';

let browser: Window;
let root: Root;
let host: HTMLDivElement;
let Input: typeof import('./channel-text-input').ChannelTextInput;
let value = '';
let files: File[];
let keys: string[];
const ref = createRef<ChannelTextInputHandle>();
const members: ChannelMember[] = [{ id: 'peer', userId: 'user', name: '苏晴 · 示例', image: null, kind: 'user', role: 'member', installationId: null, agentOwnerId: null, joinedAt: '2026-10-25T00:00:00Z', active: true }];

beforeAll(async () => {
  browser = new Window({ url: 'http://127.0.0.1:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['document', 'navigator', 'DOMParser', 'MutationObserver', 'Range', 'getSelection', 'HTMLElement', 'Element', 'Node', 'Text', 'Comment', 'customElements', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle']) globals[key] = (browser as unknown as Record<string, unknown>)[key];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  Input = (await import('./channel-text-input')).ChannelTextInput;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
}, 20_000);
beforeEach(async () => { await act(async () => root.render(null)); value = ''; files = []; keys = []; });
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });

function Harness({ initial = '', readOnly = false }: { initial?: string; readOnly?: boolean }) {
  const [body, setBody] = useState(initial);
  useEffect(() => { value = body; }, [body]);
  return <Input ref={ref} value={body} members={members} label="Channel message" placeholder="Write a message" readOnly={readOnly}
    onChange={next => setBody(next)} onSelectionChange={() => {}} onFiles={next => { files = next; }}
    onKeyDown={event => { keys.push(event.key); if (event.key === 'Enter' && !event.shiftKey) event.preventDefault(); }} />;
}
function surface() { return host.querySelector<HTMLElement>('[role="textbox"]')!; }
async function paste(text: string, html = '', file?: InstanceType<Window['File']>) {
  const data = new browser.DataTransfer(); data.setData('text/plain', text); if (html) data.setData('text/html', html); if (file) data.items.add(file);
  const event = new browser.ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
  await act(async () => surface().dispatchEvent(event as unknown as Event));
}

test('existing drafts become visible mentions without modifying serialized text or selection', async () => {
  await act(async () => root.render(<Harness initial="@苏晴 · 示例 " />));
  expect(surface().querySelector('[data-channel-mention="peer"]')?.textContent).toBe('@苏晴 · 示例');
  expect(value).toBe('@苏晴 · 示例 ');
  await act(async () => { ref.current!.setSelectionRange(3, 6); });
  expect(ref.current!.selectionStart).toBe(3); expect(ref.current!.selectionEnd).toBe(6);
  expect(surface().getAttribute('aria-label')).toBe('Channel message');
});

test('paste inserts multiline plain text and ignores HTML and remote image markup', async () => {
  await act(async () => root.render(<Harness />));
  await paste('@苏晴 · 示例\r\nhello 🚀', '<img src="https://untrusted.invalid/file.png"><b>foreign</b>');
  expect(value).toBe('@苏晴 · 示例\nhello 🚀');
  expect(surface().querySelectorAll('p')).toHaveLength(1);
  expect(surface().querySelectorAll('br').length).toBeGreaterThan(0);
  expect(surface().querySelector('img[src^="https:"]')).toBeNull();
  expect(surface().querySelector('[data-channel-mention]')).not.toBeNull();
  expect(surface().querySelector('[data-channel-emoji="🚀"]')).not.toBeNull();
});

test('paste respects message limits and sends files to the attachment handler', async () => {
  await act(async () => root.render(<Harness initial={'a'.repeat(CHANNEL_MESSAGE_MAX_LENGTH - 1)} />));
  await act(async () => ref.current!.setSelectionRange(CHANNEL_MESSAGE_MAX_LENGTH - 1, CHANNEL_MESSAGE_MAX_LENGTH - 1));
  await paste('123');
  expect(value.length).toBe(CHANNEL_MESSAGE_MAX_LENGTH);
  expect(value.endsWith('1')).toBe(true);
  const file = new browser.File(['image'], 'sample.png', { type: 'image/png' });
  await paste('ignored', '', file);
  expect(files[0].name).toBe('sample.png'); expect(value.length).toBe(CHANNEL_MESSAGE_MAX_LENGTH);
});

test('Enter submit, Shift Enter newline and IME composition preserve distinct behaviors', async () => {
  await act(async () => root.render(<Harness initial="hello" />));
  await act(async () => ref.current!.setSelectionRange(5, 5));
  await act(async () => surface().dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }) as unknown as Event));
  expect(value).toBe('hello');
  await act(async () => surface().dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }) as unknown as Event));
  expect(value).toBe('hello\n');
  await act(async () => surface().dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }) as unknown as Event));
  expect(keys).toEqual(['Enter', 'Enter']);
});

test('read only editor preserves content and cannot paste', async () => {
  await act(async () => root.render(<Harness initial="retained draft" readOnly />));
  await paste('replacement');
  expect(value).toBe('retained draft');
  expect(surface().getAttribute('contenteditable')).toBe('false');
  expect(surface().getAttribute('aria-readonly')).toBe('true');
});

test('select all replacement and undo redo retain the single plain text document', async () => {
  await act(async () => root.render(<Harness initial="@苏晴 · 示例 original" />));
  await act(async () => surface().dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true }) as unknown as Event));
  await paste('replaced 👨‍👩‍👧‍👦\nnext line');
  expect(value).toBe('replaced 👨‍👩‍👧‍👦\nnext line');
  expect(surface().querySelector('[data-channel-mention]')).toBeNull();
  await act(async () => surface().dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }) as unknown as Event));
  expect(value).toBe('@苏晴 · 示例 original');
  expect(surface().querySelector('[data-channel-mention]')).not.toBeNull();
  await act(async () => surface().dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }) as unknown as Event));
  expect(value).toBe('replaced 👨‍👩‍👧‍👦\nnext line');
  expect(surface().querySelectorAll('p')).toHaveLength(1);
});

test('document conversion keeps empty lines, Unicode and Markdown syntax', async () => {
  const { Editor } = await import('@tiptap/core');
  const { channelTextExtensions } = await import('./channel-text-extensions');
  const element = document.createElement('div'); document.body.append(element);
  const body = '\n**hello** @苏晴 · 示例 👨‍👩‍👧‍👦\n\n`code`\n';
  const editor = new Editor({ element, extensions: channelTextExtensions(() => members), content: channelTextDocument(body) });
  try {
    expect(channelDocumentText(editor.state.doc)).toBe(body);
    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.state.doc.content.size).toBe(body.length + 2);
  } finally { editor.destroy(); element.remove(); }
});

test('text limits keep Unicode graphemes intact', () => {
  expect(limitChannelText('hello 👍🏽 end', 8)).toBe('hello ');
  expect(limitChannelText('👨‍👩‍👧‍👦 family', 10)).toBe('');
  expect(limitChannelText('🇨🇳 next', 4)).toBe('🇨🇳');
  expect(limitChannelText('unchanged', 20)).toBe('unchanged');
});
