'use client';
import { useTranslation, createTranslator } from '@/lib/i18n';
import { messages as connectorMessages } from './cell-detail.messages';
const translateConnector = createTranslator(connectorMessages);
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  TextAlignLeft,
  X,
} from '@phosphor-icons/react';
import type { DatabaseCell } from '@fouc/shared';
import { getOverlayRoot } from '@/lib/overlay-root';
import { rawGridCellText } from './clipboard';
import {
  adjacentDataGridDetailIndex,
  detailNavigationDelta,
  shouldIgnoreDataGridDetailNavigation,
  type DataGridDetailNavigationAxis,
  type DataGridDetailNavigationDelta,
} from './detail-navigation';
import { selectAllCellDetailText } from './detail-selection';
import { BinaryCellView } from './binary/view';
import { jsonGridPreview, type GridValuePresentation } from './presentation';
import styles from './result-grid.module.css';
type Props = {
  value: DatabaseCell;
  rowIndex: number;
  rowOffset: number;
  rowNumber?: number;
  columnIndex: number;
  columnName: string;
  columnType?: string;
  rowCount: number;
  columnCount: number;
  onMove: (row: number, column: number) => void;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
  presentation?: GridValuePresentation;
};
export function GridCellDetail({
  value,
  rowIndex,
  rowOffset,
  rowNumber,
  columnIndex,
  columnName,
  columnType,
  rowCount,
  columnCount,
  onMove,
  onClose,
  onCopy,
  presentation,
}: Props) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const textRef = useRef<HTMLTextAreaElement>(null),
    json = presentation === 'json' ? jsonGridPreview(value) : null,
    text = json ?? rawGridCellText(value, true);
  const binary =
    presentation !== 'text' &&
    presentation !== 'json' &&
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.type === 'binary';
  const kind =
    value === null
      ? 'NULL'
      : value === ''
        ? tConnector('emptyString')
        : typeof value === 'object'
          ? !Array.isArray(value) && value.type === 'binary'
            ? tConnector('binaryOriginalData')
            : 'JSON'
          : typeof value === 'boolean'
            ? tConnector('boolean')
            : columnType ||
              (typeof value === 'number' ? tConnector('numeric') : tConnector('text'));
  function move(axis: DataGridDetailNavigationAxis, delta: DataGridDetailNavigationDelta) {
    const next = adjacentDataGridDetailIndex(
      axis === 'row' ? rowIndex : columnIndex,
      delta,
      axis === 'row' ? rowCount : columnCount,
    );
    if (next !== null)
      onMove(axis === 'row' ? next : rowIndex, axis === 'column' ? next : columnIndex);
  }
  function selectAll() {
    const element = textRef.current;
    if (!element) return;
    element.focus();
    selectAllCellDetailText({
      state: { doc: { length: element.value.length } },
      dispatch: ({ selection }) => element.setSelectionRange(selection.anchor, selection.head),
    });
  }
  const content = (
    <aside
      className={`${styles.detail} ${binary ? styles.binaryDetail : ''}`}
      aria-label={tConnector('cellDetails')}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
          return;
        }
        if (shouldIgnoreDataGridDetailNavigation(event)) return;
        for (const axis of ['row', 'column'] as const) {
          const delta = detailNavigationDelta(event.key, axis);
          if (delta !== null) {
            event.preventDefault();
            move(axis, delta);
          }
        }
      }}
    >
      <header className={styles.detailHeader}>
        <div>
          <span>
            {json !== null
              ? tConnector('jsonView')
              : presentation === 'text'
                ? tConnector('textView')
                : presentation === 'binary' && binary
                  ? tConnector('binaryView')
                  : tConnector('cellDetails')}
          </span>
          <strong title={columnName}>{columnName}</strong>
        </div>
        <button type="button" aria-label={tConnector('closeCellDetails')} onClick={onClose}>
          <X size={15} />
        </button>
      </header>
      <div className={styles.detailMeta}>
        <span>
          {tConnector('no')}
          {rowNumber ?? rowOffset + rowIndex + 1}
          {tConnector('row')}
        </span>
        <span title={kind}>{kind}</span>
        <span>
          {text.length.toLocaleString(locale)}
          {tConnector('characters')}
        </span>
      </div>
      <div className={styles.detailNavigation}>
        <div>
          <button
            type="button"
            disabled={rowIndex === 0}
            aria-label={tConnector('previousRow')}
            title={tConnector('previousRow1243')}
            onClick={() => move('row', -1)}
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            disabled={rowIndex + 1 === rowCount}
            aria-label={tConnector('nextRow')}
            title={tConnector('nextRow1245')}
            onClick={() => move('row', 1)}
          >
            <ArrowDown size={14} />
          </button>
          <i />
          <button
            type="button"
            disabled={columnIndex === 0}
            aria-label={tConnector('previousColumn')}
            title={tConnector('previousColumn1247')}
            onClick={() => move('column', -1)}
          >
            <ArrowLeft size={14} />
          </button>
          <button
            type="button"
            disabled={columnIndex + 1 === columnCount}
            aria-label={tConnector('nextColumn')}
            title={tConnector('nextColumn1249')}
            onClick={() => move('column', 1)}
          >
            <ArrowRight size={14} />
          </button>
        </div>
        <span>
          {columnIndex + 1} / {columnCount}
          {tConnector('columns')}
        </span>
      </div>
      {binary ? (
        <BinaryCellView value={value} columnName={columnName} textRef={textRef} onCopy={onCopy} />
      ) : (
        <textarea
          ref={textRef}
          aria-label={tConnector('originalCellValue')}
          readOnly
          value={text}
          spellCheck={false}
          className={styles.detailValue}
        />
      )}
      <footer className={styles.detailFooter}>
        <button type="button" onClick={selectAll}>
          <TextAlignLeft size={14} />
          {tConnector('selectAllContent')}
        </button>
        <button
          type="button"
          onClick={() => onCopy(rawGridCellText(value), translateConnector('originalCellValue'))}
        >
          <Copy size={14} />
          {tConnector('copyOriginalValue')}
        </button>
      </footer>
    </aside>
  );
  return binary && typeof document !== 'undefined'
    ? createPortal(content, getOverlayRoot() ?? document.body)
    : content;
}
