import { afterAll, beforeAll, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DocumentAppearanceProvider, useDocumentAppearance } from './document-appearance';
import { updateEditorAppearance } from '@/lib/editor-appearance';

let root: Root;
const browser = new Window({ url: 'http://localhost:3000/' });
beforeAll(() => {
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });

function Probe() {
  const { appearance, update } = useDocumentAppearance();
  return <><output>{JSON.stringify(appearance)}</output><button onClick={() => update({ width: 65, font: 'wenkai' })}>调整当前文档</button></>;
}
async function render(scope: string) {
  await act(async () => root.render(<DocumentAppearanceProvider key={scope} scope={scope}><Probe /></DocumentAppearanceProvider>));
}
function current() { return JSON.parse(document.querySelector('output')!.textContent!); }

test('inherits global defaults while keeping only explicit per-document overrides isolated', async () => {
  updateEditorAppearance({ font: 'serif', width: 90 });
  await render('first');
  expect(current()).toMatchObject({ font: 'serif', width: 90, size: 'standard' });
  await act(async () => document.querySelector('button')!.click());
  await act(async () => updateEditorAppearance({ width: 80, font: 'zhenkai', size: 'large', lineHeight: 2, background: 'warm' }));
  expect(current()).toMatchObject({ width: 65, font: 'wenkai', size: 'large', lineHeight: 2, background: 'warm' });
  expect(JSON.parse(localStorage.getItem('fouc.document.appearance:first')!)).toEqual({ width: 65, font: 'wenkai' });
  await render('second');
  expect(current()).toMatchObject({ width: 80, font: 'zhenkai', size: 'large' });
  await render('first');
  expect(current()).toMatchObject({ width: 65, font: 'wenkai', size: 'large' });
});
