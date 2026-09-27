/**
 * The comment anchor rendering layer of the editor (N02, design §4.6).
 *
 * One ProseMirror plugin paints every `comment` mark in the document: an
 * amber underline that rides the CRDT, plus a compact count badge at the
 * anchor's start so long pages stay navigable. The React controller owns the
 * *meaning* of each thread (resolved / pending / orphan / active) and pushes
 * it through meta transactions; the plugin only renders what it is told, so
 * remote CRDT updates and local data refreshes converge on the same pass.
 * Clicking an anchor selects its thread; the badge click does the same.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { collectCommentAnchors, commentThreadIdAt } from './comment-anchors';

/** Thread presentation the controller refreshes as query data changes. */
export interface CommentAnchorContext {
  /** Thread ids the database reports as resolved. */
  resolved: ReadonlySet<string>;
  /** Anchored ids with no thread in the database (creation pending counts as neither). */
  orphan: ReadonlySet<string>;
  /** Ids of anchors still composing — created locally, not yet persisted. */
  pending: ReadonlySet<string>;
  /** Comment count per thread, for the anchor badge. */
  counts: ReadonlyMap<string, number>;
}

export const emptyCommentAnchorContext: CommentAnchorContext = {
  resolved: new Set(), orphan: new Set(), pending: new Set(), counts: new Map(),
};

export interface CommentAnchorPluginState {
  activeThreadId: string | null;
  flashThreadId: string | null;
  decorations: DecorationSet;
}

type CommentAnchorMeta =
  | { type: 'select'; id: string | null }
  | { type: 'flash'; id: string | null }
  | { type: 'context' };

export const commentsPluginKey = new PluginKey<CommentAnchorPluginState>('foucCommentAnchors');

/** The active comment thread of a state, if any. */
export function activeCommentThreadId(state: EditorState): string | null {
  return commentsPluginKey.getState(state)?.activeThreadId ?? null;
}

function anchorClasses(threadId: string, context: CommentAnchorContext, plugin: { activeThreadId: string | null; flashThreadId: string | null }): string {
  let classes = 'fouc-comment-anchor';
  if (context.resolved.has(threadId)) classes += ' fouc-comment-resolved';
  if (context.orphan.has(threadId)) classes += ' fouc-comment-orphan';
  if (context.pending.has(threadId)) classes += ' fouc-comment-pending';
  if (plugin.activeThreadId === threadId) classes += ' fouc-comment-active';
  if (plugin.flashThreadId === threadId) classes += ' fouc-comment-flash';
  return classes;
}

function badgeElement(threadId: string, context: CommentAnchorContext): HTMLElement {
  const badge = document.createElement('span');
  const count = context.counts.get(threadId);
  badge.className = 'fouc-comment-badge';
  badge.dataset.commentThread = threadId;
  if (context.resolved.has(threadId)) badge.dataset.resolved = 'true';
  badge.textContent = context.resolved.has(threadId) ? '✓' : String(Math.max(count ?? 1, 1));
  badge.title = context.resolved.has(threadId) ? '已解决的评论' : `${Math.max(count ?? 1, 1)} 条评论`;
  return badge;
}

function buildDecorations(doc: ProseMirrorNode, context: CommentAnchorContext, plugin: CommentAnchorPluginState): DecorationSet {
  const decorations: Decoration[] = [];
  for (const anchor of collectCommentAnchors(doc)) {
    const first = anchor.ranges.reduce((min, range) => (range.from < min.from ? range : min));
    // The badge content follows the live context (count / resolved): a key
    // change replaces the widget, so a new reply re-renders the count.
    const count = Math.max(context.counts.get(anchor.threadId) ?? 1, 1);
    const resolved = context.resolved.has(anchor.threadId);
    decorations.push(Decoration.widget(first.from, () => badgeElement(anchor.threadId, context), {
      side: -1,
      key: `fouc-comment-badge-${anchor.threadId}-${count}-${resolved ? 'r' : 'o'}`,
    }));
    for (const range of anchor.ranges) {
      decorations.push(Decoration.inline(range.from, range.to, {
        class: anchorClasses(anchor.threadId, context, plugin),
        'data-comment-thread': anchor.threadId,
      }));
    }
  }
  return DecorationSet.create(doc, decorations);
}

/** The context the plugin renders with; lives in per-editor extension storage. */
function anchorContextOf(storage: { context?: CommentAnchorContext }): CommentAnchorContext {
  return storage.context ?? emptyCommentAnchorContext;
}

/** The Tiptap extension's storage shape (one context per editor instance). */
export type CommentAnchorStorage = { context: CommentAnchorContext };

/** Reads this extension's storage off any editor-like object. */
function anchorStorageOf(editor: { storage?: unknown }): CommentAnchorStorage | undefined {
  const storage = (editor as { storage?: Record<string, unknown> }).storage;
  const mine = storage?.foucCommentAnchors as CommentAnchorStorage | undefined;
  return mine ?? undefined;
}

/** Reads the live context of an editor (null before the extension mounts). */
export function commentAnchorContextOfEditor(editor: { storage?: unknown }): CommentAnchorContext | null {
  const storage = anchorStorageOf(editor);
  return storage ? anchorContextOf(storage) : null;
}

/**
 * Swaps the context an editor renders anchors with. The caller follows up
 * with a meta-only `context` dispatch (or any transaction) to rebuild the
 * decorations; returning false means the extension is not mounted.
 */
export function setCommentAnchorContextOnEditor(editor: { storage?: unknown }, context: CommentAnchorContext): boolean {
  const storage = anchorStorageOf(editor);
  if (!storage) return false;
  storage.context = context;
  return true;
}

function createCommentAnchorPlugin(storage: CommentAnchorStorage): Plugin<CommentAnchorPluginState> {
  return new Plugin<CommentAnchorPluginState>({
    key: commentsPluginKey,
    state: {
      init(_, state) {
        const initial: CommentAnchorPluginState = { activeThreadId: null, flashThreadId: null, decorations: DecorationSet.empty };
        return { ...initial, decorations: buildDecorations(state.doc, anchorContextOf(storage), initial) };
      },
      apply(tr: Transaction, previous: CommentAnchorPluginState, _oldState, newState): CommentAnchorPluginState {
        const meta = tr.getMeta(commentsPluginKey) as CommentAnchorMeta | undefined;
        let { activeThreadId } = previous;
        let { flashThreadId } = previous;
        if (meta?.type === 'select') activeThreadId = meta.id;
        if (meta?.type === 'flash') flashThreadId = meta.id;
        const context = anchorContextOf(storage);
        if (tr.docChanged) {
          // An anchor whose text was deleted entirely stops being selectable.
          const anchored = new Set(collectCommentAnchors(tr.doc).map((anchor) => anchor.threadId));
          if (activeThreadId !== null && !anchored.has(activeThreadId)) activeThreadId = null;
          if (flashThreadId !== null && !anchored.has(flashThreadId)) flashThreadId = null;
          return { activeThreadId, flashThreadId, decorations: buildDecorations(tr.doc, context, { activeThreadId, flashThreadId, decorations: previous.decorations }) };
        }
        if (meta) {
          return { activeThreadId, flashThreadId, decorations: buildDecorations(newState.doc, context, { activeThreadId, flashThreadId, decorations: previous.decorations }) };
        }
        return { activeThreadId, flashThreadId, decorations: previous.decorations.map(tr.mapping, tr.doc) };
      },
    },
    props: {
      decorations(state: EditorState) {
        return commentsPluginKey.getState(state)?.decorations;
      },
      handleClick(view, pos) {
        const id = commentThreadIdAt(view.state.doc, pos);
        if (id) selectCommentThread(view, id);
        return false;
      },
      handleDOMEvents: {
        // The badge widget is not text; consuming its click keeps the caret put.
        click(view, event) {
          const target = event.target as HTMLElement | null;
          const badge = target?.closest?.('.fouc-comment-badge');
          const id = badge?.getAttribute('data-comment-thread');
          if (id) {
            selectCommentThread(view, id);
            return true;
          }
          return false;
        },
      },
    },
  });
}

/**
 * Focuses one thread's anchor: the caret moves to the anchor start (selection
 * and sidebar agree on what is active) and an optional flash plays once.
 * Selection-only — stays off the B08 undo stack like every caret move.
 */
export function selectCommentThread(view: EditorView, threadId: string | null, options: { flash?: boolean } = {}): void {
  let anchor: number | null = null;
  if (threadId) {
    const found = collectCommentAnchors(view.state.doc).find((candidate) => candidate.threadId === threadId);
    if (!found) return;
    anchor = found.ranges.reduce((min, range) => Math.min(min, range.from), Number.MAX_SAFE_INTEGER);
  }
  const tr = view.state.tr.setMeta(commentsPluginKey, { type: 'select', id: threadId });
  if (anchor !== null) {
    tr.setSelection(TextSelection.near(view.state.doc.resolve(Math.min(anchor + 1, view.state.doc.content.size)), 1));
  }
  tr.setMeta('addToHistory', false);
  view.dispatch(tr);
  if (options.flash && threadId) {
    view.dispatch(view.state.tr
      .setMeta(commentsPluginKey, { type: 'flash', id: threadId })
      .setMeta('addToHistory', false));
  }
}

const commentStylesId = 'fouc-comment-anchor-styles';

/** Injects the anchor presentation CSS once per document (no-op on SSR). */
export function ensureCommentAnchorStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(commentStylesId)) return;
  const style = document.createElement('style');
  style.id = commentStylesId;
  style.textContent = `
.ProseMirror .fouc-comment-anchor{
  background:color-mix(in srgb,var(--warn-ink) 10%,transparent);
  border-bottom:1.5px solid color-mix(in srgb,var(--warn-ink) 55%,transparent);
  border-radius:2px;padding:0 1px;
  box-decoration-break:clone;-webkit-box-decoration-break:clone;
  cursor:pointer;
  transition:background-color .16s ease,box-shadow .16s ease;
}
.ProseMirror .fouc-comment-anchor:hover{background:color-mix(in srgb,var(--warn-ink) 17%,transparent);}
.ProseMirror .fouc-comment-active{
  background:color-mix(in srgb,var(--warn-ink) 18%,transparent);
  box-shadow:0 0 0 1px color-mix(in srgb,var(--warn-ink) 45%,transparent);
}
.ProseMirror .fouc-comment-resolved{
  background:transparent;
  border-bottom-style:dashed;
  border-bottom-color:color-mix(in srgb,var(--muted-strong) 45%,transparent);
}
.ProseMirror .fouc-comment-resolved.fouc-comment-active{
  background:color-mix(in srgb,var(--warn-ink) 10%,transparent);
}
.ProseMirror .fouc-comment-orphan{
  border-bottom-color:color-mix(in srgb,var(--err-ink) 55%,transparent);
  background:color-mix(in srgb,var(--err-ink) 7%,transparent);
}
.ProseMirror .fouc-comment-pending{
  background:color-mix(in srgb,var(--warn-ink) 6%,transparent);
  border-bottom-color:color-mix(in srgb,var(--warn-ink) 35%,transparent);
}
.ProseMirror .fouc-comment-flash{animation:fouc-comment-flash 1.1s ease-out 1;}
@keyframes fouc-comment-flash{
  0%,100%{box-shadow:0 0 0 0 transparent;}
  30%{box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 32%,transparent);}
}
.ProseMirror .fouc-comment-badge{
  display:inline-flex;align-items:center;justify-content:center;
  height:15px;min-width:14px;padding:0 4px;margin:0 3px 0 1px;
  border-radius:4px;border:1px solid var(--warn-soft-line);
  background:var(--warn-soft);color:var(--warn-ink);
  font-size:9px;font-weight:600;letter-spacing:.03em;line-height:1;
  vertical-align:2px;user-select:none;cursor:pointer;white-space:nowrap;
  transition:box-shadow .15s ease,background-color .15s ease;
}
.ProseMirror .fouc-comment-badge:hover{box-shadow:0 1px 5px rgba(18,23,31,.16);}
.ProseMirror .fouc-comment-badge[data-resolved="true"]{
  border-color:var(--line-strong);background:var(--surface-subtle);color:var(--muted-strong);
}
`;
  document.head.append(style);
}

/** The Tiptap extension the page editor's extension set gains for comments. */
export function createCommentsEditorExtension(): Extension {
  return Extension.create<unknown, CommentAnchorStorage>({
    name: 'foucCommentAnchors',
    addStorage() {
      return { context: emptyCommentAnchorContext };
    },
    onCreate() {
      ensureCommentAnchorStyles();
    },
    addProseMirrorPlugins() {
      return [createCommentAnchorPlugin(this.storage)];
    },
  });
}
