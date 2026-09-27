/**
 * Unit tests of the cross-feature open/highlight channel (L02): subscription
 * fan-out, the one-shot latest-wins staging semantics, and the editor reveal
 * (flash class lands on the right block's DOM node and is removed on its
 * timer) against a real ProseMirror view under happy-dom.
 */

import { Window } from 'happy-dom';
import { beforeAll, describe, expect, test } from 'bun:test';
import { EditorState } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { knowledgeSchema } from '@fouc/shared/knowledge/schema';
import {
  requestOpenPageBlock,
  revealBlockInEditor,
  stageBlockHighlight,
  subscribeOpenPageTarget,
  takeStagedBlockHighlight,
} from './open-target';
import type { OpenPageTarget } from './open-target';

let window: Window;

beforeAll(() => {
  window = new Window({ url: 'https://knowledge.fouc.test/page' });
  const globals = window as unknown as Record<string, unknown>;
  for (const key of ['document', 'DOMParser', 'MutationObserver', 'Range', 'getSelection', 'HTMLElement', 'Element', 'Node', 'Text', 'Comment', 'customElements', 'requestAnimationFrame', 'Event', 'MouseEvent']) {
    if (globals[key] !== undefined) (globalThis as Record<string, unknown>)[key] = globals[key];
  }
  (globalThis as Record<string, unknown>).window = window;
});

describe('open page target channel', () => {
  test('requests fan out to current subscribers only', () => {
    const seenA: OpenPageTarget[] = [];
    const seenB: OpenPageTarget[] = [];
    const stopA = subscribeOpenPageTarget((target) => seenA.push(target));
    const stopB = subscribeOpenPageTarget((target) => seenB.push(target));

    requestOpenPageBlock({ workspaceId: 'ws-1', pageId: 'page-1' });
    expect(seenA).toEqual([{ workspaceId: 'ws-1', pageId: 'page-1' }]);
    expect(seenB).toEqual([{ workspaceId: 'ws-1', pageId: 'page-1' }]);

    stopA();
    requestOpenPageBlock({ workspaceId: 'ws-1', pageId: 'page-2' });
    expect(seenA).toHaveLength(1);
    expect(seenB).toEqual([
      { workspaceId: 'ws-1', pageId: 'page-1' },
      { workspaceId: 'ws-1', pageId: 'page-2' },
    ]);
    stopB();
  });

  test('a blockId request also stages the highlight for its page', () => {
    const target = { workspaceId: 'ws-1', pageId: 'page-1', blockId: 'blk-9' };
    requestOpenPageBlock(target);
    expect(takeStagedBlockHighlight('page-1')).toEqual({ blockId: 'blk-9' });
  });

  test('staged highlights are one-shot and latest wins per page', () => {
    stageBlockHighlight({ pageId: 'page-1', blockId: 'blk-a' });
    stageBlockHighlight({ pageId: 'page-1', blockId: 'blk-b' });
    stageBlockHighlight({ pageId: 'page-2', blockId: 'blk-c' });

    expect(takeStagedBlockHighlight('page-1')).toEqual({ blockId: 'blk-b' });
    expect(takeStagedBlockHighlight('page-1')).toBeNull();
    expect(takeStagedBlockHighlight('page-2')).toEqual({ blockId: 'blk-c' });
    expect(takeStagedBlockHighlight('page-unknown')).toBeNull();
  });
});

describe('revealBlockInEditor', () => {
  function viewWithBlocks(): EditorView {
    const doc = knowledgeSchema.topNodeType.create(null, [
      knowledgeSchema.nodes.heading.create({ level: 2, blockId: 'blk-head' }, [knowledgeSchema.text('标题')]),
      knowledgeSchema.nodes.paragraph.create({ blockId: 'blk-para' }, [knowledgeSchema.text('正文')]),
      knowledgeSchema.nodes.paragraph.create({ blockId: null }, [knowledgeSchema.text('无 ID')]),
    ]);
    const host = window.document.createElement('div');
    window.document.body.appendChild(host);
    return new EditorView({ mount: host as unknown as HTMLElement }, { state: EditorState.create({ doc }) });
  }

  test('flashes the block with the matching blockId and reports absence', async () => {
    const view = viewWithBlocks();
    expect(revealBlockInEditor(view, 'missing')).toBe(false);

    expect(revealBlockInEditor(view, 'blk-head')).toBe(true);
    const heading = view.dom.querySelector('h2');
    expect(heading?.classList.contains('fouc-block-flash')).toBe(true);
    expect(view.dom.querySelector('p')?.classList.contains('fouc-block-flash')).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1_350));
    expect(heading?.classList.contains('fouc-block-flash')).toBe(false);
    view.destroy();
  });

  test('an invalid blockId never matches', () => {
    const view = viewWithBlocks();
    expect(revealBlockInEditor(view, 'bad#id')).toBe(false);
    expect(revealBlockInEditor(view, '')).toBe(false);
    view.destroy();
  });
});
