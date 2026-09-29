import { Table } from '@phosphor-icons/react';
import type { NodeType, Node as ProseMirrorNode } from '@tiptap/pm/model';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { withNodeView } from '../../extensions/with-node-view';
import { insertBuiltNodes } from '../insert';
import type { EditorBlockModule } from '../types';
import { TableNodeView } from './table-node-view';

const cell = (type: NodeType | undefined, nodes: Record<string, NodeType>): ProseMirrorNode | null =>
  type && nodes.paragraph ? type.create(null, [nodes.paragraph.create()]) : null;

export const TableModule: EditorBlockModule = {
  name: 'table', icon: Table,
  insert: insertBuiltNodes((nodes) => {
    const header = cell(nodes.tableHeader, nodes);
    const secondHeader = cell(nodes.tableHeader, nodes);
    const body = cell(nodes.tableCell, nodes);
    const secondBody = cell(nodes.tableCell, nodes);
    if (!header || !secondHeader || !body || !secondBody) throw new TypeError('table cell types missing');
    return [nodes.table.create(null, [
      nodes.tableRow.create(null, [header, secondHeader]),
      nodes.tableRow.create(null, [body, secondBody]),
    ])];
  }),
  decorate: (extensions) => withNodeView(extensions, 'table', () => ReactNodeViewRenderer(TableNodeView, {
    contentDOMElementTag: 'tbody', selectedOnTextSelection: true,
  })),
};

export {
  addRow, addColumn, toggleHeaderRow, deleteRow, deleteColumn, deleteTable,
  tableNodeAt, insertRowAbove, insertRowBelow, insertColumnLeft, insertColumnRight,
  toggleTableHeaderRow, removeTableRow, removeTableColumn, removeTable,
} from './table-commands';
export type { ColumnWhere, RowWhere, TableHit } from './table-commands';
