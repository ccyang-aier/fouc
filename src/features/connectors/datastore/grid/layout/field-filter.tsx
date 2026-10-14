'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './field-filter.messages';
import { useId, useRef, useState } from 'react';
import { Check, DotsSixVertical, ListChecks, MagnifyingGlass } from '@phosphor-icons/react';
import type { DatabaseQueryResult } from '@fouc/shared';
import { columnLabel } from '../../result-format';
import { TableQueryPopover } from '../../table-query-popover';
import { useQueryRuleReorder } from '../../use-query-rule-reorder';
import {
  displayedGridColumns,
  hideGridColumns,
  orderedGridFields,
  reorderGridFields,
  setGridColumnVisible,
  type GridLayout,
} from './model';
import { fitGridColumn } from './width';
import styles from './workbench-controls.module.css';
export function GridFieldFilter({
  result,
  keys,
  layout,
  onChange,
}: {
  result: DatabaseQueryResult;
  keys: readonly string[];
  layout: GridLayout;
  onChange: (layout: GridLayout) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState('');
  const anchor = useRef<HTMLButtonElement>(null),
    id = useId();
  const ordered = orderedGridFields(keys, layout),
    visible = displayedGridColumns(result, keys, layout);
  const needle = search.trim().toLocaleLowerCase();
  function fitAll() {
    const widths = { ...layout.widths };
    for (const column of ordered)
      widths[keys[column]] = fitGridColumn(
        result,
        column,
        {
          density: layout.density,
          fontSize: layout.fontSize,
          formatter: layout.formatters[keys[column]],
          autoFit: true,
        },
        locale,
      );
    onChange({ ...layout, widths });
  }
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="fouc-action"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={!keys.length}
        title={tConnector('columnFilter')}
        onClick={() => setOpen((value) => !value)}
      >
        <ListChecks size={16} />
        {tConnector('columnFilter')}
      </button>
      <TableQueryPopover
        id={id}
        label={tConnector('columnFilter')}
        open={open}
        anchor={anchor}
        onClose={() => setOpen(false)}
        width={300}
        className={styles.popover}
      >
        <header className={styles.head}>
          <strong>{tConnector('columnFilter')}</strong>
          <span>
            {visible.length}/{keys.length}
          </span>
        </header>
        <label className={styles.search}>
          <MagnifyingGlass size={16} />
          <input
            data-autofocus
            aria-label={tConnector('searchColumns')}
            placeholder={tConnector('searchColumns1317')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <GridFieldList
          key={needle ? 'filtered' : 'ordered'}
          result={result}
          keys={keys}
          layout={layout}
          onChange={onChange}
          search={search}
        />
        <div className={styles.widthRow}>
          <span>{tConnector('columnWidth')}</span>
          <button type="button" className="fouc-action" onClick={fitAll}>
            {tConnector('autoFitColumnWidth')}
          </button>
        </div>
        <div className={styles.fieldFooter} role="group" aria-label={tConnector('columnActions')}>
          <p>{tConnector('keepAtLeastOneColumnVisibleDragToReorderColumns')}</p>
          <div>
            <button
              type="button"
              className="fouc-action"
              onClick={() =>
                onChange(
                  hideGridColumns(
                    { ...layout, hidden: [], hideNullColumns: false },
                    keys,
                    ordered.filter((column) => !layout.hidden.includes(keys[column])),
                  ),
                )
              }
            >
              {tConnector('invertSelection')}
            </button>
            <button
              type="button"
              className="fouc-action"
              disabled={!layout.order.length}
              onClick={() => onChange({ ...layout, order: [] })}
            >
              {tConnector('resetOrder')}
            </button>
            <button
              type="button"
              className="fouc-action"
              disabled={!layout.hidden.length && !layout.hideNullColumns}
              onClick={() => onChange({ ...layout, hidden: [], hideNullColumns: false })}
            >
              {tConnector('showAll')}
            </button>
          </div>
        </div>
      </TableQueryPopover>
    </>
  );
}
function GridFieldList({
  result,
  keys,
  layout,
  onChange,
  search,
}: {
  result: DatabaseQueryResult;
  keys: readonly string[];
  layout: GridLayout;
  onChange: (layout: GridLayout) => void;
  search: string;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const ordered = orderedGridFields(keys, layout),
    visible = displayedGridColumns(result, keys, layout),
    needle = search.trim().toLocaleLowerCase();
  const {
    list: listRef,
    row: rowProps,
    handle: dragHandle,
  } = useQueryRuleReorder(ordered.length, !!needle, (source, target) =>
    onChange(reorderGridFields(layout, keys, source, target)),
  );
  return (
    <section ref={listRef} data-query-rule-list className={styles.fieldList}>
      {ordered.map((column, position) =>
        !needle || result.columns[column].toLocaleLowerCase().includes(needle) ? (
          <div key={keys[column]} className={styles.fieldRow} {...rowProps(position)}>
            <button
              type="button"
              className={`fouc-action ${styles.grip}`}
              disabled={!!needle}
              aria-label={tConnector('moveColumn', {
                p0: String(columnLabel(result.columns, column)),
              })}
              title={tConnector('pressAndDragSpaceToSelectArrowKeysToMove')}
              {...dragHandle(position)}
            >
              <DotsSixVertical size={14} />
            </button>
            <button
              type="button"
              className={`fouc-action ${styles.fieldChoice}`}
              role="checkbox"
              aria-checked={visible.includes(column)}
              disabled={visible.includes(column) && visible.length === 1}
              onClick={() =>
                onChange(
                  setGridColumnVisible(
                    { ...layout, hideNullColumns: false },
                    keys,
                    keys[column],
                    !visible.includes(column),
                  ),
                )
              }
            >
              <span className={styles.check} data-checked={visible.includes(column)}>
                {visible.includes(column) && <Check size={12} weight="bold" />}
              </span>
              <span title={result.columns[column]}>{columnLabel(result.columns, column)}</span>
            </button>
          </div>
        ) : null,
      )}
      {needle && !result.columns.some((name) => name.toLocaleLowerCase().includes(needle)) && (
        <p className={styles.empty}>{tConnector('noMatchingColumns')}</p>
      )}
    </section>
  );
}
