'use client';

import type { CSSProperties, FC, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { TextSelection } from '@tiptap/pm/state';
import { Columns, ColumnsPlusLeft, ColumnsPlusRight, DotsThree, PaintBucket, Rows, RowsPlusBottom, RowsPlusTop, TextB, Trash } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { addColumn, addRow, deleteColumn, deleteRow, deleteTable, tableNodeAt, toggleHeaderRow } from './table-commands';
import type { TableStyleTarget } from './table-style';
import { TableStyleMenu } from './table-style-menu';
import styles from './table.module.css';

type TableCommand = (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean;

interface TableAction { label: string; icon: Icon; command: TableCommand; danger?: boolean }

const STRUCTURE_ACTIONS: TableAction[] = [
  { label: '上方插入行', icon: RowsPlusTop, command: (state, dispatch) => addRow(state, dispatch, 'above') },
  { label: '下方插入行', icon: RowsPlusBottom, command: (state, dispatch) => addRow(state, dispatch, 'below') },
  { label: '左侧插入列', icon: ColumnsPlusLeft, command: (state, dispatch) => addColumn(state, dispatch, 'left') },
  { label: '右侧插入列', icon: ColumnsPlusRight, command: (state, dispatch) => addColumn(state, dispatch, 'right') },
  { label: '切换表头行', icon: TextB, command: (state, dispatch) => toggleHeaderRow(state, dispatch) },
];
const DELETE_ACTIONS: TableAction[] = [
  { label: '删除行', icon: Rows, command: (state, dispatch) => deleteRow(state, dispatch), danger: true },
  { label: '删除列', icon: Columns, command: (state, dispatch) => deleteColumn(state, dispatch), danger: true },
  { label: '删除表格', icon: Trash, command: (state, dispatch) => deleteTable(state, dispatch), danger: true },
];

const TableContent = NodeViewContent as unknown as FC<{ as: 'table'; className?: string; 'data-variant'?: string; style?: CSSProperties }>;

interface HoverCell { top: number; left: number; width: number; height: number }

export function TableNodeView({ node, editor, getPos, selected, HTMLAttributes }: NodeViewProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAbove, setMenuAbove] = useState(false);
  const [target, setTarget] = useState<TableStyleTarget>('cell');
  const [hoverCell, setHoverCell] = useState<HoverCell | null>(null);
  const hoveredCellRef = useRef<HTMLTableCellElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  const focusCell = (cell: HTMLTableCellElement) => {
    try {
      const pos = editor.view.posAtDOM(cell, 0);
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(pos))));
    } catch { /* Detached cells can disappear during a collaborative row edit. */ }
  };

  const run = (command: TableCommand) => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const { from, to } = editor.state.selection;
    if (from < pos || to > pos + node.nodeSize) editor.commands.setTextSelection(pos + 3);
    editor.chain().focus().command(({ state, dispatch }) => command(state, dispatch)).run();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const hit = event.target instanceof Element ? event.target.closest('td, th') : null;
    if (!(hit instanceof HTMLTableCellElement) || hoveredCellRef.current === hit) return;
    hoveredCellRef.current = hit;
    const cell = hit.getBoundingClientRect();
    const root = event.currentTarget.getBoundingClientRect();
    setHoverCell({ top: cell.top - root.top, left: cell.left - root.left, width: cell.width, height: cell.height });
  };

  const openFor = (styleTarget: TableStyleTarget) => {
    if (hoveredCellRef.current) focusCell(hoveredCellRef.current);
    setTarget(styleTarget);
    setMenuAbove(window.innerHeight - (menuRef.current?.getBoundingClientRect().bottom ?? 0) < 330);
    setMenuOpen(true);
  };

  const active = tableNodeAt(editor.state.selection.$from);
  const align = active?.cell?.node.attrs.align ?? null;
  const visible = selected || hovered || menuOpen;

  return (
    <NodeViewWrapper
      as="div"
      {...HTMLAttributes}
      data-fouc-node="table"
      data-block-id={node.attrs.blockId}
      className={styles.root}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); if (!menuOpen) { setHoverCell(null); hoveredCellRef.current = null; } }}
      onPointerMove={onPointerMove}
      onContextMenu={(event: ReactMouseEvent<HTMLDivElement>) => {
        const cell = event.target instanceof Element ? event.target.closest('td, th') : null;
        if (!(cell instanceof HTMLTableCellElement) || !editor.isEditable) return;
        event.preventDefault();
        hoveredCellRef.current = cell;
        focusCell(cell);
        setTarget('cell');
        setMenuOpen(true);
      }}
    >
      {editor.isEditable ? (
        <>
          <div role="toolbar" aria-label="表格操作" className={styles.toolbar} data-visible={String(visible)} onMouseDown={(event) => event.preventDefault()}>
            {STRUCTURE_ACTIONS.map((action) => <ActionButton key={action.label} action={action} run={run} />)}
            <span aria-hidden className={styles.separator} />
            <div ref={menuRef} className={styles.menuAnchor}>
              <button type="button" className={styles.toolbarButton} title="表格样式" aria-label="表格样式" aria-expanded={menuOpen} onClick={() => { setTarget('cell'); setMenuAbove(window.innerHeight - (menuRef.current?.getBoundingClientRect().bottom ?? 0) < 330); setMenuOpen((value) => !value); }}><PaintBucket aria-hidden size={16} /></button>
              {menuOpen ? <TableStyleMenu target={target} onTargetChange={setTarget} run={run} variant={node.attrs.variant} align={align} above={menuAbove} /> : null}
            </div>
            <span aria-hidden className={styles.separator} />
            {DELETE_ACTIONS.map((action) => <ActionButton key={action.label} action={action} run={run} />)}
          </div>
          {hoverCell && visible ? <>
            <button type="button" className={styles.handle} title="行样式" aria-label="当前行样式" style={{ top: hoverCell.top + hoverCell.height / 2 - 10, left: -24 }} onMouseDown={(event) => event.preventDefault()} onClick={() => openFor('row')}><DotsThree aria-hidden size={15} weight="bold" /></button>
            <button type="button" className={styles.handle} title="列样式" aria-label="当前列样式" style={{ top: -24, left: hoverCell.left + hoverCell.width / 2 - 10 }} onMouseDown={(event) => event.preventDefault()} onClick={() => openFor('column')}><DotsThree aria-hidden size={15} weight="bold" /></button>
          </> : null}
        </>
      ) : null}
      <div className={styles.shell}>
        <TableContent as="table" className={styles.table} data-variant={node.attrs.variant} style={{ backgroundColor: node.attrs.background ?? undefined }} />
      </div>
    </NodeViewWrapper>
  );
}

function ActionButton({ action, run }: { action: TableAction; run: (command: TableCommand) => void }) {
  return <button type="button" className={styles.toolbarButton} data-danger={String(Boolean(action.danger))} title={action.label} aria-label={action.label} onClick={() => run(action.command)}><action.icon aria-hidden size={16} /></button>;
}
