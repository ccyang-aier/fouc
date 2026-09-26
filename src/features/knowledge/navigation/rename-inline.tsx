'use client';

/**
 * The inline rename input of one tree row (U03). Replaces the row title while
 * active: Enter commits, Escape reverts, blur commits what is there. The
 * empty/whitespace commit keeps the page untitled (title `''` is a legal
 * contract value and renders as the untitled label), and the input reports
 * the exit intent so the tree can hand focus back to the row.
 */

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export function RenameInline({
  initialTitle,
  onCommit,
  onCancel,
  onExit,
  disabled,
}: {
  initialTitle: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
  /** Called with the chosen exit ('commit' | 'cancel') after the value was dispatched; returns focus to the row. */
  onExit: (intent: 'commit' | 'cancel') => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  const finish = (intent: 'commit' | 'cancel') => {
    if (disabled) return;
    if (intent === 'commit') onCommit(inputRef.current?.value ?? '');
    else onCancel();
    onExit(intent);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={initialTitle}
      maxLength={500}
      disabled={disabled}
      aria-label="页面标题"
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          finish('commit');
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          finish('cancel');
        }
      }}
      onBlur={() => finish('commit')}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'h-[22px] min-w-0 flex-1 rounded-[4px] border border-[var(--accent)] bg-[var(--panel)] px-1 text-[12.5px] leading-none text-[var(--ink)] outline-none',
        'placeholder:text-[var(--muted)] disabled:opacity-50',
      )}
      placeholder="无标题页面"
    />
  );
}
