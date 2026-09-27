'use client';

/**
 * The table NodeView (E05): a bordered, horizontally scrollable frame around
 * the real `<table>` plus a floating toolbar (visible while the table holds
 * the selection or is hovered). NodeViewContent renders the table element and
 * ReactNodeViewRenderer mounts the tbody contentDOM inside it, so rows and
 * cells render as plain tr/td through the shared schema's node views.
 *
 * Toolbar actions dispatch the pure table commands from `./table-commands`.
 * When the caret is outside the table (hover activation), the caret is first
 * aimed into the first cell so the command has a current row/column.
 */

import type { FC } from 'react';
import { useState } from 'react';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { TextSelection } from '@tiptap/pm/state';
import { Columns, ColumnsPlusLeft, ColumnsPlusRight, Rows, RowsPlusBottom, RowsPlusTop, TextB, Trash } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { cn } from '@/lib/utils';
import {
  addColumn,
  addRow,
  deleteColumn,
  deleteRow,
  deleteTable,
  toggleHeaderRow,
} from './table-commands';

/** The pure command shape the toolbar dispatches (`./table-commands`). */
type PureTableCommand = (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean;

interface TableAction {
  label: string;
  icon: Icon;
  command: PureTableCommand;
  danger?: boolean;
}

const HEADER_ACTIONS: TableAction[] = [
  { label: '上方插入行', icon: RowsPlusTop, command: (state, dispatch) => addRow(state, dispatch, 'above') },
  { label: '下方插入行', icon: RowsPlusBottom, command: (state, dispatch) => addRow(state, dispatch, 'below') },
  { label: '左侧插入列', icon: ColumnsPlusLeft, command: (state, dispatch) => addColumn(state, dispatch, 'left') },
  { label: '右侧插入列', icon: ColumnsPlusRight, command: (state, dispatch) => addColumn(state, dispatch, 'right') },
  { label: '切换表头行', icon: TextB, command: (state, dispatch) => toggleHeaderRow(state, dispatch) },
];

const DESTRUCTIVE_ACTIONS: TableAction[] = [
  { label: '删除行', icon: Rows, command: (state, dispatch) => deleteRow(state, dispatch), danger: true },
  { label: '删除列', icon: Columns, command: (state, dispatch) => deleteColumn(state, dispatch), danger: true },
  { label: '删除表格', icon: Trash, command: (state, dispatch) => deleteTable(state, dispatch), danger: true },
];

// NodeViewContent types its `as` prop with NoInfer<T>, which pins JSX usage to
// the 'div' default; widen the element union so `as="table"` stays type-safe.
const TableContent = NodeViewContent as unknown as FC<{ as?: 'table' | 'div'; className?: string }>;

export function TableNodeView({ node, editor, getPos, selected, HTMLAttributes }: NodeViewProps) {
  const [hovered, setHovered] = useState(false);

  const run = (command: PureTableCommand) => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const { from, to } = editor.state.selection;
    const inside = from >= pos && to <= pos + node.nodeSize;
    editor
      .chain()
      .focus()
      .command(({ state, dispatch }) => {
        if (!inside && dispatch) {
          // Hover activation with the caret elsewhere: aim into the first
          // cell (table → row → cell → content) so the command has context.
          state.tr.setSelection(TextSelection.near(state.doc.resolve(pos + 3)));
        }
        return command(state, dispatch);
      })
      .run();
  };

  const toolbar = editor.isEditable ? (
    <div
      role="toolbar"
      aria-label="表格操作"
      className={cn(
        'absolute -top-8 right-1.5 z-20 flex items-center gap-0.5 rounded-[8px] border border-[var(--line)] bg-[color-mix(in_srgb,var(--panel)_86%,transparent)] p-0.5 shadow-[0_6px_20px_-8px_rgba(18,23,31,0.28)] backdrop-blur-[6px] transition-opacity',
        selected || hovered ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      {HEADER_ACTIONS.map((action) => <ActionButton key={action.label} action={action} onRun={run} />)}
      <span aria-hidden className="mx-0.5 h-4 w-px bg-[var(--line)]" />
      {DESTRUCTIVE_ACTIONS.map((action) => <ActionButton key={action.label} action={action} onRun={run} />)}
    </div>
  ) : null;

  return (
    <NodeViewWrapper
      as="div"
      {...HTMLAttributes}
      data-fouc-node="table"
      data-block-id={node.attrs.blockId}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative my-3"
    >
      {toolbar}
      <div className="overflow-x-auto rounded-[8px] border border-[var(--line)] bg-[var(--panel)]">
        <TableContent as="table" className="w-full border-collapse" />
      </div>
    </NodeViewWrapper>
  );
}

function ActionButton({ action, onRun }: { action: TableAction; onRun: (command: PureTableCommand) => void }) {
  return (
    <button
      type="button"
      aria-label={action.label}
      title={action.label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onRun(action.command)}
      className={cn(
        'grid size-7 place-items-center rounded-[6px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--raise)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]',
        action.danger ? 'hover:text-[var(--err-ink)]' : 'hover:text-[var(--ink)]',
      )}
    >
      <action.icon aria-hidden className="size-3.5" />
    </button>
  );
}
