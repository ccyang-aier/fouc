import { afterAll, beforeAll, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { useQueryRuleReorder as Reorder } from './use-query-rule-reorder';

let browser: Window, root: Root, useQueryRuleReorder: typeof Reorder;
let moves: [number, number][] = [];
const original = [
  { id: 'a', value: '北京', enabled: true },
  { id: 'b', value: '上海', enabled: false },
  { id: 'c', value: '杭州', enabled: true },
];

beforeAll(async () => {
  browser = new Window();
  const globals = globalThis as Record<string, unknown>;
  for (const name of [
    'document',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'PointerEvent',
    'KeyboardEvent',
  ])
    globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  useQueryRuleReorder = (await import('./use-query-rule-reorder')).useQueryRuleReorder;
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterAll(async () => {
  await act(async () => root.unmount());
  await browser.happyDOM.abort();
});

function Harness() {
  const [items, setItems] = useState(original);
  const {
    list: listRef,
    row: rowProps,
    handle: dragHandle,
  } = useQueryRuleReorder(items.length, false, (source, target) => {
    moves.push([source, target]);
    const next = [...items],
      [item] = next.splice(source, 1);
    next.splice(target, 0, item!);
    setItems(next);
  });
  return (
    <section ref={listRef} data-query-rule-list>
      {items.map((item, index) => (
        <div
          key={item.id}
          {...rowProps(index)}
          data-item={item.id}
          data-value={item.value}
          data-enabled={item.enabled}
        >
          <button {...dragHandle(index)}>{item.id}</button>
        </div>
      ))}
    </section>
  );
}
async function render(key: string) {
  moves = [];
  await act(async () => root.render(<Harness key={key} />));
  for (const [index, row] of [
    ...document.querySelectorAll<HTMLElement>('[data-query-rule-row]'),
  ].entries()) {
    row.getBoundingClientRect = () => ({ top: 100 + index * 40, height: 30 }) as DOMRect;
    const handle = row.querySelector('button')!,
      captured = new Set<number>();
    handle.setPointerCapture = (id) => {
      captured.add(id);
    };
    handle.hasPointerCapture = (id) => captured.has(id);
    handle.releasePointerCapture = (id) => {
      captured.delete(id);
    };
  }
}
const handle = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-item="${id}"] button`)!;
const order = () =>
  [...document.querySelectorAll<HTMLElement>('[data-item]')].map((row) => [
    row.dataset.item,
    row.dataset.value,
    row.dataset.enabled,
  ]);
async function pointer(id: string, type: string, y: number) {
  await act(async () =>
    handle(id).dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerId: 1,
        clientY: y,
      }),
    ),
  );
}
async function held() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 240)));
}
async function key(id: string, value: string) {
  await act(async () =>
    handle(id).dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value }),
    ),
  );
}

test('long press previews an insertion and commits one reorder without changing rule data', async () => {
  await render('pointer');
  await pointer('a', 'pointerdown', 110);
  expect(handle('a').getAttribute('aria-pressed')).toBe('false');
  await held();
  expect(handle('a').getAttribute('aria-pressed')).toBe('true');
  await pointer('a', 'pointermove', 211);
  expect(document.querySelector('[data-drop-edge="after"]')?.getAttribute('data-item')).toBe('c');
  expect(order().map((row) => row[0])).toEqual(['a', 'b', 'c']);
  await pointer('a', 'pointerup', 211);
  await pointer('a', 'pointerup', 211);
  expect(moves).toEqual([[0, 2]]);
  expect(order()).toEqual([
    ['b', '上海', 'false'],
    ['c', '杭州', 'true'],
    ['a', '北京', 'true'],
  ]);
  expect(document.querySelector('[data-drop-edge]')).toBeNull();
});

test('short clicks and cancelled drags leave the order unchanged and clear pending holds', async () => {
  await render('cancel');
  await pointer('a', 'pointerdown', 110);
  await pointer('a', 'pointerup', 110);
  await held();
  expect(document.querySelector('[data-rule-dragging="true"]')).toBeNull();
  await pointer('a', 'pointerdown', 110);
  await held();
  await pointer('a', 'pointermove', 211);
  await pointer('a', 'pointercancel', 211);
  expect(moves).toEqual([]);
  expect(order().map((row) => row[0])).toEqual(['a', 'b', 'c']);
  expect(document.querySelector('[data-drop-edge]')).toBeNull();
});

test('keyboard pickup supports direction, cancellation and the same insertion commit', async () => {
  await render('keyboard');
  await key('b', ' ');
  await key('b', 'ArrowUp');
  expect(document.querySelector('[data-drop-edge="before"]')?.getAttribute('data-item')).toBe('a');
  await key('b', 'Escape');
  expect(document.querySelector('[data-drop-edge]')).toBeNull();
  expect(moves).toEqual([]);
  await key('b', ' ');
  await key('b', 'ArrowUp');
  await key('b', 'Enter');
  expect(moves).toEqual([[1, 0]]);
  expect(order().map((row) => row[0])).toEqual(['b', 'a', 'c']);
});
