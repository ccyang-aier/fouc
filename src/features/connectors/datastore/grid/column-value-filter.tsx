'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './column-value-filter.messages';
import { useMemo, useState, type RefObject } from 'react';
import { ArrowDown, ArrowUp, ArrowsDownUp, MagnifyingGlass } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { TableQueryPopover } from '../table-query-popover';
import type { GridColumnValueOption } from './column-filter-model';
import styles from './column-actions.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export function ColumnValueFilter({
  id,
  name,
  mode,
  anchor,
  returnFocus,
  options,
  selected,
  onClose,
  onApply,
}: {
  id: string;
  name: string;
  mode: 'local' | 'database';
  anchor: RefObject<HTMLElement | null>;
  returnFocus: RefObject<HTMLElement | null>;
  options: GridColumnValueOption[];
  selected: readonly string[] | null;
  onClose: () => void;
  onApply: (selected: readonly string[] | null) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [search, setSearch] = useState(''),
    [checked, setChecked] = useState(
      () => new Set(selected ?? options.map((option) => option.key)),
    );
  const [order, setOrder] = useState<{
    kind: 'value' | 'count';
    direction: 1 | -1;
  }>({ kind: 'value', direction: 1 });
  const [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const shown = useMemo(
    () =>
      options
        .filter((option) => option.text.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
        .sort(
          (a, b) =>
            (order.kind === 'count'
              ? a.count - b.count
              : a.text.localeCompare(b.text, 'zh-CN', { numeric: true })) * order.direction,
        ),
    [options, search, order],
  );
  const selectedCount = shown.filter((option) => checked.has(option.key)).length;
  function apply(value: readonly string[] | null) {
    try {
      onApply(value);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? uiFailure(reason)
          : connectorUiMessages.message('couldNotApplyTheFilter'),
      );
    }
  }
  function sort(kind: 'value' | 'count') {
    setOrder((previous) => ({
      kind,
      direction: previous.kind === kind && previous.direction === 1 ? -1 : 1,
    }));
  }
  const title = tConnector('valueFilterFor', {
    p0: String(mode === 'local' ? tConnector('local') : tConnector('database')),
    p1: String(name),
  });
  return (
    <TableQueryPopover
      id={id}
      open
      anchor={anchor}
      returnFocus={returnFocus}
      onClose={onClose}
      label={title}
      width={360}
      className={styles.valuePanel}
    >
      <header className={styles.title}>{title}</header>
      {mode === 'database' && (
        <p className={styles.scope}>
          {tConnector('chooseFromLoadedValuesOnTheCurrentPageFilteringRuns')}
        </p>
      )}
      <label className={styles.search}>
        <MagnifyingGlass size={15} />
        <input
          aria-label={tConnector('searchFilterValuesFor', { p0: String(name) })}
          placeholder={tConnector('searchValues')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className={styles.valueHead}>
        <input
          type="checkbox"
          aria-label={tConnector('selectAllMatchingValues')}
          checked={shown.length > 0 && selectedCount === shown.length}
          ref={(input) => {
            if (input) input.indeterminate = selectedCount > 0 && selectedCount < shown.length;
          }}
          disabled={!shown.length}
          onChange={(event) => {
            const next = new Set(checked);
            for (const option of shown)
              if (event.target.checked) next.add(option.key);
              else next.delete(option.key);
            setChecked(next);
          }}
        />
        <button type="button" className="fouc-action" onClick={() => sort('value')}>
          {tConnector('value')}
          {order.kind === 'value' ? (
            order.direction === 1 ? (
              <ArrowUp size={13} />
            ) : (
              <ArrowDown size={13} />
            )
          ) : (
            <ArrowsDownUp size={13} />
          )}
        </button>
        <button type="button" className="fouc-action" onClick={() => sort('count')}>
          {tConnector('count')}
          {order.kind === 'count' ? (
            order.direction === 1 ? (
              <ArrowUp size={13} />
            ) : (
              <ArrowDown size={13} />
            )
          ) : (
            <ArrowsDownUp size={13} />
          )}
        </button>
      </div>
      <div className={styles.valueList}>
        {shown.map((option) => (
          <label key={option.key} className={styles.valueRow}>
            <input
              type="checkbox"
              aria-label={tConnector('filterValue', { p0: String(option.text) })}
              checked={checked.has(option.key)}
              onChange={(event) => {
                const next = new Set(checked);
                if (event.target.checked) next.add(option.key);
                else next.delete(option.key);
                setChecked(next);
              }}
            />
            <span title={option.text}>{option.text}</span>
            <small>{option.count}</small>
          </label>
        ))}
        {!shown.length && <p className={styles.empty}>{tConnector('noMatchingValues')}</p>}
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <footer className={styles.footer}>
        <Button variant="ghost" onClick={() => apply(null)}>
          {tConnector('clearFilters')}
        </Button>
        <span />
        <Button variant="outline" onClick={onClose}>
          {tConnector('cancel')}
        </Button>
        <Button
          className={styles.apply}
          disabled={mode === 'database' && !checked.size}
          onClick={() =>
            apply(
              mode === 'local' &&
                checked.size === options.length &&
                options.every((option) => checked.has(option.key))
                ? null
                : [...checked],
            )
          }
        >
          {tConnector('applyFilter')}
        </Button>
      </footer>
    </TableQueryPopover>
  );
}
