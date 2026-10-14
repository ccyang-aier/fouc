'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './panel.messages';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowsLeftRight,
  CaretDown,
  CaretLeft,
  CaretRight,
  Code,
  Copy,
  MagnifyingGlass,
  Play,
  SpinnerGap,
  Stop,
  WarningCircle,
} from '@phosphor-icons/react';
import type { DatabaseQueryResult, RelationalProvider } from '@fouc/shared';
import { compareDataResults } from './compare';
import { CompareEntryDetail } from './entry-detail';
import { CompareMappingEditor } from './mapping-editor';
import {
  compareCellAt,
  inferCompareKeys,
  inferCompareMappings,
  type DataCompareColumnMapping,
  type DataCompareEntry,
  type DataCompareKind,
  type DataCompareProgress,
  type DataCompareResult,
  type DataCompareSqlPreview,
  type DataCompareTarget,
} from './model';
import { buildDataCompareSqlPreview } from './sql-preview';
import { compareCellText } from './values';
import styles from './compare.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export type { DataCompareColumnMapping, DataCompareResult, DataCompareTarget } from './model';
export type DataComparePanelProps = {
  left: DatabaseQueryResult;
  right: DatabaseQueryResult;
  leftLabel: string;
  rightLabel: string;
  provider?: RelationalProvider;
  target?: DataCompareTarget;
  leftPrimaryKeys?: readonly string[];
  initialMapping?: readonly DataCompareColumnMapping[];
  initialKeyColumns?: readonly string[];
  scopeKey?: string;
  onNotice?: (message: string) => void;
  onSqlPreview?: (sql: string) => void;
};
const PAGE_SIZE = 50;
const kindNames = (locale?: Locale): Record<DataCompareKind, string> => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    added: tConnector('insertCandidates'),
    removed: tConnector('deleteCandidates'),
    modified: tConnector('modified'),
    unchanged: tConnector('equal'),
    conflict: tConnector('conflicts'),
  };
};
const objectKeys = new WeakMap<DatabaseQueryResult, number>();
let nextObjectKey = 0;
function objectKey(value: DatabaseQueryResult): number {
  let key = objectKeys.get(value);
  if (key === undefined) {
    key = ++nextObjectKey;
    objectKeys.set(value, key);
  }
  return key;
}
function selectable(entry: DataCompareEntry) {
  return entry.kind === 'added' || entry.kind === 'removed' || entry.kind === 'modified';
}
function matchesSearch(
  entry: DataCompareEntry,
  comparison: DataCompareResult,
  query: string,
  locale?: Locale,
): boolean {
  if (!query) return true;
  if (
    entry.keyValues.some((value) =>
      compareCellText(value, undefined, locale).toLowerCase().includes(query),
    ) ||
    entry.reasons.some((reason) => reason.toLowerCase().includes(query))
  )
    return true;
  for (const side of ['left', 'right'] as const)
    for (const row of entry[side === 'left' ? 'leftRows' : 'rightRows'])
      for (const mapping of comparison.mapping)
        if (
          compareCellText(
            compareCellAt(comparison[side].rows[row], mapping[side]),
            undefined,
            locale,
          )
            .toLowerCase()
            .includes(query)
        )
          return true;
  return false;
}
/** The parent supplies actual results from its current connection; this panel never reads another source. */
export function DataComparePanel(props: DataComparePanelProps) {
  return (
    <DataCompareContent
      key={`${props.scopeKey ?? ''}:${props.provider ?? ''}:${objectKey(props.left)}:${objectKey(props.right)}`}
      {...props}
    />
  );
}
function DataCompareContent({
  left,
  right,
  leftLabel,
  rightLabel,
  provider,
  target,
  leftPrimaryKeys = [],
  initialMapping,
  initialKeyColumns,
  onNotice,
  onSqlPreview,
}: DataComparePanelProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [configuration, setConfiguration] = useState(() => {
    const mapping = initialMapping
      ? [...initialMapping]
      : inferCompareMappings(left.columns, right.columns);
    return {
      mapping,
      keys: initialKeyColumns
        ? [...initialKeyColumns]
        : inferCompareKeys(left, mapping, leftPrimaryKeys),
    };
  });
  const [comparison, setComparison] = useState<DataCompareResult | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<DataCompareProgress | null>(null),
    [errorStored, setError] = useState<UiMessage>(''),
    [feedbackStored, setFeedback] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const feedback = uiText(feedbackStored, locale);
  const [mappingOpen, setMappingOpen] = useState(true),
    [filter, setFilter] = useState<'changes' | 'all' | DataCompareKind>('changes'),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(0),
    [activeId, setActiveId] = useState<string | null>(null),
    [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [sqlOpen, setSqlOpen] = useState(false),
    [sqlPreview, setSqlPreview] = useState<DataCompareSqlPreview | null>(null),
    [sqlErrorStored, setSqlError] = useState<UiMessage>(''),
    [sqlBusy, setSqlBusy] = useState(false),
    [sqlProvider, setSqlProvider] = useState<RelationalProvider | ''>(provider ?? ''),
    [targetTable, setTargetTable] = useState(target?.table ?? ''),
    [targetSchema, setTargetSchema] = useState(target?.schema ?? '');
  const sqlError = uiText(sqlErrorStored, locale);
  const controller = useRef<AbortController | null>(null),
    sqlRun = useRef(0),
    mounted = useRef(true),
    search = useDeferredValue(query.trim().toLowerCase());
  const filtered = useMemo(
    () =>
      comparison?.entries.filter(
        (entry) =>
          (filter === 'all' || filter === 'changes'
            ? filter === 'all' || entry.kind !== 'unchanged'
            : entry.kind === filter) && matchesSearch(entry, comparison, search, locale),
      ) ?? [],
    [comparison, filter, search, locale],
  );
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1)),
    visible = filtered.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE),
    active = comparison?.entries.find((entry) => entry.id === activeId);
  const eligible = filtered.filter(selectable),
    allSelected = eligible.length > 0 && eligible.every((entry) => selected.has(entry.id)),
    partial = left.hasMore || left.truncated || right.hasMore || right.truncated;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  function notice(message: UiMessage) {
    setFeedback(message);
    onNotice?.(uiText(message, locale));
  }
  function clearSql() {
    sqlRun.current++;
    setSqlPreview(null);
    setSqlError('');
    setSqlBusy(false);
  }
  function changeConfiguration(mapping: DataCompareColumnMapping[], keys: string[]) {
    controller.current?.abort();
    setConfiguration({ mapping, keys });
    setComparison(null);
    setSelected(new Set());
    setActiveId(null);
    setError('');
    setFeedback('');
    clearSql();
  }
  async function run() {
    controller.current?.abort();
    const runController = new AbortController();
    controller.current = runController;
    setBusy(true);
    setProgress(null);
    setError('');
    setFeedback('');
    setComparison(null);
    setSelected(new Set());
    setActiveId(null);
    clearSql();
    try {
      const next = await compareDataResults(
        left,
        right,
        { mapping: configuration.mapping, keyColumns: configuration.keys, provider },
        {
          signal: runController.signal,
          onProgress: (value) => {
            if (!runController.signal.aborted && mounted.current) setProgress(value);
          },
        },
        locale,
      );
      if (!runController.signal.aborted && mounted.current) {
        setComparison(next);
        setMappingOpen(false);
        setPage(0);
        notice(
          connectorUiMessages.message('comparisonCompleteDifferingKeysConflictingKeys', {
            p0: String(next.counts.added + next.counts.removed + next.counts.modified),
            p1: String(next.counts.conflict),
          }),
        );
      }
    } catch (reason) {
      if (mounted.current) {
        if (runController.signal.aborted)
          setFeedback(connectorUiMessages.message('comparisonCancelled'));
        else setError(reason instanceof Error ? uiFailure(reason) : String(reason));
      }
    } finally {
      if (mounted.current && controller.current === runController) setBusy(false);
    }
  }
  function changeSelected(next: ReadonlySet<string>) {
    setSelected(next);
    clearSql();
  }
  function toggleRow(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    changeSelected(next);
  }
  function selectFiltered() {
    const next = new Set(selected);
    for (const entry of eligible) {
      if (allSelected) next.delete(entry.id);
      else next.add(entry.id);
    }
    changeSelected(next);
  }
  async function generateSql() {
    if (!comparison || !sqlProvider || !targetTable.trim() || !selected.size) return;
    const runId = ++sqlRun.current;
    setSqlBusy(true);
    setSqlError('');
    setSqlPreview(null);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (runId !== sqlRun.current || !mounted.current) return;
      const output = buildDataCompareSqlPreview(
        comparison,
        selected,
        sqlProvider,
        {
          table: targetTable,
          schema: targetSchema || undefined,
          columns:
            target?.table === targetTable && (target.schema ?? '') === targetSchema
              ? target.columns
              : undefined,
        },
        locale,
      );
      if (runId === sqlRun.current && mounted.current) setSqlPreview(output);
    } catch (reason) {
      if (runId === sqlRun.current && mounted.current)
        setSqlError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      if (runId === sqlRun.current && mounted.current) setSqlBusy(false);
    }
  }
  async function copySql() {
    if (!sqlPreview?.sql) return;
    try {
      await navigator.clipboard.writeText(sqlPreview.sql);
      notice(
        connectorUiMessages.message('copiedSqlReviewCandidates', {
          p0: String(sqlPreview.statements),
        }),
      );
    } catch {
      notice(connectorUiMessages.message('copyFailedCheckClipboardPermissions'));
    }
  }
  return (
    <div className={styles.panel}>
      <div className={styles.sourceBar}>
        <div>
          <span>{tConnector('leftReference')}</span>
          <strong title={leftLabel}>{leftLabel}</strong>
          <small>
            {left.rows.length.toLocaleString(locale)}
            {tConnector('rows')}
            {left.columns.length}
            {tConnector('columns')}
            {left.truncated || left.hasMore ? tConnector('partialResults') : ''}
          </small>
        </div>
        <ArrowRight size={18} />
        <div>
          <span>{tConnector('rightTarget')}</span>
          <strong title={rightLabel}>{rightLabel}</strong>
          <small>
            {right.rows.length.toLocaleString(locale)}
            {tConnector('rows')}
            {right.columns.length}
            {tConnector('columns')}
            {right.truncated || right.hasMore ? tConnector('partialResults') : ''}
          </small>
        </div>
      </div>
      <div className={`${styles.scopeNotice} ${partial ? styles.partial : ''}`}>
        {partial && <WarningCircle size={14} />}
        <span>
          {tConnector('onlyTheseTwoLoadedResultSetsAreCompared')}
          {partial
            ? tConnector('theInputsAreTruncatedOrHaveMoreDataPresenceOn')
            : tConnector('theComparisonDescribesTheCurrentQueryOrTablePageRange')}
        </span>
      </div>
      <div className={styles.compareToolbar}>
        <button
          type="button"
          className={styles.mappingToggle}
          disabled={busy}
          aria-expanded={mappingOpen}
          onClick={() => setMappingOpen(!mappingOpen)}
        >
          <ArrowsLeftRight size={14} />
          {configuration.mapping.length}
          {tConnector('columnPairs')}
          {configuration.keys.length}
          {tConnector('matchingKeys')}
          <CaretDown size={12} />
        </button>
        <span>{tConnector('leftRightReview')}</span>
        {busy ? (
          <button type="button" onClick={() => controller.current?.abort()}>
            <Stop size={13} />
            {tConnector('cancelComparison')}
          </button>
        ) : (
          <button
            type="button"
            className={styles.primary}
            disabled={!configuration.mapping.length || !configuration.keys.length}
            onClick={() => void run()}
          >
            <Play size={13} />
            {comparison ? tConnector('compareAgain') : tConnector('startComparison')}
          </button>
        )}
      </div>
      <div className={styles.body}>
        {mappingOpen && (
          <CompareMappingEditor
            left={left}
            right={right}
            mapping={configuration.mapping}
            keys={configuration.keys}
            primaryKeys={leftPrimaryKeys}
            disabled={busy}
            onChange={changeConfiguration}
          />
        )}
        {error && (
          <p role="alert" className={styles.error}>
            <WarningCircle size={14} />
            {error}
          </p>
        )}
        {busy && (
          <div className={styles.progress} role="status">
            <div>
              <SpinnerGap size={15} className={styles.spinner} />
              <strong>
                {progress?.phase === 'left'
                  ? tConnector('indexingLeftResults')
                  : progress?.phase === 'right'
                    ? tConnector('indexingRightResults')
                    : tConnector('comparingMatchedRows')}
              </strong>
              <span>
                {progress
                  ? `${Math.round((progress.completed / Math.max(1, progress.total)) * 100)}%`
                  : tConnector('preparing')}
              </span>
            </div>
            <progress max={progress?.total || 1} value={progress?.completed ?? 0} />
            <p>{tConnector('compareUpToRowsAndCellsCancelAtAnyTime')}</p>
          </div>
        )}
        {!busy && !comparison && !error && (
          <div className={styles.empty}>
            <ArrowsLeftRight size={25} />
            <strong>
              {configuration.keys.length
                ? tConnector('prepareToCompareLoadedResults')
                : tConnector('selectMatchingKeys')}
            </strong>
            <p>{tConnector('selectOneOrMoreColumnsThatUniquelyMatchRowsThen')}</p>
          </div>
        )}
        {comparison && (
          <>
            <nav className={styles.kindTabs} aria-label={tConnector('comparisonResultCategory')}>
              {(
                ['changes', 'all', 'added', 'removed', 'modified', 'conflict', 'unchanged'] as const
              ).map((kind) => (
                <button
                  type="button"
                  key={kind}
                  aria-pressed={filter === kind}
                  onClick={() => {
                    setFilter(kind);
                    setPage(0);
                    setActiveId(null);
                  }}
                  data-kind={kind}
                >
                  {kind === 'changes'
                    ? tConnector('differences')
                    : kind === 'all'
                      ? tConnector('all')
                      : kindNames(locale)[kind]}
                  <b>
                    {kind === 'changes'
                      ? comparison.entries.length - comparison.counts.unchanged
                      : kind === 'all'
                        ? comparison.entries.length
                        : comparison.counts[kind]}
                  </b>
                </button>
              ))}
            </nav>
            <div className={styles.resultsToolbar}>
              <label>
                <MagnifyingGlass size={14} />
                <input
                  aria-label={tConnector('searchComparisonKeysAndRawValues')}
                  placeholder={tConnector('searchKeysOrRawValues')}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(0);
                    setActiveId(null);
                  }}
                />
              </label>
              <button type="button" disabled={!eligible.length} onClick={selectFiltered}>
                {allSelected
                  ? tConnector('deselectTheCurrentFilter')
                  : tConnector('selectTheCurrentFilter')}
              </button>
              <span>
                {selected.size}
                {tConnector('suggestionsSelected')}
              </span>
              {selected.size > 0 && (
                <button type="button" onClick={() => changeSelected(new Set())}>
                  {tConnector('clear')}
                </button>
              )}
            </div>
            <div className={styles.resultsLayout}>
              <div className={styles.matrix}>
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          aria-label={tConnector('selectDifferencesMatchingTheCurrentFilter')}
                          checked={allSelected}
                          disabled={!eligible.length}
                          onChange={selectFiltered}
                        />
                      </th>
                      <th>{tConnector('status')}</th>
                      <th>{tConnector('matchingKey')}</th>
                      <th>{tConnector('leftRow')}</th>
                      <th>{tConnector('rightRow')}</th>
                      <th>{tConnector('changes')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((entry) => (
                      <tr
                        key={entry.id}
                        data-active={activeId === entry.id || undefined}
                        onClick={() => setActiveId(entry.id)}
                      >
                        <td>
                          <input
                            type="checkbox"
                            aria-label={tConnector('selectSuggestionsFor', {
                              p0: String(
                                entry.keyValues
                                  .map((value) => compareCellText(value, undefined, locale))
                                  .join(' / '),
                              ),
                            })}
                            disabled={!selectable(entry)}
                            checked={selected.has(entry.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleRow(entry.id)}
                          />
                        </td>
                        <td>
                          <span className={styles.kind} data-kind={entry.kind}>
                            {kindNames(locale)[entry.kind]}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            title={entry.keyValues
                              .map((value) => compareCellText(value, undefined, locale))
                              .join(' / ')}
                            onClick={() => setActiveId(entry.id)}
                          >
                            {entry.keyValues
                              .map((value) => compareCellText(value, undefined, locale))
                              .join(' / ')}
                          </button>
                        </td>
                        <td>
                          {entry.leftRows.length
                            ? entry.leftRows.length > 1
                              ? tConnector('duplicateRows', { p0: String(entry.leftRows.length) })
                              : entry.leftRows[0] + 1
                            : '—'}
                        </td>
                        <td>
                          {entry.rightRows.length
                            ? entry.rightRows.length > 1
                              ? tConnector('duplicateRows', { p0: String(entry.rightRows.length) })
                              : entry.rightRows[0] + 1
                            : '—'}
                        </td>
                        <td>
                          {entry.kind === 'conflict'
                            ? tConnector('needsAttention')
                            : entry.changes.length || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visible.length && (
                  <div className={styles.resultsEmpty}>
                    {query
                      ? tConnector('noMatchingKeysOrRawValues')
                      : filter === 'changes'
                        ? tConnector('noDifferencesFoundForTheCurrentMappingsAndMatchingKeys')
                        : tConnector('noRecordsInThisCategory')}
                  </div>
                )}
                <footer className={styles.pagination}>
                  <span>
                    {filtered.length
                      ? `${pageIndex * PAGE_SIZE + 1}–${Math.min((pageIndex + 1) * PAGE_SIZE, filtered.length)} / ${filtered.length}`
                      : tConnector('matchingKeys715')}
                  </span>
                  <button
                    type="button"
                    disabled={pageIndex === 0}
                    aria-label={tConnector('previousComparisonPage')}
                    onClick={() => setPage(pageIndex - 1)}
                  >
                    <CaretLeft size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={(pageIndex + 1) * PAGE_SIZE >= filtered.length}
                    aria-label={tConnector('nextComparisonPage')}
                    onClick={() => setPage(pageIndex + 1)}
                  >
                    <CaretRight size={13} />
                  </button>
                </footer>
              </div>
              {active ? (
                <CompareEntryDetail
                  key={active.id}
                  entry={active}
                  comparison={comparison}
                  provider={provider}
                  leftLabel={leftLabel}
                  rightLabel={rightLabel}
                />
              ) : (
                <div className={styles.detailPlaceholder}>
                  <Code size={20} />
                  <span>{tConnector('clickAMatchingKeyToInspectRawValuesOnBoth')}</span>
                </div>
              )}
            </div>
          </>
        )}
        {sqlOpen && comparison && (
          <section
            className={styles.sqlReview}
            aria-label={tConnector('sqlChangeSuggestionPreview')}
          >
            <div className={styles.sectionHead}>
              <strong>{tConnector('sqlChangeSuggestions')}</strong>
              <span>
                {tConnector('generateReviewCandidatesOnlyForExplicitlySelectedDifferences')}
              </span>
            </div>
            <div className={styles.sqlTarget}>
              <label>
                {tConnector('targetTable')}
                <input
                  aria-label={tConnector('sqlSuggestionTargetTable')}
                  value={targetTable}
                  onChange={(event) => {
                    setTargetTable(event.target.value);
                    clearSql();
                  }}
                  placeholder={tConnector('provideTheActualTargetTableName')}
                />
              </label>
              <label>
                Schema
                <input
                  aria-label={tConnector('sqlSuggestionTargetSchema')}
                  value={targetSchema}
                  onChange={(event) => {
                    setTargetSchema(event.target.value);
                    clearSql();
                  }}
                  placeholder={tConnector('optional')}
                />
              </label>
              {!provider && (
                <label>
                  {tConnector('sqlDialect')}
                  <select
                    aria-label={tConnector('sqlSuggestionDatabaseType')}
                    value={sqlProvider}
                    onChange={(event) => {
                      setSqlProvider(event.target.value as RelationalProvider | '');
                      clearSql();
                    }}
                  >
                    <option value="">{tConnector('selectAnOption')}</option>
                    <option value="postgres">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="sqlite">SQLite</option>
                  </select>
                </label>
              )}
              <button
                type="button"
                disabled={!selected.size || !targetTable.trim() || !sqlProvider || sqlBusy}
                onClick={() => void generateSql()}
              >
                {sqlBusy ? <SpinnerGap size={13} className={styles.spinner} /> : <Code size={13} />}
                {tConnector('generatePreview')}
              </button>
            </div>
            {sqlError && (
              <p role="alert" className={styles.error}>
                {sqlError}
              </p>
            )}
            {sqlPreview && (
              <>
                {sqlPreview.warnings.map((warning) => (
                  <p className={styles.sqlWarning} key={warning}>
                    {warning}
                  </p>
                ))}
                {sqlPreview.skipped.length > 0 && (
                  <details className={styles.skipped}>
                    <summary>
                      {sqlPreview.skipped.length}
                      {tConnector('suggestionsHaveNoGeneratedSql')}
                    </summary>
                    {sqlPreview.skipped.map((item) => (
                      <p key={item.entryId}>
                        {item.entryId} · {item.reason}
                      </p>
                    ))}
                  </details>
                )}
                <textarea
                  readOnly
                  spellCheck={false}
                  aria-label={tConnector('sqlChangeSuggestionPreviewContent')}
                  value={
                    sqlPreview.sql || tConnector('theCurrentSelectionHasNoSqlCandidatesToGenerate')
                  }
                />
                <div className={styles.sqlActions}>
                  <span>
                    {sqlPreview.statements}
                    {tConnector('candidates')}
                  </span>
                  <button type="button" disabled={!sqlPreview.sql} onClick={() => void copySql()}>
                    <Copy size={13} />
                    {tConnector('copySql')}
                  </button>
                  {onSqlPreview && (
                    <button
                      type="button"
                      disabled={!sqlPreview.sql}
                      onClick={() => onSqlPreview(sqlPreview.sql)}
                    >
                      {tConnector('sendToTheSqlEditorForReview')}
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </div>
      <footer className={styles.footer}>
        <span>
          {feedback ||
            tConnector('scopeCurrentlyLoadedResultsMatchingKeysRequireExplicitConfirmation')}
          {comparison ? ` · ${Math.round(comparison.elapsedMs)} ms` : ''}
        </span>
        {comparison && (
          <button type="button" aria-expanded={sqlOpen} onClick={() => setSqlOpen(!sqlOpen)}>
            <Code size={14} />
            {tConnector('sqlSuggestions')}
            {selected.size ? ` · ${selected.size}` : ''}
          </button>
        )}
      </footer>
    </div>
  );
}
