/**
 * Instance tests of the E05 block NodeViews (callout / columns / table) under
 * happy-dom: a real Tiptap Editor over the shared registry schema, the E02
 * blockId extension and the E04 keyboard set, with `applyEditorBlockModules`
 * layering the React NodeViews. Because ReactNodeViewRenderer only renders
 * once React's EditorContent attaches the portal host, the editor is mounted
 * through a real React root — the same shell the page surface uses.
 *
 * Proven end to end: the NodeViews never fork the schema (specs stay
 * byte-identical), the DOM shows the card/frame structure with a real
 * contentDOM hole, attr updates and the emoji/tone popover round-trip, the
 * table commands run through editor.commands with tr/th DOM reflecting them,
 * and blockId integrity holds across every mutation path (E02 minting for
 * fresh cells, keyboard splits/merges/moves, paste re-identification).
 */

import { Window } from 'happy-dom';
import { beforeAll, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Editor, getSchema } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorContent } from '@tiptap/react';
import {
  createBlockIdExtension,
  createKnowledgeExtensions,
  isKnowledgeBlock,
  isValidBlockId,
  knowledgeSchema,
  reidentifyPastedSlice,
} from '@fouc/shared/knowledge/schema';
import { createBlockEditingExtensions } from '../extensions';
import { applyEditorBlockModules } from '.';
import { insertColumnRight, insertRowBelow, removeTableRow, toggleTableHeaderRow } from './table/table-commands';

const pageId = '00000000-0000-4000-8000-000000000001';

/** The local bun:test ambient types omit bun's third-argument timeout; the runtime supports it. */
const testWithTimeout = test as unknown as (name: string, fn: () => void | Promise<void>, timeoutMs?: number) => void;

let window: Window;

beforeAll(() => {
  window = new Window({ url: 'https://knowledge.fouc.test/page' });
  const globals = window as unknown as Record<string, unknown>;
  for (const key of ['document', 'DOMParser', 'MutationObserver', 'Range', 'getSelection', 'HTMLElement', 'Element', 'Node', 'Text', 'Comment', 'customElements', 'requestAnimationFrame']) {
    if (globals[key] !== undefined) (globalThis as Record<string, unknown>)[key] = globals[key];
  }
  (globalThis as Record<string, unknown>).window = window;
});

interface Mounted {
  editor: Editor;
  dispose: () => void;
}

function mountEditor(): Mounted {
  const container = window.document.createElement('div');
  window.document.body.appendChild(container);
  const host = window.document.createElement('div');
  container.appendChild(host);
  const editor = new Editor({
    element: host as unknown as HTMLElement,
    extensions: [
      ...applyEditorBlockModules([...createKnowledgeExtensions(), createBlockIdExtension({ pageId })]),
      ...createBlockEditingExtensions(),
    ],
  });
  // The React shell that activates ReactNodeViewRenderer's portals.
  const root: Root = createRoot(container as unknown as HTMLElement);
  root.render(createElement(EditorContent, { editor }));
  return {
    editor,
    dispose: () => {
      root.unmount();
      editor.destroy();
      container.remove();
    },
  };
}

/** Let React commit portal updates (concurrent root; a few macrotasks suffice). */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Put the caret at the start/end of the first text node starting with `text`. */
function caretInText(editor: Editor, text: string, where: 'start' | 'end' = 'end'): void {
  let target = -1;
  editor.state.doc.descendants((node, pos) => {
    if (target < 0 && node.isText && node.text?.startsWith(text)) {
      target = where === 'start' ? pos : pos + node.nodeSize;
      return false;
    }
    return true;
  });
  expect(target).toBeGreaterThan(-1);
  editor.commands.setTextSelection(target);
}

/** Dispatch a real keydown on the editor DOM — the full plugin chain runs. */
function press(editor: Editor, key: string): boolean {
  return editor.view.dom.dispatchEvent(new window.KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  }) as unknown as Event);
}

/** Every foucBlock node carries a valid, unique blockId (the E02 invariant). */
function assertValidBlockIds(doc: ProseMirrorNode): void {
  const offenders: string[] = [];
  const seen = new Set<string>();
  doc.descendants((node, pos) => {
    if (!isKnowledgeBlock(node)) return;
    const id = node.attrs.blockId;
    if (!isValidBlockId(id) || seen.has(id)) offenders.push(`${node.type.name}@${pos}=${String(id)}`);
    else seen.add(id);
  });
  expect(offenders).toEqual([]);
}

const CALLOUT_JSON: JSONContent = {
  type: 'callout',
  attrs: { emoji: '✅', tone: 'info' },
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '标题' }] },
    { type: 'paragraph', content: [{ type: 'text', text: '说明' }] },
  ],
};

const COLUMNS_JSON: JSONContent = {
  type: 'columns',
  content: [
    {
      type: 'column',
      attrs: { width: 2 },
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '左一' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '左二' }] },
      ],
    },
    {
      type: 'column',
      attrs: { width: 1 },
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '右一' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '右二' }] },
      ],
    },
  ],
};

function tableJson(): JSONContent {
  return {
    type: 'table',
    content: [0, 1].map((rowIndex) => ({
      type: 'tableRow',
      content: [0, 1].map((columnIndex) => ({
        type: 'tableCell',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: `R${rowIndex}C${columnIndex}` }] }],
      })),
    })),
  };
}

describe('block NodeView schema layer', () => {
  testWithTimeout('applyEditorBlockModules keeps the shared registry schema byte-identical', () => {
    const schema = getSchema(applyEditorBlockModules(createKnowledgeExtensions()));
    expect(Object.keys(schema.nodes).sort()).toEqual(Object.keys(knowledgeSchema.nodes).sort());
    expect(Object.keys(schema.marks).sort()).toEqual(Object.keys(knowledgeSchema.marks).sort());
    for (const name of Object.keys(knowledgeSchema.nodes)) {
      expect(JSON.stringify(schema.spec.nodes.get(name))).toBe(JSON.stringify(knowledgeSchema.spec.nodes.get(name)));
    }
    for (const name of Object.keys(knowledgeSchema.marks)) {
      expect(JSON.stringify(schema.spec.marks.get(name))).toBe(JSON.stringify(knowledgeSchema.spec.marks.get(name)));
    }
  });
});

describe('callout NodeView', () => {
  testWithTimeout('renders the card with data attrs and a real content hole; popover round-trips attrs', async () => {
    const { editor, dispose } = mountEditor();
    try {
      editor.commands.insertContent(CALLOUT_JSON);
      await settle();

      const dom = editor.view.dom;
      const card = dom.querySelector('aside[data-fouc-node="callout"]');
      expect(card).not.toBeNull();
      expect(card!.getAttribute('data-emoji')).toBe('✅');
      expect(card!.getAttribute('data-tone')).toBe('info');
      // The editable block+ content renders inside a contentDOM hole.
      expect(card!.querySelector('[data-node-view-content] [data-node-view-content-react]')).not.toBeNull();
      expect(card!.querySelector('h2')?.textContent).toBe('标题');
      const chipSelector = 'button[aria-label="设置提示框图标与语气"]';
      expect(card!.querySelector(chipSelector)?.textContent).toContain('✅');

      // updateAttributes re-renders chip + data attrs.
      editor.commands.updateAttributes('callout', { emoji: '🔥' });
      await settle();
      const updated = dom.querySelector('aside[data-fouc-node="callout"]')!;
      expect(updated.getAttribute('data-emoji')).toBe('🔥');
      expect(updated.querySelector(chipSelector)?.textContent).toContain('🔥');

      // The chip click opens the popover; picking an emoji writes attrs and closes it.
      updated.querySelector<HTMLButtonElement>(chipSelector)!.dispatchEvent(
        new window.MouseEvent('click', { bubbles: true, cancelable: true }) as unknown as Event,
      );
      await settle();
      const dialog = dom.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      dialog!.querySelector<HTMLButtonElement>('button[aria-label="图标 🚀"]')!.click();
      await settle();
      expect(dom.querySelector('[role="dialog"]')).toBeNull();
      expect(dom.querySelector('aside[data-fouc-node="callout"]')?.getAttribute('data-emoji')).toBe('🚀');

      // A tone swatch updates the tone the same way.
      dom.querySelector<HTMLButtonElement>(chipSelector)!.click();
      await settle();
      dom.querySelector<HTMLButtonElement>('button[aria-label="语气 警告"]')!.click();
      await settle();
      expect(dom.querySelector('aside[data-fouc-node="callout"]')?.getAttribute('data-tone')).toBe('warn');
    } finally {
      dispose();
    }
  }, 15000);
});

describe('columns NodeView', () => {
  testWithTimeout('renders weighted columns with schema-rendered children and editable layout controls', async () => {
    const { editor, dispose } = mountEditor();
    try {
      editor.commands.insertContent(COLUMNS_JSON);
      await settle();

      const wrapper = editor.view.dom.querySelector('[data-fouc-node="columns"]');
      expect(wrapper).not.toBeNull();
      expect(wrapper!.hasAttribute('data-columns')).toBe(true);
      const hole = wrapper!.querySelector('[data-node-view-content]');
      expect(hole).not.toBeNull();
      expect(hole!.querySelectorAll('[data-column]')).toHaveLength(2);
      expect(hole!.querySelector('[data-column]')?.getAttribute('data-width')).toBe('2');
      expect(wrapper!.querySelector('button[aria-label="分栏布局"]')).not.toBeNull();
      expect(hole!.querySelectorAll('[data-column] > p')).toHaveLength(4);
      expect(hole!.textContent).toContain('左二');

      // Browser presentation respects the shared column weights.
      const widths: number[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'column') widths.push(node.attrs.width as number);
      });
      expect(widths).toEqual([2, 1]);
    } finally {
      dispose();
    }
  }, 15000);
});

describe('table NodeView', () => {
  testWithTimeout('renders real tr/td, shows the toolbar with the selection inside, and the commands reshape the DOM', async () => {
    const { editor, dispose } = mountEditor();
    try {
      editor.commands.insertContent(tableJson());
      await settle();

      const tableEl = editor.view.dom.querySelector('table[data-node-view-content]');
      expect(tableEl).not.toBeNull();
      expect(tableEl!.querySelectorAll('tr')).toHaveLength(2);
      expect(tableEl!.querySelectorAll('td')).toHaveLength(4);

      caretInText(editor, 'R1C1');
      await settle();
      const toolbar = editor.view.dom.querySelector('div[role="toolbar"]');
      expect(toolbar).not.toBeNull();
      expect(toolbar!.getAttribute('data-visible')).toBe('true');
      expect(toolbar!.querySelector('button[aria-label="上方插入行"]')).not.toBeNull();
      expect(toolbar!.querySelector('button[aria-label="表格样式"]')).not.toBeNull();
      expect(toolbar!.querySelector('button[aria-label="删除表格"]')).not.toBeNull();

      editor.commands.command(insertRowBelow);
      await settle();
      expect(tableEl!.querySelectorAll('tr')).toHaveLength(3);

      editor.commands.command(insertColumnRight);
      await settle();
      expect(tableEl!.querySelectorAll('tr')[1]!.querySelectorAll('td')).toHaveLength(3);

      editor.commands.command(toggleTableHeaderRow);
      await settle();
      expect(tableEl!.querySelectorAll('th')).toHaveLength(3);
      expect(tableEl!.querySelectorAll('td')).toHaveLength(6);

      editor.commands.command(removeTableRow);
      await settle();
      expect(tableEl!.querySelectorAll('tr')).toHaveLength(2);
    } finally {
      dispose();
    }
  }, 15000);
});

describe('blockId integrity across block mutations', () => {
  testWithTimeout('Enter split, Backspace merge and container unwrap inside a callout keep ids valid', async () => {
    const { editor, dispose } = mountEditor();
    try {
      editor.commands.insertContent({
        type: 'callout',
        attrs: { emoji: '💡', tone: 'neutral' },
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: '第一段' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '第二段' }] },
        ],
      });
      await settle();

      caretInText(editor, '第一段');
      press(editor, 'Enter'); // BlockEnterKey falls through to the core split inside the callout
      await settle();
      expect(editor.state.doc.textContent).toContain('第二段');
      assertValidBlockIds(editor.state.doc);

      // The caret now sits in the split's empty paragraph; Backspace merges it back.
      press(editor, 'Backspace');
      await settle();
      assertValidBlockIds(editor.state.doc);

      caretInText(editor, '第一段', 'start');
      press(editor, 'Backspace'); // BlockBackspaceKey lifts the first block out of the callout
      await settle();
      const topLevel = editor.state.doc.children.map((node) => node.type.name);
      expect(topLevel[0]).toBe('paragraph');
      expect(topLevel).toContain('callout');
      assertValidBlockIds(editor.state.doc);
    } finally {
      dispose();
    }
  }, 15000);

  testWithTimeout('moveBlockDown moves the whole callout with its ids intact', async () => {
    const { editor, dispose } = mountEditor();
    try {
      editor.commands.insertContent(CALLOUT_JSON);
      editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'paragraph', content: [{ type: 'text', text: '尾段' }] });
      await settle();
      caretInText(editor, '标题');
      expect(editor.commands.moveBlockDown()).toBe(true);
      await settle();
      const types = editor.state.doc.children.map((node) => node.type.name);
      expect(types[0]).toBe('paragraph');
      expect(types[1]).toBe('callout');
      assertValidBlockIds(editor.state.doc);
    } finally {
      dispose();
    }
  }, 15000);

  testWithTimeout('table structural edits leave every foucBlock with a valid minted id', async () => {
    const { editor, dispose } = mountEditor();
    try {
      editor.commands.insertContent(tableJson());
      await settle();
      caretInText(editor, 'R0C0');

      const blocksBefore = countBlocks(editor.state.doc);
      editor.commands.command(insertRowBelow);
      // The new row brings 2 cells with an empty paragraph each (+5 foucBlocks).
      expect(countBlocks(editor.state.doc)).toBe(blocksBefore + 5);
      assertValidBlockIds(editor.state.doc);

      editor.commands.command(insertColumnRight);
      // The column adds a cell + paragraph to every one of the 3 rows (+6).
      expect(countBlocks(editor.state.doc)).toBe(blocksBefore + 11);
      assertValidBlockIds(editor.state.doc);

      editor.commands.command(removeTableRow);
      await settle();
      assertValidBlockIds(editor.state.doc);
    } finally {
      dispose();
    }
  }, 15000);

  testWithTimeout('reidentifyPastedSlice mints fresh distinct ids for a nested callout+table slice', () => {
    const schema = knowledgeSchema;
    const cell = (text: string, blockId: string) =>
      schema.nodes.tableCell.create({ blockId }, schema.nodes.paragraph.create(null, schema.text(text)));
    const table = schema.nodes.table.create({ blockId: 'src-table' }, [
      schema.nodes.tableRow.create({ blockId: 'src-row' }, [cell('a', 'src-a'), cell('b', 'src-b')]),
    ]);
    const callout = schema.nodes.callout.create(
      { blockId: 'src-callout', emoji: '💡', tone: 'warn' },
      [schema.nodes.paragraph.create({ blockId: 'src-p' }, schema.text('正文')), table],
    );
    const doc = schema.nodes.doc.create(null, [callout]);

    const identified = reidentifyPastedSlice(doc.slice(0, doc.content.size), { targetPageId: pageId });
    const ids: string[] = [];
    identified.content.descendants((node) => {
      if (!isKnowledgeBlock(node)) return;
      expect(isValidBlockId(node.attrs.blockId)).toBe(true);
      ids.push(node.attrs.blockId as string);
    });
    // callout + paragraph + table + row + (2 cells with a paragraph each) —
    // every foucBlock, all distinct, none reused.
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    for (const source of ['src-callout', 'src-p', 'src-table', 'src-row', 'src-a', 'src-b']) {
      expect(ids).not.toContain(source);
    }
  });
});

function countBlocks(doc: ProseMirrorNode): number {
  let count = 0;
  doc.descendants((node) => {
    if (isKnowledgeBlock(node)) count += 1;
  });
  return count;
}
