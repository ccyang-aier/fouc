/**
 * The one Tiptap extension that binds the editor to the page session (E03).
 *
 * `ySyncPlugin` attaches the shared registry schema (E01) to the B04 Y.Doc's
 * page body fragment — the document, never component state, stays the only
 * body authority. `yUndoPlugin` runs on the B08 local undo manager, so undo
 * only ever reverts this connection's own writing, and the y-prosemirror undo
 * helpers restore the selection that belonged to each stack item.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Transaction } from '@tiptap/pm/state';
import { blockIdPluginKey } from '@fouc/shared/knowledge/schema';
import { redo, undo, ySyncPlugin, yUndoPlugin } from 'y-prosemirror';
import type * as Y from 'yjs';
import type { PageUndo } from '../collaboration/page-undo';

/**
 * The page body fragment of the knowledge document model. The collaboration
 * server and the backend indexers read the same name (`PAGE_BODY_FRAGMENT`
 * in backend/src/knowledge/search/backlinks.ts) and it is y-prosemirror's
 * conventional default; keep the three in lockstep.
 */
export const PAGE_BODY_FRAGMENT = 'default';

const historyReconcileKey = new PluginKey('foucPageHistoryReconcile');

/**
 * E02's blockId repairs close every repair-bearing batch with
 * `addToHistory: false` (correct for a plain PM history plugin), but
 * y-prosemirror mirrors the batch's *last* transaction flag onto the single
 * Y transaction it pushes for the whole batch — which would silently drop
 * the user's own block edit from the B08 undo stack.
 *
 * A repair that lands through `appendTransaction` carries the batch's root
 * — the user's change — in its `appendedTransaction` meta (plugins only see
 * the transactions added since their last consultation). A trailing
 * meta-only transaction then restores the flag, so the combined change is
 * pushed and captured as one undoable unit; repair-only dispatches (e.g. the
 * initial `onCreate` pass) are roots themselves and stay out of the history.
 */
function pageHistoryReconcilePlugin() {
  return new Plugin({
    key: historyReconcileKey,
    appendTransaction: (transactions: readonly Transaction[], _oldState, newState) => {
      const last = transactions[transactions.length - 1];
      if (!last || last.getMeta('addToHistory') !== false || last.getMeta(blockIdPluginKey) !== true) return null;
      const root = (last.getMeta('appendedTransaction') as Transaction | undefined) ?? last;
      if (!root.docChanged || root.getMeta(blockIdPluginKey) === true) return null;
      return newState.tr.setMeta(historyReconcileKey, true).setMeta('addToHistory', true);
    },
  });
}

export function pageCollaborationExtension(document: Y.Doc, pageUndo: PageUndo) {
  return Extension.create({
    name: 'foucPageCollaboration',
    addProseMirrorPlugins() {
      return [
        ySyncPlugin(document.getXmlFragment(PAGE_BODY_FRAGMENT)),
        yUndoPlugin({ undoManager: pageUndo.local }),
        pageHistoryReconcilePlugin(),
      ];
    },
    // y-prosemirror ships no keymap of its own and there is no PM history
    // plugin to conflict with (B08's manager is the only undo stack).
    addKeyboardShortcuts() {
      const run = (apply: typeof undo) => () => (this.editor.isEditable ? apply(this.editor.state) : true);
      return {
        'Mod-z': run(undo),
        'Mod-Shift-z': run(redo),
        'Mod-y': run(redo),
      };
    },
  });
}
