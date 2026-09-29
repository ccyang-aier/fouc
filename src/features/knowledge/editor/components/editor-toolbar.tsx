'use client';

/**
 * The toolbar skeleton of the page editor (E03).
 *
 * Undo and redo are fully real — they run on the B08 local undo manager
 * (the same stack Mod-Z / Mod-Shift-Z drive through yUndoPlugin) and their
 * disabled states follow the manager's stack events. The formatting group is
 * the reserved skeleton: E04 turns it into the block-format controls and the
 * slash menu, so the slot ships as an honest, unreachable placeholder.
 */

import { useEffect, useState } from 'react';
import { ArrowClockwise, ArrowCounterClockwise } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { Editor } from '@tiptap/react';
import { undo, redo, undoDepth, redoDepth } from '@tiptap/pm/history';
import type { PageUndo } from '../../collaboration/page-undo';
import { BlockFormatMenu } from './block-format-menu';

const undoEvents = ['stack-item-added', 'stack-item-popped', 'stack-item-updated'] as const;

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex size-7 items-center justify-center rounded-[6px] text-[var(--muted-strong)] outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]',
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-[var(--raise)] hover:text-[var(--ink)]',
      )}
    >
      {children}
    </button>
  );
}

export function EditorToolbar({ editor, pageUndo, editable }: { editor: Editor | null; pageUndo?: PageUndo; editable: boolean }) {
  // The undo stacks change outside React; subscribe so the disabled states
  // always reflect the B08 manager, not a stale render.
  const [, bump] = useState(0);
  useEffect(() => {
    if (!pageUndo) return;
    const refresh = () => bump((tick) => tick + 1);
    for (const event of undoEvents) pageUndo.local.on(event, refresh);
    return () => {
      for (const event of undoEvents) pageUndo.local.off(event, refresh);
    };
  }, [pageUndo]);
  useEffect(() => {
    if (!editor || pageUndo) return;
    const refresh = () => bump((tick) => tick + 1);
    editor.on('transaction', refresh);
    return () => { editor.off('transaction', refresh); };
  }, [editor, pageUndo]);

  const blocked = !editable;

  return (
    <div role="toolbar" aria-label="页面编辑工具" className="flex items-center gap-0.5">
      <ToolbarButton
        label="撤销"
        disabled={blocked || (pageUndo ? !pageUndo.canUndo() : !editor || undoDepth(editor.state) === 0)}
        onClick={() => {
          if (pageUndo) pageUndo.undo();
          else if (editor) undo(editor.state, editor.view.dispatch);
          // DOM focus only — a focus transaction here would (via the Y
          // binding) clear the redo stack that this button just filled.
          editor?.view.focus();
        }}
      >
        <ArrowCounterClockwise aria-hidden className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="重做"
        disabled={blocked || (pageUndo ? !pageUndo.canRedo() : !editor || redoDepth(editor.state) === 0)}
        onClick={() => {
          if (pageUndo) pageUndo.redo();
          else if (editor) redo(editor.state, editor.view.dispatch);
          editor?.view.focus();
        }}
      >
        <ArrowClockwise aria-hidden className="size-3.5" />
      </ToolbarButton>
      <span aria-hidden className="mx-1.5 h-4 w-px bg-[var(--line)]" />
      <BlockFormatMenu editor={editor} disabled={blocked} />
    </div>
  );
}
