'use client';

/**
 * The comment composer (N02): one compact write surface reused by the
 * selection popover (new thread) and the reply box of a thread card. It owns
 * exactly the text — sending state, failure and the retry/discard affordances
 * arrive as props so every lifecycle decision stays with the controller.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react';
import { commentBodySchema } from '@fouc/shared/knowledge/comments';

export interface CommentComposerProps {
  placeholder: string;
  submitLabel: string;
  /** The in-flight label while the mutation runs ('发送中…'). */
  sendingLabel: string;
  sending: boolean;
  /** Failure copy of the last attempt; the anchor stays until resolved. */
  error?: string | null;
  onSubmit: (bodyMd: string) => void;
  onCancel: () => void;
  /** Extra row rendered under the textarea (the popover's discard action). */
  extraAction?: React.ReactNode;
  autoFocus?: boolean;
  minHeight?: number;
}

export function CommentComposer({
  placeholder,
  submitLabel,
  sendingLabel,
  sending,
  error,
  onSubmit,
  onCancel,
  extraAction,
  autoFocus = true,
  minHeight = 64,
}: CommentComposerProps) {
  const [body, setBody] = useState('');
  const [touched, setTouched] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.max(element.scrollHeight, minHeight)}px`;
  }, [body, minHeight]);

  const trimmed = body.trim();
  const invalid = touched && !commentBodySchema.safeParse(trimmed).success;

  const submit = () => {
    setTouched(true);
    if (!commentBodySchema.safeParse(trimmed).success || sending) return;
    onSubmit(trimmed);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        ref={ref}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        rows={2}
        className="w-full resize-none rounded-[7px] border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[12.5px] leading-relaxed text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent-soft-line)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
      />
      {invalid ? (
        <p className="flex items-center gap-1 text-[11px] text-[var(--err-ink)]">
          <WarningCircle aria-hidden className="size-3" weight="fill" />
          评论内容不能为空，且不超过 50000 字符。
        </p>
      ) : null}
      {error ? (
        <p className="flex items-start gap-1 text-[11px] leading-relaxed text-[var(--err-ink)]" role="alert">
          <WarningCircle aria-hidden className="mt-0.5 size-3 shrink-0" weight="fill" />
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">{extraAction}</div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-7 rounded-[6px] px-2.5 text-[11.5px] font-medium text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--raise)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="flex h-7 items-center gap-1.5 rounded-[6px] bg-[var(--accent)] px-2.5 text-[11.5px] font-medium text-white outline-none transition-colors hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            <PaperPlaneTilt aria-hidden className="size-3" weight="bold" />
            {sending ? sendingLabel : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
