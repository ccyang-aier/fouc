import { afterAll, beforeAll, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Editor } from '@tiptap/core';
import { createLocalLibraryStore, emptyLocalLibrary, newLocalDocument } from './local-library';

let root: Root;
let browser: Window;
beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });

test('editing either local pane updates the other pane without echo writes or erasing content', async () => {
  const { LocalDocumentEditor } = await import('./local-document-editor');
  let writes = 0;
  const store = createLocalLibraryStore({ getItem: () => null, setItem: () => { writes++; } }, 'local-split');
  const page = { ...newLocalDocument('base', 'Local split'), body: { type: 'doc', content: [{ type: 'paragraph', attrs: { blockId: 'paragraph' }, content: [{ type: 'text', text: 'Original' }] }] } };
  store.update(current => ({ ...current, documents: [page] }));
  function Pane() {
    const library = useSyncExternalStore(store.subscribe, store.getSnapshot, () => emptyLocalLibrary);
    const document = library.documents[0];
    return <LocalDocumentEditor workspaceId="local-split" store={store} document={document} folderName="Folder" onBack={() => {}} onOpenSidebar={() => {}} onCreateDocument={() => {}} onChange={patch => {
      store.update(current => ({ ...current, documents: current.documents.map(item => ({ ...item, ...patch })) }));
      return true;
    }} />;
  }
  await act(async () => { root.render(<><Pane /><Pane /></>); await new Promise(resolve => setTimeout(resolve, 30)); });
  const editors = Array.from(document.querySelectorAll('.ProseMirror[aria-label="页面正文"]')) as (HTMLElement & { editor: Editor })[];
  expect(editors.length).toBe(2);
  const before = writes;
  await act(async () => { const view = editors[0].editor.view; view.dispatch(view.state.tr.insertText('First ', 1)); });
  expect(editors[0].textContent).toBe('First Original');
  expect(editors[1].textContent).toBe('First Original');
  expect(writes).toBe(before + 1);
  await act(async () => { const view = editors[1].editor.view; view.dispatch(view.state.tr.insertText('Second ', 1)); });
  expect(editors[0].textContent).toBe('Second First Original');
  expect(editors[1].textContent).toBe('Second First Original');
  expect(writes).toBe(before + 2);
  expect(store.getSnapshot().documents[0].body.content?.[0].content?.[0].text).toBe('Second First Original');
});
