'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../i18n/ui-message';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-quick-actions.messages';
const translateConnector = createTranslator(connectorMessages);
import { useMemo, useRef, useState, type RefObject } from 'react';
import type { EditorView } from '@codemirror/view';
import type { RelationalProvider, SqlFormatterCase } from '@fouc/shared';
import {
  ArrowSquareOut,
  BracketsCurly,
  Check,
  Clipboard,
  CodeBlock,
  Columns,
  ClipboardText,
  Table,
  TextAa,
  WarningCircle,
} from '@phosphor-icons/react';
import { SqlDialog } from './sql-library-dialog';
import { SqlEditor } from './sql-editor';
import {
  captureSqlAction,
  applySqlAction,
  sqlTextActionEdit,
  type SqlActionSnapshot,
  type SqlTextAction,
} from './sql-assistance/actions/editor-actions';
import { formatSqlText, compressSqlText } from './sql-format/formatter';
import {
  analyzeIntentionActions,
  type IntentionAction,
} from './sql-assistance/actions/intention-actions';
import {
  intentionActionEdit,
  sqlBlockCommentEdit,
  sqlInListEdit,
  sqlInListIssue,
  sqlLineCommentEdit,
  sqlWildcardEdit,
  sqlWildcardFields,
} from './sql-assistance/actions/action-edits';
import {
  buildSqlTableShortcut,
  normalizeSqlShortcutLimit,
  sqlShortcutContextTable,
  sqlTableNameIssue,
  sqlTableShortcutEdit,
} from './sql-assistance/actions/table-shortcuts';
import common from './relational.module.css';
import styles from './sql-quick-actions.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
type Props = {
  editorRef: RefObject<EditorView | null>;
  provider: RelationalProvider;
  disabled: boolean;
  keywordCase?: SqlFormatterCase;
  onFormatSql?: (sql: string) => Promise<string>;
  onNotice: (message: string) => void;
};
const textActions = (
  locale?: Locale,
): {
  id: SqlTextAction;
  label: string;
  note: string;
}[] => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    {
      id: 'upper',
      label: tConnector('convertToUppercase'),
      note: tConnector('preserveStringContentsAcrossTheSelection'),
    },
    {
      id: 'lower',
      label: tConnector('convertToLowercase'),
      note: tConnector('preserveStringContentsAcrossTheSelection'),
    },
    {
      id: 'quote-string',
      label: tConnector('sqlStringQuoting'),
      note: tConnector('escapeQuotesAndPreserveContentPrecision'),
    },
    {
      id: 'quote-identifier',
      label: tConnector('identifierQuoting'),
      note: tConnector('useTheCurrentDatabaseSQuoteCharacters'),
    },
    {
      id: 'unquote',
      label: tConnector('removeOuterQuotes'),
      note: tConnector('decodePairedQuotes'),
    },
    {
      id: 'json-string',
      label: tConnector('convertToJsonString'),
      note: tConnector('forQueryTextInApplications'),
    },
  ];
};
export function SqlQuickActions({
  editorRef,
  provider,
  disabled,
  keywordCase = 'upper',
  onFormatSql,
  onNotice,
}: Props) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [snapshot, setSnapshot] = useState<SqlActionSnapshot | null>(null),
    [errorStored, setError] = useState<UiMessage>(''),
    [busy, setBusy] = useState(false);
  const error = uiText(errorStored, locale);
  const [tab, setTab] = useState<'context' | 'text' | 'in' | 'table'>('context'),
    [inSource, setInSource] = useState(''),
    [copied, setCopied] = useState(false);
  const [tableName, setTableName] = useState(''),
    [limit, setLimit] = useState('100'),
    [projection, setProjection] = useState('id, name'),
    [tableKind, setTableKind] = useState<'select' | 'count' | 'projection'>('select');
  const [wildcard, setWildcard] = useState(false),
    [fields, setFields] = useState<Record<string, string>>({});
  const previewEditor = useRef<EditorView | null>(null);
  const intentions = useMemo(
    () =>
      snapshot
        ? analyzeIntentionActions({
            sql: snapshot.state.doc.toString(),
            cursor: snapshot.state.selection.main.head,
            databaseType: provider,
            selection: snapshot.state.selection.main,
          })
        : [],
    [snapshot, provider],
  );
  const sources = useMemo(
    () => (snapshot ? sqlWildcardFields(snapshot, provider) : []),
    [snapshot, provider],
  );
  const inPreview = useMemo(
    () => (snapshot ? sqlInListEdit(snapshot, inSource, provider, keywordCase) : null),
    [snapshot, inSource, provider, keywordCase],
  );
  const tableIssue =
    sqlTableNameIssue(tableName, provider, locale) ||
    (tableKind !== 'count' && (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100000)
      ? tConnector('rowCountMustBeAnIntegerFromTo')
      : '');
  const tableSql = buildSqlTableShortcut(
    tableKind,
    tableName,
    normalizeSqlShortcutLimit(limit),
    projection,
    keywordCase,
  );
  function open() {
    const current = captureSqlAction(editorRef.current);
    if (!current) return;
    setSnapshot(current);
    setError('');
    setCopied(false);
    setWildcard(false);
    setTab('context');
    const range = current.state.selection.main;
    setInSource(range.empty ? '' : current.state.sliceDoc(range.from, range.to));
    setTableName(sqlShortcutContextTable(current, provider));
    setFields(
      Object.fromEntries(
        sqlWildcardFields(current, provider).map((source) => [source.id, source.fields.join('\n')]),
      ),
    );
  }
  function close() {
    setSnapshot(null);
    editorRef.current?.focus();
  }
  function finish(edit: Parameters<typeof applySqlAction>[2], notice: string) {
    if (!snapshot || disabled) return;
    if (!applySqlAction(() => editorRef.current, snapshot, edit)) {
      setError(connectorUiMessages.message('editorContentChangedCloseAndReopenQuickActions'));
      return;
    }
    close();
    onNotice(notice);
  }
  function apply(id: SqlTextAction) {
    if (!snapshot) return;
    const edit = sqlTextActionEdit(snapshot, id, provider);
    if (!edit) {
      setError(connectorUiMessages.message('selectSqlTextThatCanBeConverted'));
      return;
    }
    finish(edit, tConnector('sqlUpdatedUseUndoToRestoreIt'));
  }
  async function transform(kind: 'format' | 'compress') {
    if (!snapshot || busy) return;
    const range = snapshot.state.selection.main,
      from = range.empty ? 0 : range.from,
      to = range.empty ? snapshot.state.doc.length : range.to;
    const original = snapshot.state.sliceDoc(from, to);
    setBusy(true);
    setError('');
    try {
      const result =
        kind === 'format'
          ? await (onFormatSql
              ? onFormatSql(original)
              : formatSqlText(original, provider, undefined))
          : compressSqlText(original, provider, locale);
      if (result === original) {
        close();
        onNotice(tConnector('sqlTextAlreadyFollowsTheCurrentRules'));
        return;
      }
      if (
        !applySqlAction(() => editorRef.current, snapshot, {
          changes: { from, to, insert: result },
          anchor: from,
          head: from + result.length,
        })
      )
        throw connectorUiMessages.error('editorContentChangedReopenQuickActions');
      close();
      onNotice(kind === 'format' ? tConnector('sqlFormatted') : tConnector('sqlMinified'));
    } catch (reason) {
      setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!snapshot) return;
    const range = snapshot.state.selection.main;
    try {
      await navigator.clipboard.writeText(
        snapshot.state.sliceDoc(
          range.empty ? 0 : range.from,
          range.empty ? snapshot.state.doc.length : range.to,
        ),
      );
      setCopied(true);
      setError('');
      onNotice(tConnector('sqlCopied'));
    } catch {
      setError(connectorUiMessages.message('copyFailedSelectTheSqlAndCopyItManually'));
    }
  }
  async function readClipboard() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setInSource(await navigator.clipboard.readText());
    } catch {
      setError(connectorUiMessages.message('unableToReadTheClipboardPasteTheListBelow'));
    } finally {
      setBusy(false);
    }
  }
  function runIntention(action: IntentionAction) {
    if (action.kind === 'expand_wildcard') {
      setWildcard(true);
      return;
    }
    finish(
      intentionActionEdit(action),
      action.kind === 'batch_qualify_identifiers'
        ? tConnector('qualifiedColumnsUndoRestoresAllChangesAtOnce', {
            p0: String(action.replacements?.length ?? 0),
          })
        : tConnector('columnReferencesUpdated'),
    );
  }
  async function expand() {
    if (!snapshot) return;
    const values = Object.fromEntries(
      Object.entries(fields).map(([id, source]) => [
        id,
        source
          .split(/\r?\n/)
          .map((name) => name.trim())
          .filter(Boolean),
      ]),
    );
    setBusy(true);
    try {
      const edit = await sqlWildcardEdit(snapshot, provider, values);
      if (!edit) {
        setError(connectorUiMessages.message('enterTheActualColumnsForEachTableOneNamePer'));
        return;
      }
      finish(edit, tConnector('wildcardExpandedToTheSpecifiedColumns'));
    } catch (reason) {
      setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      setBusy(false);
    }
  }
  const locked = busy || disabled;
  const range = snapshot?.state.selection.main;
  const preview =
    tab === 'in' && inPreview?.result.ok
      ? inPreview.result.sql
      : tab === 'table'
        ? tableSql
        : (snapshot?.state.sliceDoc(
            range?.empty ? 0 : range!.from,
            range?.empty ? snapshot.state.doc.length : range!.to,
          ) ?? '');
  return (
    <>
      <button
        type="button"
        className="fouc-action"
        disabled={disabled}
        aria-label={tConnector('sqlQuickActions')}
        title={tConnector('sqlQuickActions')}
        onClick={open}
      >
        <ClipboardText size={14} />
        <span>{tConnector('quickActions')}</span>
      </button>
      {snapshot && (
        <SqlDialog
          title={tConnector('sqlQuickActions')}
          busy={busy}
          className={styles.dialog}
          onClose={close}
        >
          <div className={styles.intro}>
            <span className={styles.icon}>
              <ClipboardText size={21} />
            </span>
            <div>
              <strong>{tConnector('makeEditingEasier')}</strong>
              <p>
                {range?.empty
                  ? tConnector('cursorAndFullDocument')
                  : tConnector('charactersSelected', { p0: String(range!.to - range!.from) })}{' '}
                ·{' '}
                {provider === 'postgres' ? 'PostgreSQL' : provider === 'mysql' ? 'MySQL' : 'SQLite'}
              </p>
            </div>
          </div>
          <nav
            className={styles.tabs}
            role="tablist"
            aria-label={tConnector('sqlQuickActionCategories')}
          >
            {(
              [
                { key: 'context', label: tConnector('cursorIntent'), Icon: ClipboardText },
                { key: 'text', label: tConnector('textEditing'), Icon: TextAa },
                { key: 'in', label: tConnector('inList'), Icon: Clipboard },
                { key: 'table', label: tConnector('tableQuery'), Icon: Table },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => {
                  setTab(key);
                  setError('');
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </nav>
          <div className={styles.body}>
            {tab === 'context' && (
              <section>
                <div className={styles.sectionHeading}>
                  <ClipboardText size={15} />
                  <strong>{tConnector('editingIntentForCurrentSql')}</strong>
                </div>
                {intentions.length ? (
                  <div className={styles.intentions}>
                    {intentions.map((action, index) => (
                      <button
                        key={index}
                        type="button"
                        disabled={locked}
                        onClick={() => runIntention(action)}
                      >
                        <Columns size={15} />
                        <span>
                          {action.kind === 'expand_wildcard'
                            ? tConnector('expandToColumns')
                            : action.kind === 'batch_qualify_identifiers'
                              ? tConnector('qualifySelectedColumns', {
                                  p0: String(action.replacements?.length ?? 0),
                                })
                              : action.kind === 'unqualify_identifier'
                                ? tConnector('removeTableQualifiers')
                                : tConnector('qualifyWith', {
                                    p0: String(action.label ?? action.replacement),
                                  })}
                        </span>
                        <code>
                          {action.kind === 'expand_wildcard'
                            ? tConnector('explicitColumnList')
                            : action.replacement ||
                              tConnector('preserveQualifiedColumnsAndStrings')}
                        </code>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={styles.empty}>
                    <ClipboardText size={24} />
                    <strong>{tConnector('noColumnActionsAvailableAtThisPosition')}</strong>
                    <p>{tConnector('placeTheCursorOnAColumnOrSelectSelectMultiple')}</p>
                  </div>
                )}
                {wildcard && (
                  <div className={styles.fieldForm}>
                    <div className={styles.sectionHeading}>
                      <Columns size={15} />
                      <strong>{tConnector('confirmColumnsToExpand')}</strong>
                    </div>
                    {sources.map((source) => (
                      <label key={source.id}>
                        {source.label}
                        <small>
                          {source.fields.length
                            ? tConnector('knownProjectionsFromTheCurrentSqlEditable')
                            : tConnector('enterActualColumnsOneNamePerLine')}
                        </small>
                        <textarea
                          aria-label={tConnector('expansionColumns', { p0: String(source.label) })}
                          value={fields[source.id] ?? ''}
                          disabled={locked}
                          onChange={(event) =>
                            setFields((current) => ({
                              ...current,
                              [source.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      className={common.primary}
                      disabled={locked || sources.some((source) => !fields[source.id]?.trim())}
                      onClick={() => void expand()}
                    >
                      {tConnector('replaceWildcard')}
                    </button>
                  </div>
                )}
                <div className={styles.utilityActions}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      finish(
                        sqlLineCommentEdit(snapshot),
                        translateConnector('lineCommentsToggled'),
                      )
                    }
                  >
                    {tConnector('toggleLineComments')}
                  </button>
                  <button
                    type="button"
                    disabled={locked || range?.empty}
                    onClick={() => {
                      const edit = sqlBlockCommentEdit(snapshot, provider);
                      if (edit) finish(edit, translateConnector('blockCommentsToggled'));
                      else
                        setError(
                          connectorUiMessages.message(
                            'selectTextWithoutABlockCommentClosingDelimiter',
                          ),
                        );
                    }}
                  >
                    {tConnector('toggleBlockComments')}
                  </button>
                </div>
              </section>
            )}
            {tab === 'text' && (
              <>
                <div className={styles.sectionHeading}>
                  <TextAa size={15} />
                  <strong>{tConnector('selectionActions')}</strong>
                </div>
                <div className={styles.actionGrid}>
                  {textActions(locale).map((entry) => (
                    <button
                      type="button"
                      key={entry.id}
                      disabled={locked || (range?.empty && entry.id !== 'quote-string')}
                      onClick={() => apply(entry.id)}
                    >
                      <span>{entry.label}</span>
                      <small>{entry.note}</small>
                    </button>
                  ))}
                </div>
                <div className={styles.sectionHeading}>
                  <CodeBlock size={15} />
                  <strong>{tConnector('sqlText')}</strong>
                </div>
                <div className={styles.utilityActions}>
                  <button type="button" disabled={locked} onClick={() => void transform('format')}>
                    <BracketsCurly size={14} />
                    {tConnector('formatting')}
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => void transform('compress')}
                  >
                    <ArrowSquareOut size={14} />
                    {tConnector('minify')}
                  </button>
                  <button type="button" disabled={locked} onClick={() => void copy()}>
                    {copied ? <Check size={14} /> : <Clipboard size={14} />}
                    {copied ? tConnector('copied') : tConnector('copySql')}
                  </button>
                </div>
              </>
            )}
            {tab === 'in' && (
              <div className={styles.fieldForm}>
                <div className={styles.sectionHeading}>
                  <Clipboard size={15} />
                  <strong>{tConnector('convertAListToAnInCondition')}</strong>
                  <button
                    type="button"
                    disabled={locked}
                    className={styles.textButton}
                    onClick={() => void readClipboard()}
                  >
                    {tConnector('readClipboard')}
                  </button>
                </div>
                <label>
                  {tConnector('listContent')}
                  <textarea
                    aria-label={tConnector('inListSourceContent')}
                    value={inSource}
                    disabled={locked}
                    spellCheck={false}
                    placeholder={"Alpha\nBeta\nO'Reilly"}
                    onChange={(event) => setInSource(event.target.value)}
                  />
                </label>
                <p>{tConnector('supportsNewlinesCommasTabsAndSimpleSlashSeparatedListsStrings')}</p>
                {inSource && inPreview && !inPreview.result.ok && (
                  <p className={styles.error} role="alert">
                    {sqlInListIssue(inPreview.result, locale)}
                  </p>
                )}
                <button
                  type="button"
                  className={common.primary}
                  disabled={locked || !inPreview?.edit}
                  onClick={() => {
                    if (inPreview?.edit)
                      finish(
                        inPreview.edit,
                        translateConnector('insertedListValues', {
                          p0: String(inPreview.result.ok ? inPreview.result.valueCount : 0),
                        }),
                      );
                  }}
                >
                  {tConnector('insertInCondition')}
                </button>
              </div>
            )}
            {tab === 'table' && (
              <div className={styles.fieldForm}>
                <div className={styles.sectionHeading}>
                  <Table size={15} />
                  <strong>{tConnector('generateAQueryForTheCurrentTable')}</strong>
                </div>
                <div
                  className={styles.tableModes}
                  role="group"
                  aria-label={tConnector('tableQueryType')}
                >
                  {(
                    [
                      { kind: 'select', label: tConnector('firstNRows') },
                      { kind: 'count', label: tConnector('rowCount') },
                      { kind: 'projection', label: tConnector('columnProjection') },
                    ] as const
                  ).map(({ kind, label }) => (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={tableKind === kind}
                      onClick={() => setTableKind(kind)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className={styles.tableFields}>
                  <label>
                    {tConnector('tableName')}
                    <input
                      aria-label={tConnector('quickQueryTableName')}
                      value={tableName}
                      disabled={locked}
                      placeholder="schema.table"
                      onChange={(event) => setTableName(event.target.value)}
                    />
                  </label>
                  {tableKind !== 'count' && (
                    <label>
                      {tConnector('rowsToReturn')}
                      <input
                        aria-label={tConnector('quickQueryRowCount')}
                        value={limit}
                        disabled={locked}
                        inputMode="numeric"
                        onChange={(event) => setLimit(event.target.value)}
                      />
                    </label>
                  )}
                </div>
                {tableKind === 'projection' && (
                  <label>
                    {tConnector('columnsOrSqlExpressions')}
                    <textarea
                      aria-label={tConnector('quickQueryColumnProjection')}
                      value={projection}
                      disabled={locked}
                      onChange={(event) => setProjection(event.target.value)}
                    />
                  </label>
                )}
                {tableIssue && (
                  <p className={styles.error} role="alert">
                    {tableIssue}
                  </p>
                )}
                <p>{tConnector('theGeneratedQueryIsAppendedToTheDocumentPreservingThe')}</p>
                <button
                  type="button"
                  className={common.primary}
                  disabled={
                    locked ||
                    Boolean(tableIssue) ||
                    (tableKind === 'projection' && !projection.trim())
                  }
                  onClick={() =>
                    finish(
                      sqlTableShortcutEdit(snapshot, tableSql),
                      translateConnector('tableQueryAddedToTheSqlDocument'),
                    )
                  }
                >
                  {tConnector('addQueryToDocument')}
                </button>
              </div>
            )}
            <div className={styles.preview}>
              <SqlEditor
                value={preview}
                onChange={() => {}}
                onRun={() => {}}
                editorRef={previewEditor}
                provider={provider}
                readOnly
                label={tConnector('quickActionSqlPreview')}
              />
            </div>
            {error && (
              <p className={styles.error} role="alert">
                <WarningCircle size={14} />
                {error}
              </p>
            )}
          </div>
          <footer className={`${common.dialogFooter} ${styles.footer}`}>
            <small>{tConnector('actionsOnlyChangeEditorContentUndoRestoresChangesAtOnce')}</small>
            <button type="button" className={common.secondary} disabled={busy} onClick={close}>
              {tConnector('close')}
            </button>
          </footer>
        </SqlDialog>
      )}
    </>
  );
}
