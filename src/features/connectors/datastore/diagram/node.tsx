import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './node.messages';
import {
  ER_HEADER_HEIGHT,
  ER_ROW_HEIGHT,
  type ErDiagramBox,
  type ErDiagramColumn,
  type ErDiagramNode,
} from '@fouc/shared/er-diagram';
import styles from './diagram.module.css';
const shorten = (value: string, max: number) =>
  [...value].length > max ? [...value].slice(0, max - 1).join('') + '…' : value;
export function DiagramTableNode({
  node,
  box,
  columns,
  selected,
  dimmed,
  selectedColumn,
  onSelect,
}: {
  node: ErDiagramNode;
  box: ErDiagramBox;
  columns: readonly ErDiagramColumn[];
  selected: boolean;
  dimmed: boolean;
  selectedColumn?: string;
  onSelect: (nodeId: string, column?: string) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  return (
    <g
      transform={`translate(${box.x},${box.y})`}
      data-er-node={node.id}
      className={`${styles.node} ${selected ? styles.selectedNode : ''} ${node.external ? styles.external : ''} ${dimmed ? styles.dimmed : ''}`}
      role="button"
      tabIndex={0}
      aria-label={tConnector('table', {
        p0: String(node.schema),
        p1: String(node.table),
        p2: String(node.external ? tConnector('structureNotLoaded') : ''),
      })}
      onClick={() => onSelect(node.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          onSelect(node.id);
        }
      }}
    >
      <title>
        {node.schema}.{node.table}
        {node.comment ? `\n${node.comment}` : ''}
      </title>
      <rect className={styles.card} width={box.width} height={box.height} rx={9} />
      <rect className={styles.stripe} width={4} height={box.height} rx={2} />
      <g data-er-drag="true" className={styles.cardHeader}>
        <rect width={box.width} height={ER_HEADER_HEIGHT} fill="transparent" />
        <text x={15} y={19} className={styles.schema}>
          {shorten(node.schema, 33)}
          {node.external
            ? tConnector('notLoaded')
            : node.kind === 'view'
              ? ' · VIEW'
              : node.kind === 'materialized_view'
                ? ' · MATERIALIZED VIEW'
                : ''}
        </text>
        <text x={15} y={40} className={styles.tableName}>
          {shorten(node.table, 31)}
        </text>
        <text x={box.width - 13} y={40} textAnchor="end" className={styles.count}>
          {node.columns.length}
        </text>
      </g>
      {columns.map((column, index) => {
        const y = ER_HEADER_HEIGHT + index * ER_ROW_HEIGHT;
        return (
          <g
            key={column.name}
            data-er-column={column.name}
            className={`${styles.column} ${selectedColumn === column.name ? styles.selectedColumn : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(node.id, column.name);
            }}
          >
            <title>
              {column.name} · {column.dataType ?? tConnector('typeNotLoaded')}
              {column.nullable === null ? '' : column.nullable ? ' · NULL' : ' · NOT NULL'}
              {column.comment ? `\n${column.comment}` : ''}
            </title>
            <rect
              x={1}
              y={y}
              width={box.width - 2}
              height={ER_ROW_HEIGHT}
              className={styles.columnFill}
            />
            <line x1={1} x2={box.width - 1} y1={y} y2={y} className={styles.rowLine} />
            <text x={13} y={y + 16} className={column.primary ? styles.pk : styles.fk}>
              {column.primary ? 'PK' : column.foreign ? 'FK' : column.unique ? 'UQ' : ''}
            </text>
            <text x={38} y={y + 16} className={styles.columnName}>
              {shorten(column.name, 22)}
            </text>
            <text x={box.width - 12} y={y + 16} textAnchor="end" className={styles.columnType}>
              {shorten(column.dataType ?? '?', 12)}
            </text>
          </g>
        );
      })}
      <text x={15} y={box.height - 9} className={styles.footerText}>
        {node.columns.length}
        {tConnector('field')}
        {columns.length < node.columns.length
          ? tConnector('showingViewDetailsForAllColumns', { p0: String(columns.length) })
          : ''}
      </text>
    </g>
  );
}
