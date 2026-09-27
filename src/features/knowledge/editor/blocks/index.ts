/**
 * Block NodeView assembly (E05): layer React NodeViews for callout, columns
 * and table over the shared E01 registry extensions. The extension list is
 * copied per node (`withNodeView`), so the registry schema — and every other
 * consumer of it — is untouched. Assembly point in the editor surface:
 *
 * ```ts
 * extensions: applyBlockNodeViews([...createKnowledgeExtensions(), …])
 * ```
 *
 * tableRow/tableCell/tableHeader keep default rendering: ProseMirror mounts
 * them inside the table NodeView's contentDOM as plain tr/td/th.
 */

import type { Extensions } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { withNodeView } from '../extensions/with-node-view';
import { CalloutNodeView } from './callout-node-view';
import { ColumnsNodeView } from './columns-node-view';
import { TableNodeView } from './table-node-view';

export {
  addRow,
  addColumn,
  toggleHeaderRow,
  deleteRow,
  deleteColumn,
  deleteTable,
  tableNodeAt,
  insertRowAbove,
  insertRowBelow,
  insertColumnLeft,
  insertColumnRight,
  toggleTableHeaderRow,
  removeTableRow,
  removeTableColumn,
  removeTable,
} from './table-commands';
export type { ColumnWhere, RowWhere, TableHit } from './table-commands';

/** The registry extensions with the callout/columns/table React NodeViews attached. */
export function applyBlockNodeViews(extensions: Extensions): Extensions {
  const withCallout = withNodeView(extensions, 'callout', () => ReactNodeViewRenderer(CalloutNodeView));
  const withColumns = withNodeView(withCallout, 'columns', () => ReactNodeViewRenderer(ColumnsNodeView));
  // `contentDOMElementTag: 'tbody'` makes ProseMirror mount the tbody
  // contentDOM inside the `table` element NodeViewContent renders;
  // `selectedOnTextSelection` keeps the floating toolbar up while the caret
  // sits anywhere inside the table.
  return withNodeView(withColumns, 'table', () => ReactNodeViewRenderer(TableNodeView, {
    contentDOMElementTag: 'tbody',
    selectedOnTextSelection: true,
  }));
}
