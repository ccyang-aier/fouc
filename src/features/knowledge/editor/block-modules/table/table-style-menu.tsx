'use client';

import { useState, type CSSProperties } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowLineDown, ArrowLineLeft, ArrowLineRight, ArrowLineUp, ArrowsInLineHorizontal, ArrowsOutLineHorizontal, CaretRight, Check, DownloadSimple, Palette, SortAscending, SortDescending, Table, TextAlignCenter, TextAlignLeft, TextAlignRight, Trash } from '@phosphor-icons/react';
import type { Editor } from '@tiptap/core';
import { mergeCells, splitCell } from '@tiptap/pm/tables';
import { addColumn, addRow, deleteColumn, deleteRow, deleteTable, moveTableAxis, sortTableColumn, tableNodeAt, toggleSelectedHeader, toggleAxisHeader, type TableCommand } from './table-commands';
import { TABLE_COLORS, setTableAlignment, setTableColor, type TableAlignment, type TableStyleTarget } from './table-style';
import styles from './table.module.css';
import { TableColorPicker } from './table-color-picker';
import { downloadTableCsv } from './table-csv';

export interface TableMenuAnchor { target: TableStyleTarget; style: CSSProperties; side: 'top' | 'left' | 'bottom' }
const alignments = [
  { value: 'left', label: '左对齐', icon: TextAlignLeft },
  { value: 'center', label: '居中对齐', icon: TextAlignCenter },
  { value: 'right', label: '右对齐', icon: TextAlignRight },
] as const;

export function TableStyleMenu({ tableId, anchor, editor, run, onClose, align, background }: {
  tableId: string; anchor: TableMenuAnchor; editor: Editor; run: (command: TableCommand) => void; onClose: () => void;
  align: TableAlignment | null | undefined; background: string | null | undefined;
}) {
  const target = anchor.target;
  const column = target === 'column';
  const row = target === 'row';
  const structure = row || column;
  const [pickerOffset, setPickerOffset] = useState(-8);
  const placePicker = (element: HTMLElement) => {
    const bounds = element.getBoundingClientRect();
    const viewport = element.ownerDocument.documentElement.clientWidth;
    const width = Math.min(286, viewport - 24);
    setPickerOffset(viewport - bounds.right - 12 >= width || bounds.left - 12 >= width ? -8 : Math.min(-8, viewport - 12 - width - bounds.right));
  };
  const item = (label: string, Icon: typeof ArrowDown, command: TableCommand, danger = false) =>
    <Menu.Item className={styles.menuItem} data-danger={danger || undefined} disabled={!command(editor.state)} onSelect={() => run(command)}><Icon size={18} weight="bold" aria-hidden /><span>{label}</span></Menu.Item>;
  return <Menu.Root open modal={false} onOpenChange={open => { if (!open) onClose(); }}>
    <Menu.Trigger asChild><button type="button" aria-label="表格菜单锚点" tabIndex={-1} className={styles.menuAnchor} style={anchor.style} /></Menu.Trigger>
    <Menu.Portal>
      <Menu.Content data-fouc-table-menu={tableId} className={styles.menu} aria-label={column ? '列操作' : row ? '行操作' : '表格操作'} side={anchor.side} align={row ? 'center' : 'start'} sideOffset={5} collisionPadding={12} onCloseAutoFocus={event => event.preventDefault()} onPointerDownOutside={onClose}>
        <Menu.Sub>
          <Menu.SubTrigger className={styles.menuItem}><TextAlignLeft size={18} weight="bold" aria-hidden /><span>对齐</span><CaretRight size={12} weight="fill" className={styles.caret} aria-hidden /></Menu.SubTrigger>
          <Menu.Portal><Menu.SubContent data-fouc-table-menu={tableId} className={styles.menu} sideOffset={-8} alignOffset={0} collisionPadding={12} aria-label="对齐">
            {alignments.map(({ value, label, icon: Icon }) => <Menu.Item key={value} className={styles.menuItem} onSelect={() => run((s, d) => setTableAlignment(s, d, target, value))}><Icon size={18} weight="bold" aria-hidden /><span>{label}</span>{align !== undefined && (align ?? 'left') === value ? <Check size={18} weight="bold" className={styles.caret} aria-hidden /> : null}</Menu.Item>)}
          </Menu.SubContent></Menu.Portal>
        </Menu.Sub>
        {column ? <Menu.Sub>
          <Menu.SubTrigger className={styles.menuItem} disabled={!sortTableColumn(editor.state, undefined, false)}><SortAscending size={18} weight="bold" aria-hidden /><span>排序</span><CaretRight size={12} weight="fill" className={styles.caret} aria-hidden /></Menu.SubTrigger>
          <Menu.Portal><Menu.SubContent data-fouc-table-menu={tableId} className={styles.menu} sideOffset={-8} collisionPadding={12} aria-label="排序">{item('升序', SortAscending, (s, d) => sortTableColumn(s, d, false))}{item('降序', SortDescending, (s, d) => sortTableColumn(s, d, true))}</Menu.SubContent></Menu.Portal>
        </Menu.Sub> : null}
        <Menu.Sub>
          <Menu.SubTrigger className={styles.menuItem}><Palette size={18} weight="fill" aria-hidden /><span>背景</span><CaretRight size={12} weight="fill" className={styles.caret} aria-hidden /></Menu.SubTrigger>
          <Menu.Portal><Menu.SubContent data-fouc-table-menu={tableId} className={styles.menu} sideOffset={-8} collisionPadding={12} aria-label="背景">
            {TABLE_COLORS.map(color => <Menu.Item key={color.name} className={styles.menuItem} onSelect={() => run((s, d) => setTableColor(s, d, target, color.value))}><span aria-hidden className={styles.swatch} data-empty={!color.value || undefined} style={{ backgroundColor: color.value ?? undefined }} /><span>{color.name}</span>{background?.toLowerCase() === color.value?.toLowerCase() && background !== undefined ? <Check size={18} weight="bold" className={styles.caret} aria-hidden /> : null}</Menu.Item>)}
            <Menu.Sub>
              <Menu.SubTrigger className={styles.menuItem} onPointerEnter={event => placePicker(event.currentTarget)} onFocus={event => placePicker(event.currentTarget)}><span className={`${styles.swatch} ${styles.customSwatch}`} aria-hidden /><span>Custom</span><CaretRight size={12} weight="fill" className={styles.caret} aria-hidden /></Menu.SubTrigger>
              <Menu.Portal><Menu.SubContent data-fouc-table-menu={tableId} className={`${styles.menu} ${styles.pickerMenu}`} sideOffset={pickerOffset} collisionPadding={12} aria-label="自定义背景">
                <TableColorPicker value={background ?? null} onChange={hex => run((s, d) => setTableColor(s, d, target, hex))} />
              </Menu.SubContent></Menu.Portal>
            </Menu.Sub>
          </Menu.SubContent></Menu.Portal>
        </Menu.Sub>
        <Menu.Separator className={styles.menuSeparator} />
        {item('切换标题', Table, structure ? (s, d) => toggleAxisHeader(s, d, column ? 'column' : 'row') : target === 'table' ? (s, d) => toggleAxisHeader(s, d, 'row') : toggleSelectedHeader)}
        {structure ? <>
          {item('在之前插入', column ? ArrowLineLeft : ArrowLineUp, (s, d) => column ? addColumn(s, d, 'left') : addRow(s, d, 'above'))}
          {item('在之后插入', column ? ArrowLineRight : ArrowLineDown, (s, d) => column ? addColumn(s, d, 'right') : addRow(s, d, 'below'))}
          {item(column ? '右移' : '下移', column ? ArrowRight : ArrowDown, (s, d) => moveTableAxis(s, d, column ? 'column' : 'row', 1))}
          {moveTableAxis(editor.state, undefined, column ? 'column' : 'row', -1) ? item(column ? '左移' : '上移', column ? ArrowLeft : ArrowUp, (s, d) => moveTableAxis(s, d, column ? 'column' : 'row', -1)) : null}
        </> : null}
        <Menu.Separator className={styles.menuSeparator} />
        {item('合并单元格', ArrowsInLineHorizontal, mergeCells)}
        {splitCell(editor.state) ? item('拆分单元格', ArrowsOutLineHorizontal, splitCell) : null}
        {target === 'table' ? <><Menu.Separator className={styles.menuSeparator} /><Menu.Item className={styles.menuItem} onSelect={() => { const hit = tableNodeAt(editor.state.selection.$from); if (hit) downloadTableCsv(hit.table, editor.view.dom.ownerDocument); }}><DownloadSimple size={18} weight="bold" aria-hidden /><span>导出为 CSV</span></Menu.Item></> : null}
        <Menu.Separator className={styles.menuSeparator} />
        {item('删除', Trash, target === 'table' ? deleteTable : row ? deleteRow : column ? deleteColumn : (s, d) => { if (d) d(s.tr.deleteSelection()); return true; }, true)}
      </Menu.Content>
    </Menu.Portal>
  </Menu.Root>;
}
