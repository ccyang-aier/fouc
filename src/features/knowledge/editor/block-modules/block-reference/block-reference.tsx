'use client';

/**
 * The live read-only block reference card (L02, design §4.6).
 *
 * The shared registry owns the `blockReference` atom node (E01); this layer
 * only attaches its browser presentation via `withNodeView` — the schema stays
 * untouched for every other consumer. Each card holds one source-page
 * connection from the refcounted cache (B04 sessions: offline copy first,
 * reconnects free), renders the referenced block's schema-serialized DOM
 * through a path-gated watcher, and derives its state purely. Clicking a live
 * card publishes an open target through the cross-feature channel — the shell
 * wires it to navigation.
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Extensions } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import type { PageScope } from '@fouc/shared/knowledge/contracts';
import { ArrowSquareOut, ArrowsClockwise, Link, Prohibit, Trash, Warning } from '@phosphor-icons/react';
import { withNodeView } from '../../extensions/with-node-view';
import { PAGE_BODY_FRAGMENT } from '../../page-collaboration';
import { requestOpenPageBlock } from '../../open-target';
import {
  createBlockReferenceSources,
  watchSourceBlock,
} from './block-reference-source';
import type {
  BlockReferenceSnapshot,
  BlockReferenceSources,
  BlockReferenceViewState,
  SourceHandle,
} from './block-reference-source';

export interface BlockReferenceViewOptions {
  /** The page the editor shows — cyclic references are decided against it. */
  scope: PageScope;
  /** Knowledge API origin from U01, used when no `sources` cache is injected. */
  origin: string;
  sources?: BlockReferenceSources;
  /** Content reconvert throttle override (tests); default 150ms. */
  throttleMs?: number;
}

/** Per-editor context the addNodeView closure captures. */
interface BlockReferenceEditorContext {
  readonly scope: PageScope;
  readonly sources: BlockReferenceSources;
  readonly throttleMs?: number;
}

const BlockReferenceContext = createContext<BlockReferenceEditorContext | null>(null);

/**
 * Returns the extension list with the registry's `blockReference` node
 * additionally rendering this NodeView. The input list is never mutated.
 */
export function applyBlockReferenceView(extensions: Extensions, options: BlockReferenceViewOptions): Extensions {
  const context: BlockReferenceEditorContext = {
    scope: options.scope,
    sources: options.sources ?? createBlockReferenceSources({ origin: options.origin }),
    throttleMs: options.throttleMs,
  };
  ensureBlockReferenceStyles();
  return withNodeView(extensions, 'blockReference', () =>
    ReactNodeViewRenderer((props: NodeViewProps) => (
      <BlockReferenceContext.Provider value={context}>
        <BlockReferenceCard {...props} />
      </BlockReferenceContext.Provider>
    )),
  );
}

type ReferenceAttrs = { pageId: string | null; targetBlockId: string | null };

const failedSnapshot: BlockReferenceSnapshot = { state: 'failed', element: null, dom: null };

/** States decidable from attrs alone render without ever opening a connection. */
function localViewState(attrs: ReferenceAttrs, ownScope: PageScope): BlockReferenceViewState | null {
  if (attrs.pageId === ownScope.pageId) return 'cyclic';
  if (!attrs.pageId || !attrs.targetBlockId) return 'unconfigured';
  return null;
}

const accentByState: Record<BlockReferenceViewState, string> = {
  live: 'bg-[var(--accent)]',
  loading: 'bg-[var(--line-strong)]',
  denied: 'bg-[var(--err-ink)]',
  failed: 'bg-[var(--err-ink)]',
  cyclic: 'bg-[var(--warn-ink)]',
  deleted: 'bg-[var(--muted-strong)]',
  unconfigured: 'bg-[var(--line)]',
};

/** The five states rendered as an icon + text notice (never alongside content). */
type BlockReferenceNoticeState = Extract<BlockReferenceViewState, 'denied' | 'failed' | 'deleted' | 'cyclic' | 'unconfigured'>;

const blockReferenceNotices: Record<BlockReferenceNoticeState, { icon: typeof Link; text: string; tone: string }> = {
  denied: { icon: Prohibit, text: '无权访问来源页', tone: 'text-[var(--err-ink)]' },
  failed: { icon: Warning, text: '无法连接来源页', tone: 'text-[var(--err-ink)]' },
  deleted: { icon: Trash, text: '来源块已删除', tone: 'text-[var(--muted-strong)]' },
  cyclic: { icon: ArrowsClockwise, text: '循环引用：来源是当前页面', tone: 'text-[var(--warn-ink)]' },
  unconfigured: { icon: Link, text: '未配置引用', tone: 'text-[var(--muted-strong)]' },
};

function BlockReferenceNotice({ state }: { state: BlockReferenceNoticeState }) {
  const { icon: Icon, text, tone } = blockReferenceNotices[state];
  return (
    <p className={`flex items-center gap-2 py-1 text-[12.5px] ${tone}`}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {text}
    </p>
  );
}

/** Typography for the serialized source block — the page styles, one notch tighter. */
const contentClasses = [
  '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  '[&_p]:my-1 [&_p]:text-[13px] [&_p]:leading-[1.75] [&_p]:text-[var(--ink-soft)]',
  '[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-[18px] [&_h1]:font-semibold [&_h1]:text-[var(--ink)]',
  '[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:text-[var(--ink)]',
  '[&_h3]:mt-2.5 [&_h3]:mb-1 [&_h3]:text-[14.5px] [&_h3]:font-semibold [&_h3]:text-[var(--ink)]',
  '[&_h4]:mt-2 [&_h4]:mb-1 [&_h4]:text-[13.5px] [&_h4]:font-semibold [&_h4]:text-[var(--ink)]',
  '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-0.5 [&_li>p]:my-0',
  '[&_blockquote]:my-1.5 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--line-strong)] [&_blockquote]:pl-3 [&_blockquote]:text-[var(--muted-strong)]',
  '[&_pre]:my-1.5 [&_pre]:overflow-x-auto [&_pre]:rounded-[6px] [&_pre]:bg-[var(--surface-subtle)] [&_pre]:p-2.5 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[11.5px]',
  '[&_code]:font-[var(--font-code)] [&_code]:text-[0.9em] [&_code]:rounded-[4px] [&_code]:bg-[var(--raise)] [&_code]:px-1',
  '[&_strong]:font-semibold [&_strong]:text-[var(--ink)]',
  '[&_em]:italic',
  '[&_a]:text-[var(--accent-ink)] [&_a]:underline [&_a]:underline-offset-2',
  '[&_img]:max-w-full [&_img]:rounded-[6px]',
  '[&_table]:my-1.5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[var(--line)] [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-[var(--line)] [&_td]:px-2 [&_td]:py-1',
].join(' ');

const blockReferenceStylesId = 'fouc-block-reference-styles';

/** Injects the card's keyframes once per document (no-op on SSR). */
function ensureBlockReferenceStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(blockReferenceStylesId)) return;
  const style = document.createElement('style');
  style.id = blockReferenceStylesId;
  style.textContent = `
@keyframes fouc-block-skeleton-shimmer{0%,100%{opacity:.4;}50%{opacity:.85;}}
.ProseMirror .fouc-block-skeleton{border-radius:4px;background:var(--raise);animation:fouc-block-skeleton-shimmer 1.2s ease-in-out infinite;}
`;
  document.head.append(style);
}

function BlockReferenceCard({ node, editor }: NodeViewProps) {
  const context = useContext(BlockReferenceContext);
  const attrs = node.attrs as ReferenceAttrs;
  const pageId = attrs.pageId;
  const targetBlockId = attrs.targetBlockId;
  // Source-backed state arrives only through async events (acquire resolution,
  // session status pushes, throttled watcher notifications) — never a
  // synchronous setState inside an effect.
  const [source, setSource] = useState<BlockReferenceSnapshot>(() => ({ state: 'loading', element: null, dom: null }));
  const contentHost = useRef<HTMLDivElement | null>(null);

  const state = (context ? localViewState(attrs, context.scope) : 'unconfigured') ?? source.state;
  const content = (state === 'live' || state === 'loading') && source.dom ? source.dom : null;

  useEffect(() => {
    if (!context || !pageId || !targetBlockId || pageId === context.scope.pageId) return undefined;
    let alive = true;
    let stopStatus: (() => void) | undefined;
    let watch: ReturnType<typeof watchSourceBlock> | undefined;
    let handle: SourceHandle | undefined;
    context.sources.acquire({ workspaceId: context.scope.workspaceId, pageId })
      .then((acquired) => {
        if (!alive) {
          void acquired.release();
          return;
        }
        handle = acquired;
        watch = watchSourceBlock({
          fragment: acquired.document.getXmlFragment(PAGE_BODY_FRAGMENT),
          attrs: { pageId, targetBlockId },
          ownScope: context.scope,
          status: () => acquired.status(),
          schema: editor.schema,
          throttleMs: context.throttleMs,
        });
        stopStatus = acquired.subscribe(() => watch?.refresh());
        watch.subscribe(() => {
          if (alive && watch) setSource(watch.snapshot());
        });
        setSource(watch.snapshot());
      })
      .catch(() => {
        if (alive) setSource(failedSnapshot);
      });
    return () => {
      alive = false;
      stopStatus?.();
      watch?.dispose();
      void handle?.release();
    };
  }, [context, editor.schema, pageId, targetBlockId]);

  // The serialized subtree is schema-controlled DOM produced by
  // DOMSerializer — painted by replacing children, never injected as HTML text.
  useEffect(() => {
    const host = contentHost.current;
    if (!host) return;
    host.replaceChildren(...(content ? [content] : []));
  }, [content]);

  const open = (): void => {
    if (state !== 'live' || !context || !pageId || !targetBlockId) return;
    if (window.getSelection()?.toString()) return;
    requestOpenPageBlock({ workspaceId: context.scope.workspaceId, pageId, blockId: targetBlockId });
  };

  return (
    <NodeViewWrapper draggable={false} contentEditable={false} className="my-3 select-none" data-block-reference={state}>
      <div
        onClick={state === 'live' ? open : undefined}
        onKeyDown={state === 'live'
          ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              open();
            }
          }
          : undefined}
        role={state === 'live' ? 'button' : undefined}
        tabIndex={state === 'live' ? 0 : undefined}
        aria-label={state === 'live' ? '块引用，点击跳转到原文' : undefined}
        className={`group relative flex overflow-hidden rounded-[10px] border bg-[var(--panel)] transition-colors duration-150 ${
          state === 'live' ? 'cursor-pointer border-[var(--line)] hover:border-[var(--line-strong)]' : 'border-[var(--line)]'
        }`}
      >
        <div aria-hidden className={`w-[3px] shrink-0 ${accentByState[state]}`} />
        <div className="min-w-0 flex-1 px-3.5 py-2.5">
          {content ? (
            <>
              <div ref={contentHost} className={contentClasses} />
              {state === 'loading'
                ? <p className="mt-2 text-[11px] text-[var(--muted)]">正在同步来源内容…</p>
                : null}
            </>
          ) : state === 'live' || state === 'loading' ? (
            <div className="py-1" aria-busy="true" aria-label="正在加载来源块">
              <div className="fouc-block-skeleton h-[11px] w-[62%]" />
              <div className="fouc-block-skeleton mt-1.5 h-[11px] w-[38%]" />
              <p className="mt-2 text-[11.5px] text-[var(--muted)]">正在加载来源块…</p>
            </div>
          ) : (
            <BlockReferenceNotice state={state} />
          )}
        </div>
        {state === 'live' ? (
          <span className="pointer-events-none absolute right-2.5 top-2.5 flex items-center gap-1 rounded-[6px] border border-[var(--line)] bg-[var(--raise)] px-1.5 py-[3px] text-[11px] font-medium text-[var(--muted-strong)] opacity-0 shadow-[0_1px_4px_rgba(18,23,31,0.12)] transition-opacity duration-150 group-hover:opacity-100">
            <ArrowSquareOut aria-hidden className="size-3" />
            跳转到原文
          </span>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}
