/**
 * Table structure commands (E05) as plain ProseMirror commands — no
 * prosemirror-tables dependency. Everything resolves the shared E01 registry
 * node types through the `tableRole` spec metadata the registry preserves, so
 * no second schema knowledge exists here.
 *
 * Structural choices (documented for tests and reviewers):
 * - New cells never preset `blockId`: the E02 plugin mints valid ids on its
 *   repair pass, and preset ids would leak duplicates across copy operations.
 * - Deleting the last row or the last column removes the whole table: the
 *   schema forbids empty tables (`tableRow+` / `(tableCell | tableHeader)+`),
 *   so an honest deletion replaces the husk instead of leaving an invalid one.
 * - Rows/colspans: structural edits keep spanning cells consistent where they
 *   can (a column born inside a span grows it, a column removed from a span
 *   shrinks it); inserting a row clones the current row's column layout with
 *   colspan 1 cells.
 */

import type { Command } from '@tiptap/core';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';

export type RowWhere = 'above' | 'below';
export type ColumnWhere = 'left' | 'right';

export interface TableRowHit {
  node: ProseMirrorNode;
  /** Document position directly before the row. */
  pos: number;
  /** Index of the row within its table. */
  index: number;
}

export interface TableCellHit {
  node: ProseMirrorNode;
  /** Document position directly before the cell. */
  pos: number;
  /** Index of the cell within its row. */
  index: number;
  /** Column the cell starts at — preceding colspans each count as one column. */
  column: number;
}

export interface TableHit {
  table: ProseMirrorNode;
  /** Document position directly before the table. */
  pos: number;
  /** The row around the position, when the position is inside a row. */
  row: TableRowHit | null;
  /** The cell around the position, when the position is inside a cell. */
  cell: TableCellHit | null;
}

const role = (node: ProseMirrorNode): string | undefined => node.type.spec.tableRole;

function colspanOf(node: ProseMirrorNode): number {
  return node.attrs.colspan as number;
}

/** Sum of colspans of the cells before `index` — the cell's start column. */
function columnOf(row: ProseMirrorNode, index: number): number {
  let column = 0;
  for (let i = 0; i < index; i += 1) column += colspanOf(row.child(i));
  return column;
}

/**
 * Resolve the table around `$pos` plus the row and cell around it (when any).
 * Positions are document positions directly before the respective node; tests
 * use them to locate structure without duplicating the walk.
 */
export function tableNodeAt($pos: ResolvedPos): TableHit | null {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const table = $pos.node(depth);
    if (role(table) !== 'table') continue;
    const hit: TableHit = { table, pos: $pos.before(depth), row: null, cell: null };
    for (let inner = $pos.depth; inner > depth; inner -= 1) {
      const node = $pos.node(inner);
      // `$pos.index(d)` indexes the content of the node AT depth d, so the
      // node's own index among its siblings is `index(d - 1)`.
      if (!hit.row && role(node) === 'row') hit.row = { node, pos: $pos.before(inner), index: $pos.index(inner - 1) };
      const cellRole = role(node);
      if (!hit.cell && (cellRole === 'cell' || cellRole === 'header_cell')) {
        hit.cell = { node, pos: $pos.before(inner), index: $pos.index(inner - 1), column: 0 };
      }
    }
    if (hit.row && hit.cell) hit.cell.column = columnOf(hit.row.node, hit.cell.index);
    return hit;
  }
  return null;
}

function createCell(state: EditorState, header: boolean, align: string | null): ProseMirrorNode {
  const type = header ? state.schema.nodes.tableHeader : state.schema.nodes.tableCell;
  return type.createAndFill(
    { align, colspan: 1, rowspan: 1, colwidth: null },
    state.schema.nodes.paragraph.create(),
  )!;
}

/** The row is a header row when its first cell is — how new column cells pick their type. */
function isHeaderRow(row: ProseMirrorNode): boolean {
  return role(row.child(0)) === 'header_cell';
}

/** Insert a row above/below the row around the selection, cloning its column layout. */
export function addRow(state: EditorState, dispatch?: (tr: Transaction) => void, where: RowWhere = 'below'): boolean {
  const hit = tableNodeAt(state.selection.$from);
  if (!hit?.row) return false;
  const { schema } = state;
  const cells: ProseMirrorNode[] = [];
  hit.row.node.forEach((cell) => {
    const header = role(cell) === 'header_cell';
    // colspan cells split into colspan single cells: the row keeps its column
    // count while the new cells stay minimal (empty paragraph, align kept).
    for (let n = 0; n < colspanOf(cell); n += 1) cells.push(createCell(state, header, cell.attrs.align));
  });
  if (!cells.length) return false;
  if (dispatch) {
    const tr = state.tr;
    const insertAt = where === 'above' ? hit.row.pos : hit.row.pos + hit.row.node.nodeSize;
    tr.insert(insertAt, schema.nodes.tableRow.createAndFill(null, cells)!);
    // Caret lands in the new row's first cell (row → cell → paragraph).
    tr.setSelection(TextSelection.near(tr.doc.resolve(insertAt + 2)));
    tr.scrollIntoView();
    dispatch(tr);
  }
  return true;
}

/** Insert a column left/right of the cell around the selection, in every row. */
export function addColumn(state: EditorState, dispatch?: (tr: Transaction) => void, where: ColumnWhere = 'right'): boolean {
  const hit = tableNodeAt(state.selection.$from);
  if (!hit?.cell) return false;
  const target = where === 'left' ? hit.cell.column : hit.cell.column + colspanOf(hit.cell.node);
  if (dispatch) {
    const tr = state.tr;
    hit.table.forEach((row, rowOffset) => {
      const rowPos = hit.pos + 1 + rowOffset;
      const header = isHeaderRow(row);
      let column = 0;
      let placed = false;
      row.forEach((cell, cellOffset) => {
        if (placed) return;
        const colspan = colspanOf(cell);
        if (column === target) {
          tr.insert(tr.mapping.map(rowPos + 1 + cellOffset), createCell(state, header, null));
          placed = true;
        } else if (target > column && target < column + colspan) {
          // The new column is born inside a spanning cell: the span grows.
          tr.setNodeMarkup(tr.mapping.map(rowPos + 1 + cellOffset), undefined, { ...cell.attrs, colspan: colspan + 1 });
          placed = true;
        }
        column += colspan;
      });
      if (!placed) {
        // Shorter row: append at the end so it also gains the column.
        tr.insert(tr.mapping.map(rowPos + row.nodeSize - 1), createCell(state, header, null));
      }
    });
    tr.scrollIntoView();
    dispatch(tr);
  }
  return true;
}

/** Convert the first row's cells tableHeader ↔ tableCell, keeping content and attrs. */
export function toggleHeaderRow(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const hit = tableNodeAt(state.selection.$from);
  if (!hit) return false;
  const first = hit.table.firstChild;
  if (!first) return false;
  const { schema } = state;
  const toHeader = !isHeaderRow(first);
  if (dispatch) {
    const tr = state.tr;
    const rowPos = hit.pos + 1;
    let changed = false;
    first.forEach((cell, offset) => {
      const target = toHeader ? schema.nodes.tableHeader : schema.nodes.tableCell;
      if (cell.type === target) return;
      tr.setNodeMarkup(rowPos + 1 + offset, target, cell.attrs);
      changed = true;
    });
    if (changed) dispatch(tr);
  }
  return true;
}

/** Delete the whole table around the selection. */
export function deleteTable(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const hit = tableNodeAt(state.selection.$from);
  if (!hit) return false;
  if (dispatch) {
    const tr = state.tr;
    tr.delete(hit.pos, hit.pos + hit.table.nodeSize);
    if (!tr.doc.content.size) tr.insert(0, state.schema.nodes.paragraph.create());
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(hit.pos, tr.doc.content.size))));
    tr.scrollIntoView();
    dispatch(tr);
  }
  return true;
}

/** Delete the row around the selection; the last row takes the table with it. */
export function deleteRow(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const hit = tableNodeAt(state.selection.$from);
  if (!hit?.row) return false;
  if (hit.table.childCount <= 1) return deleteTable(state, dispatch);
  if (dispatch) {
    const tr = state.tr;
    tr.delete(hit.row.pos, hit.row.pos + hit.row.node.nodeSize);
    tr.setSelection(TextSelection.near(tr.doc.resolve(tr.mapping.map(hit.row.pos, -1))));
    tr.scrollIntoView();
    dispatch(tr);
  }
  return true;
}

/** Delete the column of the cell around the selection; the last column takes the table with it. */
export function deleteColumn(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const hit = tableNodeAt(state.selection.$from);
  if (!hit?.cell) return false;
  const target = hit.cell.column;
  let width = 0;
  hit.table.forEach((row) => {
    let columns = 0;
    row.forEach((cell) => { columns += colspanOf(cell); });
    width = Math.max(width, columns);
  });
  if (width <= 1) return deleteTable(state, dispatch);
  if (dispatch) {
    const tr = state.tr;
    hit.table.forEach((row, rowOffset) => {
      const rowPos = hit.pos + 1 + rowOffset;
      let column = 0;
      row.forEach((cell, cellOffset) => {
        const colspan = colspanOf(cell);
        if (column <= target && target < column + colspan) {
          if (colspan > 1) {
            // Removing a column a span covers: shrink the span, keep the cell.
            tr.setNodeMarkup(tr.mapping.map(rowPos + 1 + cellOffset), undefined, { ...cell.attrs, colspan: colspan - 1 });
          } else if (row.childCount <= 1) {
            // The row would end up with zero cells, which the schema forbids;
            // at least one other row keeps cells (width > 1), so remove the row.
            tr.delete(tr.mapping.map(rowPos), tr.mapping.map(rowPos + row.nodeSize));
          } else {
            const from = tr.mapping.map(rowPos + 1 + cellOffset);
            tr.delete(from, from + cell.nodeSize);
          }
        }
        column += colspan;
      });
    });
    tr.setSelection(TextSelection.near(tr.doc.resolve(tr.mapping.map(hit.cell.pos, -1))));
    tr.scrollIntoView();
    dispatch(tr);
  }
  return true;
}

/** Tiptap `Command` adapters so toolbars/tests run these via `editor.commands.command(...)`. */
export const insertRowAbove: Command = ({ state, dispatch }) => addRow(state, dispatch, 'above');
export const insertRowBelow: Command = ({ state, dispatch }) => addRow(state, dispatch, 'below');
export const insertColumnLeft: Command = ({ state, dispatch }) => addColumn(state, dispatch, 'left');
export const insertColumnRight: Command = ({ state, dispatch }) => addColumn(state, dispatch, 'right');
export const toggleTableHeaderRow: Command = ({ state, dispatch }) => toggleHeaderRow(state, dispatch);
export const removeTableRow: Command = ({ state, dispatch }) => deleteRow(state, dispatch);
export const removeTableColumn: Command = ({ state, dispatch }) => deleteColumn(state, dispatch);
export const removeTable: Command = ({ state, dispatch }) => deleteTable(state, dispatch);
