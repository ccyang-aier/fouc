import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useState, type ComponentProps, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import type { TaskLabel } from '@fouc/shared/tasks';

let browser: Window, host: HTMLDivElement, root: Root;
let Editor: typeof import('./task-labels')['TaskLabelsEditor'];
const onChange = mock((labels: TaskLabel[]) => labels);
const availableLabels: TaskLabel[] = [{ name: 'Design', color: 'violet' }, { name: 'Review', color: 'amber' }];

function Harness({ disabled = false, initialLabels = [] }: { disabled?: boolean; initialLabels?: TaskLabel[] }) {
  const [labels, setLabels] = useState(initialLabels);
  return <Editor labels={labels} availableLabels={availableLabels} disabled={disabled} onChange={next => { onChange(next); setLabels(next); }} />;
}

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'MutationObserver', 'getComputedStyle']) globals[key] = (browser as unknown as Record<string, unknown>)[key];
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true;
  browser.localStorage.setItem('fouc.language', 'en-US');
  const icon = () => <svg aria-hidden />;
  mock.module('@phosphor-icons/react', () => ({ Plus: icon, X: icon }));
  mock.module('@/components/ui/button', () => ({ Button: ({ children, ...props }: ComponentProps<'button'>) => <button {...props}>{children}</button> }));
  // The shared popover owns positioning, Escape, outside-click and return-focus tests.
  mock.module('@/components/ui/anchored-popover', () => ({ AnchoredPopover: ({ children, label }: { children: ReactNode; label: string }) => <div role="dialog" aria-label={label}>{children}</div> }));
  ({ TaskLabelsEditor: Editor } = await import('./task-labels'));
  const { createRoot } = await import('react-dom/client');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
beforeEach(async () => { await act(async () => root.render(null)); onChange.mockClear(); });
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); mock.restore(); });

async function render(props: ComponentProps<typeof Harness> = {}) { await act(async () => root.render(<Harness {...props} />)); }
async function click(label: string) {
  const button = host.querySelector<HTMLButtonElement>(`button[aria-label='${label}']`);
  expect(button).not.toBeNull(); await act(async () => button!.click());
}
async function type(value: string) {
  const input = host.querySelector<HTMLInputElement>('input:not([type="radio"])')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function submit() { await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }

test('creating a colored label changes only the draft and closes the picker', async () => {
  await render(); await click('Add label'); await type('  Research  ');
  expect(host.querySelectorAll('input[type="radio"]')).toHaveLength(8);
  await act(async () => host.querySelector<HTMLInputElement>('[aria-label="Teal"]')!.click());
  await submit();
  expect(onChange.mock.calls).toEqual([[[{ name: 'Research', color: 'teal' }]]]);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(host.querySelector('[data-label-color="teal"]')?.textContent).toBe('Research');
});

test('existing labels are searchable and selected with their saved colors', async () => {
  await render(); await click('Add label'); await type('Des');
  const options = host.querySelector('form')!.querySelectorAll('button[type="button"]');
  expect([...options].map(option => option.textContent)).toEqual(['Design']);
  await act(async () => (options[0] as HTMLButtonElement).click());
  expect(onChange.mock.calls[0][0]).toEqual([{ name: 'Design', color: 'violet' }]);
  await click('Remove label “Design”');
  expect(onChange.mock.calls[1][0]).toEqual([]);
});

test('invalid names remain editable and a retry clears the inline error', async () => {
  await render(); await click('Add label'); await type('a'.repeat(41)); await submit();
  expect(onChange.mock.calls).toHaveLength(0);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('40');
  expect(host.querySelector<HTMLInputElement>('input:not([type="radio"])')!.value).toHaveLength(41);
  await type('Ready');
  expect(host.querySelector('[role="alert"]')).toBeNull();
  await submit(); expect(onChange.mock.calls[0][0]).toEqual([{ name: 'Ready', color: 'blue' }]);
});

test('read-only labels retain their colors and hide add and remove controls', async () => {
  await render({ disabled: true, initialLabels: availableLabels });
  expect(host.querySelectorAll('button')).toHaveLength(0);
  expect(host.querySelector('[data-label-color="violet"]')?.textContent).toBe('Design');
  expect(onChange.mock.calls).toHaveLength(0);
});
