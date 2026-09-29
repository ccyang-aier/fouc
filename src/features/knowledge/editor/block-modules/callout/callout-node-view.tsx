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
import type { CSSProperties } from 'react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import styles from './callout.module.css';

const CALLOUT_EMOJI = ['💡', '✅', '⚠️', 'ℹ️', '🔥', '⭐', '📌', '📝', '❗', '❓', '🎯', '🚀', '✨', '💬', '🔍', '🧠', '📎', '🗓️', '⚙️', '🛠️', '💼', '🎉', '👀', '🧪'] as const;

interface CalloutTone {
  label: string;
  /** Left edge / swatch color (a design token). */
  accent: string;
  /** Card wash; color-mix keeps both themes coherent. */
  wash: string;
}

const CALLOUT_TONES: Record<string, CalloutTone> = {
  neutral: { label: '普通', accent: '#6d7d92', wash: '#f7f9fc' },
  info: { label: '提示', accent: '#3077cc', wash: '#f2f7ff' },
  success: { label: '成功', accent: '#2e916d', wash: '#f0faf5' },
  warn: { label: '警告', accent: '#c18a31', wash: '#fff9ed' },
  danger: { label: '错误', accent: '#c65652', wash: '#fff4f3' },
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
      className={styles.root}
      style={{ '--callout-accent': tone.accent, '--callout-wash': tone.wash } as CSSProperties}
    >
      <div ref={rootRef} className={styles.inner}>
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
          className={styles.iconButton}
        >
          <span aria-hidden>{emoji}</span>
        </button>
        <div className={styles.content}>
          <span contentEditable={false} className={styles.toneLabel}>{tone.label}</span>
          <NodeViewContent className={styles.editable} />
        </div>
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
            className={styles.menu}
          >
            <div className={styles.menuTitle}>图标</div>
            <div className={styles.emojiGrid}>
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
                  className={styles.emojiOption}
                >
                  <span aria-hidden>{candidate}</span>
                </button>
              ))}
            </div>
            <div className={styles.menuTitle}>提示等级</div>
            <div className={styles.toneGrid}>
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
                  className={styles.toneOption}
                >
                  <span aria-hidden className={styles.swatch} style={{ background: candidate.accent }} />
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
