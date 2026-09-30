import type { EditorState, Transaction } from '@tiptap/pm/state';
import { tableNodeAt } from './table-commands';
import { CellSelection, TableMap, selectedRect } from '@tiptap/pm/tables';

export type TableStyleTarget = 'cell' | 'row' | 'column' | 'table';
export type TableAlignment = 'left' | 'center' | 'right';
export type TableVariant = 'plain' | 'striped' | 'minimal';

export const TABLE_COLORS = [
  { name: '空', value: null },
  { name: 'Coral', value: '#EAE2D2' },
  { name: 'Apricot', value: '#ECDDD2' },
  { name: 'Sunset', value: '#E9D5D1' },
  { name: 'Smoothie', value: '#DCE4D5' },
  { name: 'Bubblegum', value: '#E3DCEB' },
  { name: 'Neon', value: '#D8E4EA' },
] as const;

export function setTableColor(state: EditorState, dispatch: ((tr: Transaction) => void) | undefined, target: TableStyleTarget, background: string | null): boolean {
  const hit = tableNodeAt(state.selection.$from);
  if (!hit) return false;
  if (target === 'cell' && !hit.cell || target === 'row' && !hit.row || target === 'column' && !hit.cell) return false;
  if (!dispatch) return true;
  const tr = state.tr;
  if (target === 'table') tr.setNodeMarkup(hit.pos, undefined, { ...hit.table.attrs, background });
  if (target === 'cell' || target === 'column') for (const pos of tableTargetCells(state, target)) {
    const cell = state.doc.nodeAt(pos)!;
    tr.setNodeMarkup(pos, undefined, { ...cell.attrs, background });
  }
  if (target === 'row') {
    const rect = selectedRect(state);
    hit.table.forEach((row, offset, index) => {
      if (index >= rect.top && index < rect.bottom) {
        tr.setNodeMarkup(hit.pos + 1 + offset, undefined, { ...row.attrs, background });
        row.forEach((cell, cellOffset) => tr.setNodeMarkup(hit.pos + 2 + offset + cellOffset, undefined, { ...cell.attrs, background: null }));
      }
    });
  }
  dispatch(tr);
  return true;
}

export function setTableAlignment(state: EditorState, dispatch: ((tr: Transaction) => void) | undefined, target: TableStyleTarget, align: TableAlignment): boolean {
  const hit = tableNodeAt(state.selection.$from);
  if (!hit) return false;
  if (target === 'cell' && !hit.cell || target === 'row' && !hit.row || target === 'column' && !hit.cell) return false;
  if (!dispatch) return true;
  const tr = state.tr;
  const setCell = (cell: typeof hit.table, pos: number) => tr.setNodeMarkup(pos, undefined, { ...cell.attrs, align });
  for (const pos of tableTargetCells(state, target)) setCell(state.doc.nodeAt(pos)!, pos);
  dispatch(tr);
  return true;
}

export function tableTargetCells(state: EditorState, target: TableStyleTarget): number[] {
  const hit = tableNodeAt(state.selection.$from);
  if (!hit?.cell) return [];
  if (target === 'cell' && !(state.selection instanceof CellSelection)) return [hit.cell.pos];
  const map = TableMap.get(hit.table);
  const rect = selectedRect(state);
  const area = target === 'table' ? { top: 0, bottom: map.height, left: 0, right: map.width }
    : target === 'row' ? { ...rect, left: 0, right: map.width }
    : target === 'column' ? { ...rect, top: 0, bottom: map.height } : rect;
  return map.cellsInRect(area).map(pos => hit.pos + 1 + pos);
}

export function setTableVariant(state: EditorState, dispatch: ((tr: Transaction) => void) | undefined, variant: TableVariant): boolean {
  const hit = tableNodeAt(state.selection.$from);
  if (!hit) return false;
  if (dispatch) dispatch(state.tr.setNodeMarkup(hit.pos, undefined, { ...hit.table.attrs, variant }));
  return true;
}
