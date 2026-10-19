import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, type ComponentProps } from 'react';
import type { Root } from 'react-dom/client';

let browser: Window, root: Root, host: HTMLDivElement;
let Composer: typeof import('./task-comment-composer')['TaskCommentComposer'];
const onSubmit = mock<(body: string, images: File[]) => Promise<void>>(async () => {});
const onDirty = mock<(dirty: boolean) => void>(() => {});
let nextUrl = 0;
const revoke = mock<(url: string) => void>(() => {});
const originalCreateUrl = URL.createObjectURL, originalRevokeUrl = URL.revokeObjectURL;

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Element', 'Node', 'Event', 'MouseEvent', 'MutationObserver', 'getComputedStyle']) globals[key] = (browser as unknown as Record<string, unknown>)[key];
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true;
  globals.requestAnimationFrame = browser.requestAnimationFrame.bind(browser);
  browser.localStorage.setItem('fouc.language', 'en-US');
  URL.createObjectURL = () => `blob:comment-${++nextUrl}`;
  URL.revokeObjectURL = revoke;
  const icon = () => <svg aria-hidden />;
  mock.module('@phosphor-icons/react', () => ({ ImageSquare: icon, X: icon }));
  mock.module('@/components/user-avatar', () => ({ UserAvatar: () => <span /> }));
  mock.module('@/components/app-alert', () => ({ AppAlert: ({ title }: { title: string }) => <div role="alert">{title}</div> }));
  mock.module('@/components/ui/button', () => ({ Button: ({ loading, ...props }: ComponentProps<'button'> & { loading?: boolean }) => <button {...props} disabled={loading || props.disabled} /> }));
  mock.module('@/components/ui/emoji-picker', () => ({ EmojiPicker: ({ onSelect }: { onSelect: (emoji: string) => void }) => <button aria-label="Choose emoji" onClick={() => onSelect('🎉')}>Emoji</button> }));
  ({ TaskCommentComposer: Composer } = await import('./task-comment-composer'));
  const { createRoot } = await import('react-dom/client');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
beforeEach(async () => { await act(async () => root.render(null)); onSubmit.mockReset(); onSubmit.mockImplementation(async () => {}); onDirty.mockClear(); revoke.mockClear(); });
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); URL.createObjectURL = originalCreateUrl; URL.revokeObjectURL = originalRevokeUrl; mock.restore(); });

async function render(hidden = false) { await act(async () => root.render(<Composer hidden={hidden} onSubmit={onSubmit} onDirtyChange={onDirty} />)); }
function textarea() { return host.querySelector('textarea')!; }
async function type(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(browser.HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea(), value);
    textarea().dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function attach(files: File[]) {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}
async function publish() { await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Post comment')!.click()); }
function image(name = 'design.png') { return new File(['preview'], name, { type: 'image/png' }); }

test('image-only comments protect their draft and release previews after publication', async () => {
  await render(); const file = image();
  await attach([file]);
  expect(host.querySelector('img')?.alt).toBe(file.name);
  expect(onDirty.mock.calls.at(-1)).toEqual([true]);
  await publish();
  expect(onSubmit.mock.calls).toEqual([['', [file]]]);
  expect(host.querySelector('img')).toBeNull();
  expect(revoke.mock.calls).toHaveLength(1);
  expect(onDirty.mock.calls.at(-1)).toEqual([false]);
});

test('emoji insertion replaces the selected text and restores the caret in the comment', async () => {
  await render(); await type('设计草稿完成'); textarea().setSelectionRange(2, 4);
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Choose emoji"]')!.click());
  await act(async () => new Promise<void>(resolve => browser.requestAnimationFrame(() => resolve())));
  expect(textarea().value).toBe('设计🎉完成');
  expect(textarea().selectionStart).toBe(4);
  expect(document.activeElement === textarea()).toBe(true);
});

test('a failed publication keeps text and files intact for retry', async () => {
  await render(); const file = image(); await type('Review this'); await attach([file]);
  onSubmit.mockImplementation(async () => { throw new Error('Unavailable'); });
  await publish();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('kept');
  expect(textarea().value).toBe('Review this');
  expect(host.querySelector('img')?.alt).toBe(file.name);
  expect(revoke.mock.calls).toHaveLength(0);
  onSubmit.mockImplementation(async () => {});
  await publish();
  expect(onSubmit.mock.calls).toEqual([['Review this', [file]], ['Review this', [file]]]);
  expect(textarea().value).toBe(''); expect(host.querySelector('img')).toBeNull();
});

test('invalid files and excess images are rejected while accepted files remain removable', async () => {
  await render();
  await attach([new File(['text'], 'notes.txt', { type: 'text/plain' })]);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('PNG');
  await attach([new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })]);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('5 MB');
  await attach(Array.from({ length: 5 }, (_, index) => image(`${index}.png`)));
  expect(host.querySelectorAll('img')).toHaveLength(4);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('4 images');
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Remove image “0.png”"]')!.click());
  expect(host.querySelectorAll('img')).toHaveLength(3);
  expect(host.querySelector<HTMLButtonElement>('button[aria-label="Upload images"]')!.disabled).toBe(false);
});

test('hidden panels retain text and image drafts and unmount releases all owned URLs', async () => {
  await render(); await type('Keep draft'); await attach([image()]);
  await render(true); expect(host.querySelector('[hidden]')).not.toBeNull();
  await render(false); expect(textarea().value).toBe('Keep draft'); expect(host.querySelectorAll('img')).toHaveLength(1);
  await act(async () => root.render(null)); expect(revoke.mock.calls).toHaveLength(1); expect(onSubmit.mock.calls).toHaveLength(0);
});
