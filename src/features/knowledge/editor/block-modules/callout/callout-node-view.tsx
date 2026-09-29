'use client';

/**
 * The callout NodeView (E05): a light tinted card over the shared schema's
 * `callout` node — 3px tone-colored left edge, tone-derived color-mix wash,
 * and an emoji chip that opens a compact popover (curated emoji grid + tone
 * swatches). `tone` is a free string attr in the schema; unknown values fall
 * back to the neutral rendering, and the editable state gates the chip.
 *
 * The editable `block+` content lives in NodeViewContent so a contentDOM
 * exists — required for ProseMirror/y-prosemirror content binding.
 */

import { useEffect, useRef, useState } from 'react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { cn } from '@/lib/utils';

const CALLOUT_EMOJI = ['💡', '✅', '⚠️', 'ℹ️', '🔥', '⭐', '📌', '📝', '❗', '❓', '🎯', '🚀', '✨', '💬', '🔍', '🧠', '📎', '🗓️', '⚙️', '🛠️', '💼', '🎉', '👀', '🧪'] as const;

interface CalloutTone {
  label: string;
  /** Left edge / swatch color (a design token). */
  accent: string;
  /** Card wash; color-mix keeps both themes coherent. */
  wash: string;
}

const CALLOUT_TONES: Record<string, CalloutTone> = {
  neutral: { label: '中性', accent: 'var(--muted-strong)', wash: 'var(--surface-subtle)' },
  info: { label: '信息', accent: 'var(--accent)', wash: 'color-mix(in srgb, var(--accent) 6%, var(--surface-subtle))' },
  success: { label: '成功', accent: 'var(--ok-ink)', wash: 'color-mix(in srgb, var(--ok-ink) 6%, var(--surface-subtle))' },
  warn: { label: '警告', accent: 'var(--warn-ink)', wash: 'color-mix(in srgb, var(--warn-ink) 7%, var(--surface-subtle))' },
  danger: { label: '危险', accent: 'var(--err-ink)', wash: 'color-mix(in srgb, var(--err-ink) 6%, var(--surface-subtle))' },
};

export function CalloutNodeView({ node, editor, updateAttributes, HTMLAttributes }: NodeViewProps) {
  const emoji = String(node.attrs.emoji || '💡');
  // tone is a free string attr; anything unknown renders as neutral.
  const tone = CALLOUT_TONES[String(node.attrs.tone)] ?? CALLOUT_TONES.neutral;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const closeAndFocusChip = () => {
    setOpen(false);
    chipRef.current?.focus();
  };

  return (
    // Registry attrs are serialized-only (`rendered: false`), so the visible
    // NodeView DOM re-emits the semantic markers itself; the clipboard/HTML
    // serializers stay schema-driven and unaffected by the NodeView.
    <NodeViewWrapper
      as="aside"
      {...HTMLAttributes}
      data-fouc-node="callout"
      data-emoji={node.attrs.emoji}
      data-tone={node.attrs.tone}
      data-block-id={node.attrs.blockId}
      className={cn('my-3 rounded-[10px] border border-l-[3px] transition-colors', 'hover:border-[var(--line-strong)]')}
      style={{ background: tone.wash, borderLeftColor: tone.accent }}
    >
      <div ref={rootRef} className="relative flex items-start gap-3 px-4 py-3">
        <button
          ref={chipRef}
          type="button"
          aria-label="设置提示框图标与语气"
          aria-expanded={open}
          aria-haspopup="dialog"
          title="设置提示框图标与语气"
          disabled={!editor.isEditable}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => (editor.isEditable ? setOpen((value) => !value) : undefined)}
          className="mt-[1px] grid size-7 shrink-0 place-items-center rounded-[8px] border border-[var(--line)] bg-[var(--panel)] text-[15px] leading-none outline-none transition-colors hover:border-[var(--line-strong)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] disabled:opacity-60"
        >
          <span aria-hidden>{emoji}</span>
        </button>
        <NodeViewContent className="min-w-0 flex-1" />
        {open ? (
          <div
            role="dialog"
            aria-label="提示框样式"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closeAndFocusChip();
              }
            }}
            className="overlay-surface absolute left-0 top-[calc(100%+8px)] z-30 w-[272px] rounded-[10px] bg-[var(--elevated)] p-2"
          >
            <div className="grid grid-cols-8 gap-0.5">
              {CALLOUT_EMOJI.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  aria-label={`图标 ${candidate}`}
                  aria-pressed={candidate === emoji}
                  onClick={() => {
                    updateAttributes({ emoji: candidate });
                    closeAndFocusChip();
                  }}
                  className={cn(
                    'grid size-7 place-items-center rounded-[6px] text-[15px] leading-none outline-none transition-colors hover:bg-[var(--raise)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]',
                    candidate === emoji && 'bg-[var(--raise)]',
                  )}
                >
                  <span aria-hidden>{candidate}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1 border-t border-[var(--line)] pt-2">
              {Object.entries(CALLOUT_TONES).map(([name, candidate]) => (
                <button
                  key={name}
                  type="button"
                  aria-label={`语气 ${candidate.label}`}
                  aria-pressed={name === String(node.attrs.tone)}
                  onClick={() => {
                    updateAttributes({ tone: name });
                    closeAndFocusChip();
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-[11px] text-[var(--ink-soft)] outline-none transition-colors hover:bg-[var(--raise)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]',
                    name === String(node.attrs.tone) && 'bg-[var(--raise)] text-[var(--ink)]',
                  )}
                >
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: candidate.accent }} />
                  {candidate.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}
