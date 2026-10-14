'use client';
import { uiText, uiFailure, type UiMessage, createUiMessages } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './panel.messages';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle,
  Copy,
  DownloadSimple,
  FileCode,
  Funnel,
  MagnifyingGlass,
  Table,
  Warning,
  X,
} from '@phosphor-icons/react';
import type { RelationalProvider } from '@fouc/shared';
import { buildSchemaDiff } from './compare';
import { buildSchemaDiffScript, expandSchemaDiffSelection } from './script';
import {
  schemaDiffChangeName,
  SCHEMA_DIFF_KIND_LABELS,
  SCHEMA_DIFF_OPERATION_LABELS,
  type SchemaDiffChange,
  type SchemaDiffInput,
  type SchemaDiffOptions,
} from './model';
import styles from './schema-diff.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export interface SchemaDiffPanelProps {
  provider: RelationalProvider;
  source: SchemaDiffInput;
  target: SchemaDiffInput;
  title?: string;
  sourceLabel?: string;
  targetLabel?: string;
  className?: string;
  options?: SchemaDiffOptions;
  onClose?: () => void;
}
const providerNames: Record<RelationalProvider, string> = {
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  sqlite: 'SQLite',
};
function DiffDdl({
  label,
  sql,
  focused,
}: {
  label: string;
  sql: string;
  focused: SchemaDiffChange | null;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const text = sql.slice(0, 128000);
  return (
    <div className={styles.ddlSide}>
      <header>
        {label}
        <small>
          {sql.length.toLocaleString(locale)}
          {tConnector('characters')}
        </small>
      </header>
      <pre tabIndex={0} aria-label={label}>
        {text.split('\n').map((line, index) => (
          <div
            key={index}
            data-focused={!!focused && line.includes(focused.name) ? 'true' : undefined}
          >
            <span>{index + 1}</span>
            <code>{line || ' '}</code>
          </div>
        ))}
      </pre>
      {sql.length > text.length && (
        <small className={styles.clipped}>
          {tConnector('previewingTheFirstCharactersCompleteOriginalMetadataIsRetained')}
        </small>
      )}
    </div>
  );
}
export function SchemaDiffPanel({
  provider,
  source,
  target,
  title: titleProvided,
  sourceLabel: sourceLabelProvided,
  targetLabel: targetLabelProvided,
  className = '',
  options: initialOptions,
  onClose,
}: SchemaDiffPanelProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const title =
    titleProvided === undefined ? tConnector('structureDifferenceReview') : titleProvided;
  const sourceLabel =
    sourceLabelProvided === undefined ? tConnector('sourceStructure') : sourceLabelProvided;
  const targetLabel =
    targetLabelProvided === undefined ? tConnector('targetObject') : targetLabelProvided;
  const [options, setOptions] = useState<SchemaDiffOptions>(() => ({ ...initialOptions }));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'selected' | 'destructive'>('all');
  const [tab, setTab] = useState<'details' | 'ddl' | 'script' | 'issues'>('details');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [feedbackStored, setFeedback] = useState<{
    error: boolean;
    text: UiMessage;
  } | null>(null);
  const feedback = feedbackStored && {
    ...feedbackStored,
    text: uiText(feedbackStored.text, locale),
  };
  const built = useMemo(() => {
    try {
      return { comparison: buildSchemaDiff(provider, source, target, options, locale), error: '' };
    } catch (error) {
      return { comparison: null, error: uiText(error, locale) };
    }
  }, [provider, source, target, options, locale]);
  const comparison = built.comparison;
  const comparisonKey = useMemo(
    () => ({ provider, source, target, options }),
    [provider, source, target, options],
  );
  const [selection, setSelection] = useState<{
    key: object | null;
    ids: string[];
  }>({ key: null, ids: [] });
  const selectedIds = useMemo(
    () =>
      comparison
        ? selection.key === comparisonKey
          ? selection.ids
          : comparison.changes
              .filter((change) => change.risk !== 'destructive')
              .map((change) => change.id)
        : [],
    [comparison, selection, comparisonKey],
  );
  const selected = useMemo(
    () => (comparison ? expandSchemaDiffSelection(comparison, selectedIds) : new Set<string>()),
    [comparison, selectedIds],
  );
  const script = useMemo(
    () => (comparison ? buildSchemaDiffScript(comparison, selectedIds, locale) : null),
    [comparison, selectedIds, locale],
  );
  const focus =
    comparison?.changes.find((change) => change.id === focusedId) ?? comparison?.changes[0] ?? null;
  const activeTable =
    comparison?.tables.find((table) => table.id === focus?.tableId) ?? comparison?.tables[0];
  const total = comparison?.changes.length ?? 0;
  const destructive =
    comparison?.changes.filter((change) => change.risk === 'destructive').length ?? 0;
  const matching =
    comparison?.changes.filter(
      (change) =>
        (!query ||
          `${schemaDiffChangeName(change, locale)} ${SCHEMA_DIFF_KIND_LABELS(locale)[change.kind]}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (filter === 'all' ||
          (filter === 'selected' && selected.has(change.id)) ||
          (filter === 'destructive' && change.risk === 'destructive')),
    ) ?? [];
  const manual = script?.issues.filter((issue) => issue.severity === 'unsupported').length ?? 0;
  function select(change: SchemaDiffChange, checked: boolean) {
    if (!comparison) return;
    setSelection({
      key: comparisonKey,
      ids: checked
        ? [...new Set([...selectedIds, change.id])]
        : selectedIds.filter((id) => id !== change.id),
    });
    setFeedback(null);
  }
  async function copy() {
    if (!script) return;
    try {
      if (!navigator.clipboard?.writeText)
        throw connectorUiMessages.error('clipboardWritingIsUnavailableDownloadTheScript');
      await navigator.clipboard.writeText(script.sql);
      setFeedback({
        error: false,
        text: connectorUiMessages.message('completeReviewScriptCopied'),
      });
    } catch (error) {
      setFeedback({ error: true, text: uiFailure(error) });
    }
  }
  function download() {
    if (!script) return;
    const url = URL.createObjectURL(
      new Blob([script.sql], { type: 'application/sql;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fouc-${provider}-schema-diff.sql`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback({ error: false, text: connectorUiMessages.message('reviewScriptDownloaded') });
  }
  return (
    <section className={`${styles.panel} ${className}`} aria-label={title}>
      <header className={styles.head}>
        <div>
          <FileCode size={19} />
          <h2>{title}</h2>
          <span>{providerNames[provider]}</span>
        </div>
        {onClose && (
          <button
            type="button"
            aria-label={tConnector('closeStructureDifferenceReview')}
            onClick={onClose}
          >
            <X size={17} />
          </button>
        )}
      </header>
      <div className={styles.direction}>
        <div>
          <small>{tConnector('desiredStructure')}</small>
          <strong>{sourceLabel}</strong>
        </div>
        <ArrowRight size={18} />
        <div>
          <small>{tConnector('changesApplyTo')}</small>
          <strong>{targetLabel}</strong>
        </div>
        <p>{tConnector('readMetadataGenerateReviewableDdlOnly')}</p>
      </div>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <MagnifyingGlass size={15} />
          <input
            aria-label={tConnector('filterStructureDifferences')}
            placeholder={tConnector('searchTablesColumnsOrConstraints')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className={styles.filter}>
          <Funnel size={14} />
          <select
            aria-label={tConnector('structureDifferenceFilter')}
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
          >
            <option value="all">
              {tConnector('allDifferences')}
              {total}）
            </option>
            <option value="selected">
              {tConnector('selectedChanges')}
              {selected.size}）
            </option>
            <option value="destructive">
              {tConnector('dataDeletion')}
              {destructive}）
            </option>
          </select>
        </label>
        <label className={styles.option}>
          <input
            type="checkbox"
            checked={!!options.ignoreComments}
            onChange={(event) =>
              setOptions((current) => ({ ...current, ignoreComments: event.target.checked }))
            }
          />
          {tConnector('ignoreComments')}
        </label>
        <label className={styles.option}>
          <input
            type="checkbox"
            checked={!!options.compareColumnOrder}
            onChange={(event) =>
              setOptions((current) => ({ ...current, compareColumnOrder: event.target.checked }))
            }
          />
          {tConnector('compareColumnOrder')}
        </label>
      </div>
      {built.error ? (
        <div className={styles.empty} role="alert">
          <Warning size={26} />
          <strong>{tConnector('structureComparisonTemporarilyUnavailable')}</strong>
          <p>{built.error}</p>
        </div>
      ) : (
        <div className={styles.workspace}>
          <aside className={styles.objects} aria-label={tConnector('structureDifferenceObjects')}>
            <header>
              <span>
                {comparison?.tables.length ?? 0}
                {tConnector('tables')}
                {total}
                {tConnector('differences')}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (comparison)
                    setSelection({
                      key: comparisonKey,
                      ids: comparison.changes.map((change) => change.id),
                    });
                }}
              >
                {tConnector('selectAll')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (comparison) setSelection({ key: comparisonKey, ids: [] });
                }}
              >
                {tConnector('clear')}
              </button>
            </header>
            {comparison?.tables.map((table) => {
              const changes = matching.filter((change) => change.tableId === table.id);
              return changes.length ? (
                <div className={styles.group} key={table.id}>
                  <h3>
                    <Table size={14} />
                    <span title={table.name}>{table.name}</span>
                    <small>{changes.length}</small>
                  </h3>
                  {changes.map((change) => (
                    <div
                      key={change.id}
                      className={styles.object}
                      data-active={focus?.id === change.id || undefined}
                    >
                      <input
                        type="checkbox"
                        aria-label={tConnector('select', {
                          p0: String(SCHEMA_DIFF_KIND_LABELS(locale)[change.kind]),
                          p1: String(schemaDiffChangeName(change, locale)),
                        })}
                        checked={selected.has(change.id)}
                        onChange={(event) => select(change, event.target.checked)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFocusedId(change.id);
                          setTab('details');
                        }}
                      >
                        <span>{schemaDiffChangeName(change, locale)}</span>
                        <small>
                          {SCHEMA_DIFF_KIND_LABELS(locale)[change.kind]}
                          {selected.has(change.id) && !selectedIds.includes(change.id)
                            ? tConnector('automaticallyLinked')
                            : ''}
                        </small>
                      </button>
                      <em data-operation={change.operation}>
                        {SCHEMA_DIFF_OPERATION_LABELS(locale)[change.operation]}
                      </em>
                    </div>
                  ))}
                </div>
              ) : null;
            })}
            {!matching.length && (
              <div className={styles.listEmpty}>
                {total
                  ? tConnector('noItemsMatchTheCurrentFilter')
                  : manual
                    ? tConnector('moreMetadataOrManualReviewIsRequired')
                    : tConnector('noStructureDifferencesFound')}
              </div>
            )}
          </aside>
          <main className={styles.review}>
            <div
              className={styles.tabs}
              role="tablist"
              aria-label={tConnector('structureDifferenceReviewView')}
            >
              {(
                [
                  ['details', tConnector('differenceDetails')],
                  ['ddl', tConnector('originalDdl')],
                  ['script', tConnector('changeScript', { p0: String(script?.steps.length ?? 0) })],
                  [
                    'issues',
                    tConnector('effectsAndLimits', { p0: String(script?.issues.length ?? 0) }),
                  ],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={styles.reviewBody}>
              {tab === 'details' &&
                (focus ? (
                  <>
                    <div className={styles.detailHead}>
                      <div>
                        <small>
                          {SCHEMA_DIFF_KIND_LABELS(locale)[focus.kind]} · {activeTable?.name}
                        </small>
                        <h3>{schemaDiffChangeName(focus, locale)}</h3>
                      </div>
                      <span data-operation={focus.operation}>
                        {SCHEMA_DIFF_OPERATION_LABELS(locale)[focus.operation]}
                      </span>
                    </div>
                    <p className={styles.changeNote}>
                      {focus.operation === 'add'
                        ? tConnector('theStructureExistsInTheSourceButIsMissingFrom')
                        : focus.operation === 'remove'
                          ? tConnector('theItemExistsInTheTargetButNotTheSource')
                          : tConnector('adjustTargetPropertiesToMatchTheSource')}
                    </p>
                    {focus.fields.length ? (
                      <table className={styles.fields}>
                        <thead>
                          <tr>
                            <th>{tConnector('property')}</th>
                            <th>{tConnector('currentTargetValue')}</th>
                            <th>{tConnector('desiredSourceValue')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {focus.fields.map((field) => (
                            <tr key={field.key}>
                              <th>{field.label}</th>
                              <td>
                                <code>{field.before}</code>
                              </td>
                              <td>
                                <code>{field.after}</code>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className={styles.metadata}>
                        <div>
                          <strong>{tConnector('currentTargetDefinition')}</strong>
                          <pre>
                            {focus.target === null
                              ? tConnector('doesNotExist')
                              : JSON.stringify(focus.target, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <strong>{tConnector('desiredSourceDefinition')}</strong>
                          <pre>
                            {focus.source === null
                              ? tConnector('doesNotExist')
                              : JSON.stringify(focus.source, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                    {focus.risk !== 'low' && (
                      <p className={styles.impact}>
                        <Warning size={15} />
                        {focus.risk === 'destructive'
                          ? tConnector(
                              'includesDataDeletionCheckBackupsAndExternalReferencesBeforeReviewing',
                            )
                          : tConnector('thisChangeMayInspectConvertOrRebuildExistingData')}
                      </p>
                    )}
                  </>
                ) : (
                  <div className={styles.empty}>
                    <CheckCircle size={27} />
                    <strong>
                      {manual
                        ? tConnector('additionalStructureReviewRequired')
                        : tConnector('structuresMatch')}
                    </strong>
                    <p>
                      {manual
                        ? tConnector('seeEffectsAndLimitsForMissingInformation')
                        : tConnector('comparisonCoversOnlyTheProvidedTablesAndMetadata')}
                    </p>
                  </div>
                ))}
              {tab === 'ddl' && (
                <div className={styles.ddlGrid}>
                  <DiffDdl
                    label={tConnector('originalSourceDdl')}
                    sql={activeTable?.source?.definition.sql ?? tConnector('sourceObjectAbsent')}
                    focused={focus}
                  />
                  <DiffDdl
                    label={tConnector('originalTargetDdl')}
                    sql={activeTable?.target?.definition.sql ?? tConnector('targetObjectAbsent')}
                    focused={focus}
                  />
                </div>
              )}
              {tab === 'script' && (
                <div className={styles.script}>
                  <div className={styles.scriptSummary}>
                    {manual ? <Warning size={15} /> : <FileCode size={15} />}
                    <strong>
                      {manual
                        ? tConnector('itemsRequireManualHandling', { p0: String(manual) })
                        : tConnector('orderedSteps', { p0: String(script?.steps.length ?? 0) })}
                    </strong>
                    <small>
                      {tConnector('select2216')}
                      {selected.size}
                      {tConnector('itemsDependenciesOrderedAutomatically')}
                    </small>
                  </div>
                  <pre tabIndex={0} aria-label={tConnector('structureChangeSqlScript')}>
                    {script?.sql}
                  </pre>
                </div>
              )}
              {tab === 'issues' && (
                <div className={styles.issues}>
                  {script?.issues.length ? (
                    script.issues.map((issue, index) => (
                      <div key={index} data-severity={issue.severity}>
                        <Warning size={16} />
                        <div>
                          <strong>
                            {issue.severity === 'unsupported'
                              ? tConnector('requiresManualHandling')
                              : issue.severity === 'warning'
                                ? tConnector('effectsAndPrerequisites')
                                : tConnector('metadataInformation')}
                          </strong>
                          <p>{issue.message}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.empty}>
                      <CheckCircle size={27} />
                      <p>{tConnector('theSelectionHasNoAdditionalRestrictionsButTargetDataAnd')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      )}
      {feedback && (
        <p
          className={styles.feedback}
          data-error={feedback.error || undefined}
          role={feedback.error ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
      )}
      <footer className={styles.footer}>
        <span>
          {selected.size}
          {tConnector('itemsSelected')}
          {selected.size > selectedIds.length
            ? tConnector('automaticallyLinked2224', {
                p0: String(selected.size - selectedIds.length),
              })
            : ''}
          {manual ? tConnector('handledManually', { p0: String(manual) }) : ''}
        </span>
        <button
          type="button"
          disabled={!script || !script.steps.length}
          onClick={() => void copy()}
        >
          <Copy size={15} />
          {tConnector('copyReviewScript')}
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={!script || !script.steps.length}
          onClick={download}
        >
          <DownloadSimple size={15} />
          {tConnector('downloadDdl')}
        </button>
      </footer>
    </section>
  );
}
