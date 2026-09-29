import type { EditorState, Transaction } from '@tiptap/pm/state';
import { tableNodeAt } from './table-commands';

export type TableStyleTarget = 'cell' | 'row' | 'column' | 'table';
export type TableAlignment = 'left' | 'center' | 'right';
export type TableVariant = 'plain' | 'striped' | 'minimal';

export const TABLE_COLORS = [
  { name: '无填充', value: null },
  { name: '珊瑚', value: '#FCE8E5' },
  { name: '杏色', value: '#FFF0DF' },
  { name: '日落', value: '#FBE8D9' },
  { name: '薄荷', value: '#E6F3EC' },
  { name: '海盐', value: '#E5F1F9' },
  { name: '薰衣草', value: '#EEEAFB' },
  { name: '云灰', value: '#EDF1F5' },
] as const;

export function setTableColor(state: EditorState, dispatch: ((tr: Transaction) => void) | undefined, target: TableStyleTarget, background: string | null): boolean {
  const hit = tableNodeAt(state.selection.$from);
  if (!hit) return false;
  if (target === 'cell' && !hit.cell || target === 'row' && !hit.row || target === 'column' && !hit.cell) return false;
  if (!dispatch) return true;
  const tr = state.tr;
  if (target === 'table') tr.setNodeMarkup(hit.pos, undefined, { ...hit.table.attrs, background });
  if (target === 'row' && hit.row) tr.setNodeMarkup(hit.row.pos, undefined, { ...hit.row.node.attrs, background });
  if (target === 'cell' && hit.cell) tr.setNodeMarkup(hit.cell.pos, undefined, { ...hit.cell.node.attrs, background });
  if (target === 'column' && hit.cell) {
    const targetColumn = hit.cell.column;
    hit.table.forEach((row, rowOffset) => {
      let column = 0;
      row.forEach((cell, cellOffset) => {
        if (column <= targetColumn && targetColumn < column + cell.attrs.colspan) {
          tr.setNodeMarkup(hit.pos + 2 + rowOffset + cellOffset, undefined, { ...cell.attrs, background });
        }
        column += cell.attrs.colspan;
      });
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
  if (target === 'cell' && hit.cell) setCell(hit.cell.node, hit.cell.pos);
  if (target === 'row' && hit.row) hit.row.node.forEach((cell, offset) => setCell(cell, hit.row!.pos + 1 + offset));
  if (target === 'column' && hit.cell) {
    const targetColumn = hit.cell.column;
    hit.table.forEach((row, rowOffset) => {
      let column = 0;
      row.forEach((cell, cellOffset) => {
        if (column <= targetColumn && targetColumn < column + cell.attrs.colspan) setCell(cell, hit.pos + 2 + rowOffset + cellOffset);
        column += cell.attrs.colspan;
      });
    });
  }
  if (target === 'table') hit.table.forEach((row, rowOffset) => row.forEach((cell, cellOffset) => setCell(cell, hit.pos + 2 + rowOffset + cellOffset)));
  dispatch(tr);
  return true;
}

export function setTableVariant(state: EditorState, dispatch: ((tr: Transaction) => void) | undefined, variant: TableVariant): boolean {
  const hit = tableNodeAt(state.selection.$from);
  if (!hit) return false;
  if (dispatch) dispatch(state.tr.setNodeMarkup(hit.pos, undefined, { ...hit.table.attrs, variant }));
  return true;
}
