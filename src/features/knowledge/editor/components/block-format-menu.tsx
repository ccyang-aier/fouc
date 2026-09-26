'use client';

/**
 * The block format menu (E04): the toolbar's "文本格式" trigger that lists
 * every basic block type — paragraph, headings, lists, task list, quote,
 * code block, math — with full keyboard access (Arrow/Home/End, Enter,
 * Escape) and the current format checked. Selection runs the same
 * `setBlockFormat` / `insertMathBlock` commands tests assert against; the
 * behavior lives in the pure menu model.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { CaretDown, Code, TextAa } from '@phosphor-icons/react';
import type { Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { currentBlockFormat, insertMathBlock, setBlockFormat } from '../extensions/format/block-format';
import {
  activeFormatItemIndex,
  FORMAT_MENU_ITEMS,
  formatMenuReducer,
  formatTriggerLabel,
} from '../extensions/format/format-menu-model';

export function BlockFormatMenu({ editor, disabled }: { editor: Editor | null; disabled?: boolean }) {
  const [state, dispatch] = useReducer(formatMenuReducer, { open: false, activeIndex: 0 });
  // Re-render on every editor transaction so the read below stays fresh.
  const [, bumpSelection] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reading the ancestors around the selection is cheap; the tick only has
  // to make React re-run this on every editor transaction.
  const format = editor ? currentBlockFormat(editor.state) : null;

  // The active format follows every selection/update of the live editor.
  useEffect(() => {
    if (!editor) return;
    const refresh = () => bumpSelection((tick) => tick + 1);
    editor.on('selectionUpdate', refresh);
    editor.on('update', refresh);
    editor.on('transaction', refresh);
    return () => {
      editor.off('selectionUpdate', refresh);
      editor.off('update', refresh);
      editor.off('transaction', refresh);
    };
  }, [editor]);

  // Close on outside pointer; Escape is handled by the keydown handler.
  useEffect(() => {
    if (!state.open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) dispatch({ type: 'close' });
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [state.open]);

  // Keep the highlighted item in view while navigating.
  useEffect(() => {
    if (!state.open) return;
    listRef.current?.querySelector(`[data-index="${state.activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [state.open, state.activeIndex]);

  const closeAndFocusTrigger = useCallback(() => {
    dispatch({ type: 'close' });
    triggerRef.current?.focus();
  }, []);

  const select = useCallback((index: number) => {
    const item = FORMAT_MENU_ITEMS[index];
    if (!item || !editor) return;
    if (item.format) editor.chain().focus().command(setBlockFormat(item.format)).run();
    else editor.chain().focus().command(insertMathBlock).run();
    closeAndFocusTrigger();
  }, [editor, closeAndFocusTrigger]);

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dispatch({ type: 'open', activeIndex: Math.max(activeFormatItemIndex(format), 0) });
    }
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        dispatch({ type: 'move', delta: 1 });
        break;
      case 'ArrowUp':
        event.preventDefault();
        dispatch({ type: 'move', delta: -1 });
        break;
      case 'Home':
        event.preventDefault();
        dispatch({ type: 'home' });
        break;
      case 'End':
        event.preventDefault();
        dispatch({ type: 'end' });
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        select(state.activeIndex);
        break;
      case 'Escape':
        event.preventDefault();
        closeAndFocusTrigger();
        break;
      case 'Tab':
        event.preventDefault();
        closeAndFocusTrigger();
        break;
    }
  };

  const label = formatTriggerLabel(format);
  const activeIndex = activeFormatItemIndex(format);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={state.open}
        aria-label={`文本格式：${label}`}
        title="文本格式"
        disabled={disabled}
        onClick={() => (state.open
          ? dispatch({ type: 'close' })
          : dispatch({ type: 'open', activeIndex: Math.max(activeIndex, 0) }))}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'flex h-7 items-center gap-1 rounded-[6px] px-1.5 text-[12px] text-[var(--muted-strong)] outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]',
          disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-[var(--raise)] hover:text-[var(--ink)]',
        )}
      >
        {format?.kind === 'codeBlock' ? <Code aria-hidden className="size-3.5" /> : <TextAa aria-hidden className="size-3.5" />}
        <span className="max-w-[7rem] truncate">{label}</span>
        <CaretDown aria-hidden className="size-3 opacity-70" />
      </button>
      {state.open ? (
        <div
          ref={listRef}
          role="menu"
          aria-label="块格式"
          onKeyDown={onMenuKeyDown}
          className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-[320px] w-52 overflow-y-auto rounded-[10px] border border-[var(--line)] bg-[var(--panel)] p-1 shadow-[0_8px_28px_rgba(0,0,0,0.14)]"
        >
          {FORMAT_MENU_ITEMS.map((item, index) => {
            const checked = index === activeIndex;
            const highlighted = index === state.activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                data-index={index}
                onClick={() => select(index)}
                onMouseEnter={() => dispatch({ type: 'open', activeIndex: index })}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-[7px] px-2.5 py-1.5 text-left text-[12.5px] outline-none',
                  highlighted ? 'bg-[var(--raise)] text-[var(--ink)]' : 'text-[var(--ink-soft)]',
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      'size-1.5 rounded-full',
                      checked ? 'bg-[var(--accent)]' : 'bg-transparent',
                    )}
                  />
                  {item.label}
                </span>
                {item.hint ? <span aria-hidden className="font-[var(--font-code)] text-[11px] text-[var(--muted)]">{item.hint}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
