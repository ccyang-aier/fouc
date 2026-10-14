'use client';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './layout-dialog.messages';
import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowsOutLineHorizontal,
  ArrowCounterClockwise,
  MagnifyingGlass,
  PushPin,
  SlidersHorizontal,
} from '@phosphor-icons/react';
import type { DatabaseQueryResult } from '@fouc/shared';
import { databaseCellText } from '../../cell-format';
import { SqlDialog } from '../../sql-library-dialog';
import common from '../../relational.module.css';
import {
  applyColumnFormatter,
  supportedGridTimeZones,
  validateColumnFormatter,
  type ColumnFormatter,
} from './formatter';
import {
  allNullGridColumns,
  defaultGridLayout,
  hideGridColumns,
  moveGridColumn,
  orderedGridColumns,
  setGridColumnVisible,
  visibleGridColumns,
  type GridLayout,
  type GridPin,
} from './model';
import { fitGridColumn } from './width';
import styles from './layout-dialog.module.css';
type Props = {
  result: DatabaseQueryResult;
  keys: readonly string[];
  initial: GridLayout;
  initialColumn?: number;
  persistent: boolean;
  onApply: (layout: GridLayout) => void;
  onClose: () => void;
};
const FORMAT_LABELS = (locale?: Locale) => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    datetime: tConnector('dateAndTimeZone'),
    'json-path': tConnector('jsonPath'),
    mask: tConnector('characterMask'),
    template: tConnector('displayTemplate'),
  };
};
function initialFormatter(type: ColumnFormatter['type']): ColumnFormatter {
  if (type === 'datetime')
    return { type, unit: 'auto', timeZone: 'UTC', pattern: 'YYYY-MM-DD HH:mm:ss' };
  if (type === 'json-path') return { type, path: '$' };
  if (type === 'mask') return { type, prefix: 2, suffix: 2 };
  return { type, template: '${value}' };
}
export function GridLayoutDialog({
  result,
  keys,
  initial,
  initialColumn = 0,
  persistent,
  onApply,
  onClose,
}: Props) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [draft, setDraft] = useState(initial),
    [search, setSearch] = useState(''),
    [selected, setSelected] = useState(initialColumn);
  const ordered = orderedGridColumns(keys, draft.order),
    visible = visibleGridColumns(keys, draft),
    key = keys[selected],
    formatter = draft.formatters[key];
  const timeZones = useMemo(() => supportedGridTimeZones(), []);
  const formatterError = formatter ? validateColumnFormatter(formatter, locale) : null;
  const invalidCount = Object.values(draft.formatters).filter((entry) =>
    validateColumnFormatter(entry, locale),
  ).length;
  function changeFormatter(value?: ColumnFormatter) {
    const formatters = { ...draft.formatters };
    if (value) formatters[key] = value;
    else delete formatters[key];
    setDraft({ ...draft, formatters });
  }
  function pinColumn(columnKey: string, value: string) {
    const pins = { ...draft.pins };
    if (value === 'left' || value === 'right') pins[columnKey] = value as GridPin;
    else delete pins[columnKey];
    setDraft({ ...draft, pins });
  }
  function fitAll() {
    const widths = { ...draft.widths };
    for (const index of ordered)
      widths[keys[index]] = fitGridColumn(
        result,
        index,
        {
          density: draft.density,
          fontSize: draft.fontSize,
          formatter: draft.formatters[keys[index]],
          autoFit: true,
        },
        locale,
      );
    setDraft({ ...draft, widths });
  }
  return (
    <SqlDialog
      title={tConnector('gridDisplaySettings')}
      className={styles.dialog}
      onClose={onClose}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalidCount) onApply(draft);
        }}
      >
        <div className={styles.settings}>
          <label>
            {tConnector('rowDensity')}
            <select
              value={draft.density}
              onChange={(event) =>
                setDraft({ ...draft, density: event.target.value as GridLayout['density'] })
              }
            >
              <option value="compact">{tConnector('compactPx')}</option>
              <option value="standard">{tConnector('standardPx')}</option>
              <option value="comfortable">{tConnector('comfortablePx')}</option>
            </select>
          </label>
          <label>
            {tConnector('valueFont')}
            <select
              value={draft.font}
              onChange={(event) =>
                setDraft({ ...draft, font: event.target.value as GridLayout['font'] })
              }
            >
              <option value="mono">{tConnector('monospace')}</option>
              <option value="sans">{tConnector('interfaceFont')}</option>
            </select>
          </label>
          <label>
            {tConnector('fontSize')}
            <select
              value={draft.fontSize}
              onChange={(event) => setDraft({ ...draft, fontSize: Number(event.target.value) })}
            >
              {[12, 13, 14, 15, 16].map((size) => (
                <option key={size} value={size}>
                  {size} px
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={fitAll}>
            <ArrowsOutLineHorizontal size={14} />
            {tConnector('fitAllColumns')}
          </button>
          <button type="button" onClick={() => setDraft(defaultGridLayout())}>
            <ArrowCounterClockwise size={14} />
            {tConnector('restoreDefaults')}
          </button>
        </div>
        <div className={styles.body}>
          <section className={styles.columns} aria-label={tConnector('columnLayout')}>
            <div className={styles.listHeader}>
              <strong>
                {tConnector('columnLayout')}
                <small>
                  {visible.length} / {keys.length}
                  {tConnector('visible')}
                </small>
              </strong>
              <label className={styles.search}>
                <MagnifyingGlass size={13} />
                <input
                  aria-label={tConnector('searchGridColumns')}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={tConnector('searchColumnNames')}
                />
              </label>
              <div className={styles.visibilityActions}>
                <button type="button" onClick={() => setDraft({ ...draft, hidden: [] })}>
                  {tConnector('showAll')}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(hideGridColumns(draft, keys, allNullGridColumns(result)))}
                >
                  {tConnector('hideAllNullColumns')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraft(
                      hideGridColumns(
                        { ...draft, hidden: [] },
                        keys,
                        ordered.filter((index) => !draft.hidden.includes(keys[index])),
                      ),
                    )
                  }
                >
                  {tConnector('invertVisibleColumns')}
                </button>
              </div>
            </div>
            <div className={styles.columnList}>
              {ordered
                .filter((index) =>
                  (result.columns[index] || tConnector('column', { p0: String(index + 1) }))
                    .toLocaleLowerCase()
                    .includes(search.toLocaleLowerCase()),
                )
                .map((index) => {
                  const columnKey = keys[index],
                    hidden = draft.hidden.includes(columnKey),
                    visualIndex = visible.indexOf(index);
                  return (
                    <div
                      key={columnKey}
                      className={styles.columnRow}
                      data-current={selected === index || undefined}
                    >
                      <input
                        type="checkbox"
                        aria-label={tConnector('show', { p0: String(result.columns[index]) })}
                        checked={!hidden}
                        disabled={!hidden && visible.length === 1}
                        onChange={(event) =>
                          setDraft(
                            setGridColumnVisible(draft, keys, columnKey, event.target.checked),
                          )
                        }
                      />
                      <button
                        type="button"
                        className={styles.columnName}
                        onClick={() => setSelected(index)}
                        title={result.columns[index]}
                      >
                        <span>
                          {result.columns[index] || tConnector('column', { p0: String(index + 1) })}
                        </span>
                        <small>
                          {result.columnTypes[index] || '—'}
                          {draft.formatters[columnKey]
                            ? ` · ${FORMAT_LABELS(locale)[draft.formatters[columnKey].type]}`
                            : ''}
                        </small>
                      </button>
                      <label className={styles.pinSelect}>
                        <PushPin size={12} />
                        <select
                          aria-label={tConnector('pinPositionFor', {
                            p0: String(result.columns[index]),
                          })}
                          value={draft.pins[columnKey] ?? ''}
                          onChange={(event) => pinColumn(columnKey, event.target.value)}
                        >
                          <option value="">{tConnector('none')}</option>
                          <option value="left">{tConnector('left')}</option>
                          <option value="right">{tConnector('right')}</option>
                        </select>
                      </label>
                      <div className={styles.orderActions}>
                        <button
                          type="button"
                          disabled={hidden || visualIndex <= 0}
                          aria-label={tConnector('moveEarlier', {
                            p0: String(result.columns[index]),
                          })}
                          onClick={() =>
                            setDraft(moveGridColumn(draft, keys, visualIndex, visualIndex - 1))
                          }
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={hidden || visualIndex < 0 || visualIndex + 1 === visible.length}
                          aria-label={tConnector('moveLater', {
                            p0: String(result.columns[index]),
                          })}
                          onClick={() =>
                            setDraft(moveGridColumn(draft, keys, visualIndex, visualIndex + 1))
                          }
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
          <section className={styles.formatter} aria-label={tConnector('columnDisplayFormat')}>
            <header className={styles.formatHeader}>
              <SlidersHorizontal size={15} />
              <div>
                <strong>
                  {result.columns[selected] || tConnector('column', { p0: String(selected + 1) })}
                </strong>
                <span>{tConnector('displayFormatOriginalAndCopiedValuesRemainUnchanged')}</span>
              </div>
            </header>
            <div className={styles.formatBody}>
              <label>
                {tConnector('columnWidth')}
                <div className={styles.widthField}>
                  <input
                    type="number"
                    aria-label={tConnector('columnWidth')}
                    min={60}
                    max={1200}
                    value={
                      draft.widths[key] ??
                      fitGridColumn(
                        result,
                        selected,
                        { density: draft.density, fontSize: draft.fontSize, formatter },
                        locale,
                      )
                    }
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isFinite(value))
                        setDraft({
                          ...draft,
                          widths: { ...draft.widths, [key]: Math.min(1200, Math.max(60, value)) },
                        });
                    }}
                  />
                  <span>px</span>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        widths: {
                          ...draft.widths,
                          [key]: fitGridColumn(result, selected, {
                            density: draft.density,
                            fontSize: draft.fontSize,
                            formatter,
                            autoFit: true,
                          }),
                        },
                      })
                    }
                  >
                    {tConnector('autoFitWidth')}
                  </button>
                </div>
              </label>
              <label>
                {tConnector('formatter')}
                <select
                  value={formatter?.type ?? ''}
                  onChange={(event) =>
                    changeFormatter(
                      event.target.value
                        ? initialFormatter(event.target.value as ColumnFormatter['type'])
                        : undefined,
                    )
                  }
                >
                  <option value="">{tConnector('originalDisplay')}</option>
                  {Object.entries(FORMAT_LABELS(locale)).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {formatter?.type === 'datetime' && (
                <>
                  <div className={styles.fieldPair}>
                    <label>
                      {tConnector('timestampUnit')}
                      <select
                        value={formatter.unit}
                        onChange={(event) =>
                          changeFormatter({
                            ...formatter,
                            unit: event.target.value as typeof formatter.unit,
                          })
                        }
                      >
                        <option value="auto">
                          {tConnector('automaticDigitSecondsDigitMilliseconds')}
                        </option>
                        <option value="seconds">{tConnector('seconds')}</option>
                        <option value="milliseconds">{tConnector('milliseconds')}</option>
                      </select>
                    </label>
                    <label>
                      {tConnector('displayTimeZone')}
                      <select
                        value={formatter.timeZone}
                        onChange={(event) =>
                          changeFormatter({ ...formatter, timeZone: event.target.value })
                        }
                      >
                        {[...new Set([formatter.timeZone, ...timeZones])].map((zone) => (
                          <option key={zone}>{zone}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    {tConnector('dateFormat')}
                    <input
                      value={formatter.pattern}
                      maxLength={100}
                      onChange={(event) =>
                        changeFormatter({ ...formatter, pattern: event.target.value })
                      }
                      placeholder="YYYY-MM-DD HH:mm:ss"
                    />
                  </label>
                  <small>{tConnector('supportsYyyyMmDdHhMmSsSssZA')}</small>
                </>
              )}
              {formatter?.type === 'json-path' && (
                <>
                  <label>
                    {tConnector('jsonPath')}
                    <input
                      value={formatter.path}
                      maxLength={1024}
                      onChange={(event) =>
                        changeFormatter({ ...formatter, path: event.target.value })
                      }
                      placeholder="$.items[0].name"
                    />
                  </label>
                  <small>
                    {tConnector('supportsNestedFieldsArrayIndicesAndQuotFieldNameQuot')}
                  </small>
                </>
              )}
              {formatter?.type === 'mask' && (
                <>
                  <div className={styles.fieldPair}>
                    <label>
                      {tConnector('visiblePrefixCharacters')}
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        value={formatter.prefix}
                        onChange={(event) =>
                          changeFormatter({ ...formatter, prefix: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label>
                      {tConnector('visibleSuffixCharacters')}
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        value={formatter.suffix}
                        onChange={(event) =>
                          changeFormatter({ ...formatter, suffix: Number(event.target.value) })
                        }
                      />
                    </label>
                  </div>
                  <small>
                    {tConnector('valuesShorterThanTheVisibleLengthAreFullyMaskedMasking')}
                  </small>
                </>
              )}
              {formatter?.type === 'template' && (
                <>
                  <label>
                    {tConnector('displayTemplate')}
                    <textarea
                      rows={3}
                      maxLength={4096}
                      value={formatter.template}
                      onChange={(event) =>
                        changeFormatter({ ...formatter, template: event.target.value })
                      }
                      spellCheck={false}
                    />
                  </label>
                  <small>
                    {tConnector('supports')}
                    {'${value}'}、{'${upper}'}、{'${lower}'}、{'${length}'}
                    {tConnector('textSubstitutionOnlyWithNoExpressionExecution')}
                  </small>
                </>
              )}
              {formatterError && (
                <p role="alert" className={styles.error}>
                  {formatterError}
                </p>
              )}
              <div className={styles.preview}>
                <strong>
                  {tConnector('livePreview')}
                  <small>{tConnector('firstCurrentlyLoadedRows')}</small>
                </strong>
                <div className={styles.previewLabels}>
                  <span>{tConnector('rawValue')}</span>
                  <span>{tConnector('displayedValue')}</span>
                </div>
                {result.rows.slice(0, 5).map((row, index) => {
                  const value = row[selected] ?? null,
                    preview = formatterError
                      ? { text: databaseCellText(value, locale), error: formatterError }
                      : applyColumnFormatter(value, formatter, locale);
                  return (
                    <div className={styles.previewRow} key={index}>
                      <code title={databaseCellText(value, locale)}>
                        {databaseCellText(value, locale).slice(0, 240)}
                      </code>
                      <code
                        title={preview.error ?? preview.text}
                        data-error={!!preview.error || undefined}
                      >
                        {preview.text.slice(0, 240) || <i>{tConnector('blank')}</i>}
                        {preview.error && (
                          <small>
                            {tConnector('originalValueRetained')}
                            {preview.error}
                          </small>
                        )}
                      </code>
                    </div>
                  );
                })}
                {!result.rows.length && (
                  <span className={styles.noPreview}>
                    {tConnector('noRecordsAreCurrentlyAvailableToPreview')}
                  </span>
                )}
              </div>
            </div>
          </section>
        </div>
        <footer className={`${common.dialogFooter} ${styles.footer}`}>
          <small>
            {persistent
              ? tConnector('savedInTheBrowserLayoutForThisConnectionAndResource')
              : tConnector('layoutAppliesOnlyToTheCurrentGrid')}
            {invalidCount
              ? tConnector('formattingSettingsNeedCorrection', { p0: String(invalidCount) })
              : ''}
          </small>
          <button type="button" className={common.secondary} onClick={onClose}>
            {tConnector('cancel')}
          </button>
          <button type="submit" className={common.primary} disabled={invalidCount > 0}>
            {tConnector('applyDisplaySettings')}
          </button>
        </footer>
      </form>
    </SqlDialog>
  );
}
