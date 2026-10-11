'use client';

import {
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  ArrowsLeftRight,
  CaretLeft,
  CaretRight,
  Copy,
  SidebarSimple,
  Table,
  X,
} from '@phosphor-icons/react';
import type { DatabaseCell } from '@fouc/shared';
import type { ResultGridProps } from '../result-grid';
import { GridCellDetail } from '../cell-detail';
import { rawGridCellText } from '../clipboard';
import { summarizeExactValues } from '../exact-summary';
import { applyColumnFormatter } from '../layout/formatter';
import type { GridLayout } from '../layout/model';
import {
  dragGridSelection,
  emptyGridSelection,
  gridCellSelected,
  gridSelectionCounts,
  moveGridSelection,
  selectAllGridCells,
  selectGridTarget,
  type GridSelectionTarget,
} from '../selection-controller';
import { columnLabel } from '../../result-format';
import {
  formatTransposeSelection,
  selectedTransposeCells,
  transposeRecordWindow,
  transposeSelectionScope,
  transposeSourceCell,
} from './model';
import styles from './transpose.module.css';

type Props = ResultGridProps & {
  visible: readonly number[];
  keys: readonly string[];
  layout: GridLayout;
  rowHeight: number;
  initialRow?: number;
  onExit: () => void;
};
function targetOf(target: EventTarget | null): GridSelectionTarget | null {
  const element = (target as Element | null)?.closest?.<HTMLElement>(
    '[data-transpose-target]',
  );
  if (!element) return null;
  const kind = element.dataset.transposeTarget;
  return kind === 'cell' || kind === 'row' || kind === 'column'
    ? {
        kind,
        rowIndex: Number(element.dataset.field),
        colIndex: Number(element.dataset.record),
      }
    : null;
}
export function TransposedResultGrid({
  result,
  displayRows,
  editedCells,
  visible,
  keys,
  layout,
  rowHeight,
  initialRow = 0,
  rowOffset = 0,
  rowNumbers,
  scopeLabel,
  onCellSelect,
  onSelectionChange,
  onNotice,
  showCellDetails = true,
  readOnly = true,
  toolbarActions,
  onExit,
}: Props) {
  const [multi, setMulti] = useState(layout.transposeMode === 'multiple'),
    [record, setRecord] = useState(initialRow);
  const [selection, setSelection] = useState(emptyGridSelection),
    [headers, setHeaders] = useState(true),
    [details, setDetails] = useState(false),
    [feedback, setFeedback] = useState('');
  const viewport = useRef<HTMLDivElement>(null),
    drag = useRef<{
      base: typeof selection;
      start: GridSelectionTarget;
      modifiers: { shift: boolean; additive: boolean };
    } | null>(null);
  const [metrics, setMetrics] = useState({
      left: 0,
      top: 0,
      width: 500,
      height: 360,
    }),
    id = useId();
  const activeRecord = Math.max(0, Math.min(result.rows.length - 1, record));
  const records = useMemo(
    () =>
      multi
        ? result.rows.map((_, index) => index)
        : result.rows.length
          ? [activeRecord]
          : [],
    [multi, result.rows, activeRecord],
  );
  const mapping = useMemo(
    () => ({ columns: visible, records }),
    [visible, records],
  );
  const dimensions = { rows: visible.length, columns: records.length };
  const counts = gridSelectionCounts(selection, dimensions);
  const focus = selection.focus,
    source =
      focus && gridCellSelected(selection, focus.rowIndex, focus.colIndex)
        ? transposeSourceCell(mapping, focus.rowIndex, focus.colIndex)
        : null;
  const cell = source
    ? {
        ...source,
        columnName: columnLabel(result.columns, source.columnIndex),
        value: result.rows[source.rowIndex]?.[source.columnIndex] ?? null,
      }
    : null;
  const notify = useEffectEvent(() => {
    onCellSelect?.(cell);
    onSelectionChange?.(transposeSelectionScope(result, mapping, selection));
  });
  useEffect(() => {
    notify();
  }, [result, mapping, selection]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setMetrics({
        left: element.scrollLeft,
        top: element.scrollTop,
        width: element.clientWidth,
        height: element.clientHeight,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [statistics, setStatistics] = useState<{
    result: typeof result;
    mapping: typeof mapping;
    selection: typeof selection;
    value: ReturnType<typeof summarizeExactValues>;
  } | null>(null);
  const summary =
    statistics?.result === result &&
    statistics.mapping === mapping &&
    statistics.selection === selection
      ? statistics.value
      : null;
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setStatistics({
          result,
          mapping,
          selection,
          value: summarizeExactValues(
            (function* () {
              for (const selected of selectedTransposeCells(
                result,
                mapping,
                selection,
              ))
                yield selected.value;
            })(),
          ),
        }),
      90,
    );
    return () => clearTimeout(timer);
  }, [result, mapping, selection]);
  const fieldWidth = 190,
    recordWidth = 180,
    window = transposeRecordWindow(
      records.length,
      metrics.left,
      metrics.width,
      fieldWidth,
      recordWidth,
    );
  const firstField = Math.max(
      0,
      Math.floor((metrics.top - 40) / rowHeight) - 5,
    ),
    endField = Math.min(
      visible.length,
      firstField + Math.ceil(metrics.height / rowHeight) + 12,
    );
  const rowNumber = (row: number) => rowNumbers?.[row] ?? rowOffset + row + 1;
  function notice(text: string) {
    setFeedback(text);
    onNotice?.(text);
  }
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      notice(`已复制${label}`);
    } catch {
      notice('复制失败，请检查浏览器剪贴板权限');
    }
  }
  function copySelection(separator: ',' | '\t') {
    if (counts.cells)
      void copy(
        formatTransposeSelection(
          result,
          mapping,
          selection,
          separator,
          headers,
          rowNumber,
        ),
        `${counts.cells} 个原始值 · ${separator === ',' ? 'CSV' : 'TSV'}`,
      );
  }
  function chooseRecord(next: number) {
    setRecord(next);
    setSelection(emptyGridSelection());
    setDetails(false);
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      (event.target as Element).closest('button,input,select')
    )
      return;
    const target = targetOf(event.target);
    if (!target) return;
    event.preventDefault();
    event.currentTarget.focus();
    const modifiers = {
      shift: event.shiftKey,
      additive: event.ctrlKey || event.metaKey,
    };
    drag.current = { base: selection, start: target, modifiers };
    setSelection(selectGridTarget(selection, target, modifiers, dimensions));
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const target = targetOf(
      document.elementFromPoint(event.clientX, event.clientY),
    );
    if (target)
      setSelection(
        dragGridSelection(
          drag.current.base,
          drag.current.start,
          target,
          drag.current.modifiers,
          dimensions,
        ),
      );
  }
  function endDrag(event: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.target as Element).closest('button,input,select')) return;
    const control = event.ctrlKey || event.metaKey;
    if (control && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      setSelection(selectAllGridCells(dimensions));
    } else if (control && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      copySelection('\t');
    } else if (event.key === 'Escape') {
      setDetails(false);
      setSelection(emptyGridSelection());
    } else if (event.key === 'Enter' && cell && showCellDetails) {
      event.preventDefault();
      setDetails(true);
    } else if (
      /^Arrow(Up|Down|Left|Right)$/.test(event.key) ||
      ['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)
    ) {
      event.preventDefault();
      setSelection(
        moveGridSelection(
          selection,
          event.key,
          {
            shift: event.shiftKey,
            control,
            pageRows: Math.max(1, Math.floor(metrics.height / rowHeight)),
          },
          dimensions,
        ),
      );
    }
  }
  useEffect(() => {
    if (!focus) return;
    const element = viewport.current;
    if (!element) return;
    const top = focus.rowIndex * rowHeight,
      left = focus.colIndex * recordWidth;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (top + rowHeight + 40 > element.scrollTop + element.clientHeight)
      element.scrollTop = top + rowHeight + 40 - element.clientHeight;
    if (left < element.scrollLeft) element.scrollLeft = left;
    else if (
      left + recordWidth + fieldWidth >
      element.scrollLeft + element.clientWidth
    )
      element.scrollLeft =
        left + recordWidth + fieldWidth - element.clientWidth;
  }, [focus, rowHeight]);
  const scopeText = `${scopeLabel ?? `已返回 ${result.rows.length} 行 · ${visible.length} 个可见字段`}${result.hasMore || result.truncated ? ' · 部分结果' : ''}`;
  const selectionText = counts.cells
    ? `${counts.cells} 个原始值${summary?.sum !== null && summary?.sum !== undefined ? ` · 精确求和 ${summary.sum}` : ''}`
    : '点击选择 · Shift 连选 · Ctrl 多选';
  return (
    <div
      className={styles.root}
      style={
        {
          '--transpose-row-height': `${rowHeight}px`,
          '--transpose-font-size': `${layout.fontSize}px`,
          '--transpose-value-font':
            layout.font === 'mono' ? 'var(--font-code)' : 'var(--font-sans)',
        } as CSSProperties
      }
    >
      <div className={styles.toolbar}>
        <div className={styles.mode}>
          <ArrowsLeftRight size={14} />
          <strong>转置</strong>
          <button
            type="button"
            aria-pressed={!multi}
            onClick={() => {
              setMulti(false);
              setSelection(emptyGridSelection());
            }}
          >
            单条
          </button>
          <button
            type="button"
            aria-pressed={multi}
            onClick={() => {
              setMulti(true);
              setSelection(emptyGridSelection());
            }}
          >
            多条
          </button>
        </div>
        <div className={styles.actions}>
          <label>
            <input
              type="checkbox"
              checked={headers}
              onChange={(event) => setHeaders(event.target.checked)}
            />
            字段名
          </label>
          <button
            type="button"
            disabled={!counts.cells}
            onClick={() => copySelection('\t')}
          >
            <Copy size={13} />
            TSV
          </button>
          <button
            type="button"
            disabled={!counts.cells}
            onClick={() => copySelection(',')}
          >
            CSV
          </button>
          {showCellDetails && (
            <button
              type="button"
              aria-label="转置单元格详情"
              title="单元格详情 · Enter"
              className={styles.iconAction}
              disabled={!cell}
              aria-pressed={details && !!cell}
              onClick={() => setDetails(!details)}
            >
              <SidebarSimple size={13} />
              <span>详情</span>
            </button>
          )}
          <button type="button" className={styles.iconAction} title="返回标准表格" aria-label="返回标准表格" onClick={onExit}>
            <Table size={13} />
            <span>表格</span>
          </button>
          {toolbarActions}
        </div>
      </div>
      {!multi && (
        <div className={styles.navigator}>
          <button
            type="button"
            aria-label="上一条转置记录"
            disabled={activeRecord <= 0}
            onClick={() => chooseRecord(activeRecord - 1)}
          >
            <CaretLeft size={13} />
          </button>
          <label>
            原始行
            <select
              aria-label="转置记录"
              value={activeRecord}
              onChange={(event) => chooseRecord(Number(event.target.value))}
            >
              {result.rows.map((_, row) => (
                <option value={row} key={row}>
                  第 {rowNumber(row)} 行
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-label="下一条转置记录"
            disabled={activeRecord + 1 >= result.rows.length}
            onClick={() => chooseRecord(activeRecord + 1)}
          >
            <CaretRight size={13} />
          </button>
          <span>{visible.length} 个可见字段 · 仅改变显示方向</span>
        </div>
      )}
      <div
        className={`${styles.content} ${details && cell ? styles.withDetail : ''}`}
      >
        <div
          className={styles.viewport}
          ref={viewport}
          tabIndex={0}
          role="grid"
          aria-label="转置结果，行是原字段，列是原记录"
          aria-rowcount={visible.length + 1}
          aria-colcount={records.length + 1}
          aria-readonly={readOnly}
          aria-multiselectable
          onKeyDown={keyDown}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onDoubleClick={(event) => {
            if (targetOf(event.target)?.kind === 'cell' && showCellDetails)
              setDetails(true);
          }}
          onScroll={(event) =>
            setMetrics({
              left: event.currentTarget.scrollLeft,
              top: event.currentTarget.scrollTop,
              width: event.currentTarget.clientWidth,
              height: event.currentTarget.clientHeight,
            })
          }
        >
          <table
            role="presentation"
            style={{ width: fieldWidth + records.length * recordWidth }}
          >
            <colgroup>
              <col style={{ width: fieldWidth }} />
              {window.beforeWidth > 0 && (
                <col style={{ width: window.beforeWidth }} />
              )}
              {records.slice(window.start, window.end).map((row) => (
                <col key={row} style={{ width: recordWidth }} />
              ))}
              {window.afterWidth > 0 && (
                <col style={{ width: window.afterWidth }} />
              )}
            </colgroup>
            <thead>
              <tr role="row">
                <th className={styles.field}>
                  <button
                    type="button"
                    aria-label="选择全部转置值"
                    onClick={() => setSelection(selectAllGridCells(dimensions))}
                  >
                    字段 / 原始记录
                  </button>
                </th>
                {window.beforeWidth > 0 && <th aria-hidden="true" />}
                {records.slice(window.start, window.end).map((row, index) => (
                  <th
                    role="columnheader"
                    data-transpose-target="column"
                    data-field={focus?.rowIndex ?? 0}
                    data-record={window.start + index}
                    key={row}
                  >
                    第 {rowNumber(row)} 行
                  </th>
                ))}
                {window.afterWidth > 0 && <th aria-hidden="true" />}
              </tr>
            </thead>
            <tbody>
              {firstField > 0 && (
                <tr aria-hidden="true">
                  <td
                    colSpan={window.end - window.start + 3}
                    style={{ height: firstField * rowHeight }}
                  />
                </tr>
              )}
              {visible.slice(firstField, endField).map((column, index) => {
                const field = firstField + index;
                return (
                  <tr role="row" aria-rowindex={field + 2} key={keys[column]}>
                    <th
                      className={styles.field}
                      role="rowheader"
                      data-transpose-target="row"
                      data-field={field}
                      data-record={focus?.colIndex ?? 0}
                    >
                      <strong title={columnLabel(result.columns, column)}>
                        {columnLabel(result.columns, column)}
                      </strong>
                      <small>
                        {result.columnTypes[column] || '—'}
                        {layout.formatters[keys[column]] ? ' · ƒ' : ''}
                      </small>
                    </th>
                    {window.beforeWidth > 0 && <td aria-hidden="true" />}
                    {records
                      .slice(window.start, window.end)
                      .map((row, local) => {
                        const recordIndex = window.start + local,
                          value: DatabaseCell =
                            (displayRows ?? result.rows)[row]?.[column] ?? null,
                          formatted = applyColumnFormatter(
                            value,
                            layout.formatters[keys[column]],
                          ),
                          selected = gridCellSelected(
                            selection,
                            field,
                            recordIndex,
                          );
                        return (
                          <td
                            role="gridcell"
                            aria-colindex={recordIndex + 2}
                            aria-selected={selected}
                            id={`${id}-${field}-${recordIndex}`}
                            data-transpose-target="cell"
                            data-field={field}
                            data-record={recordIndex}
                            data-selected={selected || undefined}
                            data-active={
                              (selected &&
                                focus?.rowIndex === field &&
                                focus.colIndex === recordIndex) ||
                              undefined
                            }
                            data-dirty={
                              editedCells?.has(`${row}:${column}`) || undefined
                            }
                            data-null={value === null || undefined}
                            key={row}
                            title={`${formatted.error ? `${formatted.error}\n` : ''}原始值：${rawGridCellText(result.rows[row]?.[column] ?? null)}`.slice(
                              0,
                              4096,
                            )}
                          >
                            <span>
                              {value === '' && !layout.formatters[keys[column]]
                                ? '空字符串'
                                : formatted.text.slice(0, 512)}
                            </span>
                          </td>
                        );
                      })}
                    {window.afterWidth > 0 && <td aria-hidden="true" />}
                  </tr>
                );
              })}
              {endField < visible.length && (
                <tr aria-hidden="true">
                  <td
                    colSpan={window.end - window.start + 3}
                    style={{ height: (visible.length - endField) * rowHeight }}
                  />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {details && cell && (
          <GridCellDetail
            {...cell}
            columnIndex={visible.indexOf(cell.columnIndex)}
            columnType={result.columnTypes[cell.columnIndex]}
            rowOffset={rowOffset}
            rowNumber={rowNumbers?.[cell.rowIndex]}
            rowCount={result.rows.length}
            columnCount={visible.length}
            onMove={(row, col) => {
              if (!multi) setRecord(row);
              setSelection(
                selectGridTarget(
                  emptyGridSelection(),
                  { kind: 'cell', rowIndex: col, colIndex: multi ? row : 0 },
                  {},
                  {
                    rows: visible.length,
                    columns: multi ? result.rows.length : 1,
                  },
                ),
              );
            }}
            onClose={() => {
              setDetails(false);
              viewport.current?.focus();
            }}
            onCopy={(text, label) => void copy(text, label)}
          />
        )}
      </div>
      <footer className={styles.footer}>
        <span title={scopeText}>{scopeText}</span>
        <span title={selectionText}>{selectionText}</span>
      </footer>
      {feedback && (
        <div className={styles.feedback} role="status">
          <span>{feedback}</span>
          {cell && counts.cells === 1 && (
            <button
              type="button"
              onClick={() =>
                void copy(rawGridCellText(cell.value), '单元格原始值')
              }
            >
              复制原始值
            </button>
          )}
          <button
            type="button"
            aria-label="关闭转置反馈"
            onClick={() => setFeedback('')}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
