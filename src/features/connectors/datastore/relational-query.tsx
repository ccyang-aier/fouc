'use client';
import { createUiMessages, uiText } from '../i18n/ui-message';
import { useTranslation, createTranslator, getLocale } from '@/lib/i18n';
import { messages as connectorMessages } from './relational-query.messages';
const translateConnector = createTranslator(connectorMessages);
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useAppAlert } from '@/components/app-alert-provider';
import type { CompletionContext } from '@codemirror/autocomplete';
import { closeCompletion, startCompletion } from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import { isolateHistory } from '@codemirror/commands';
import { Transaction } from '@codemirror/state';
import {
  FloppyDisk,
  CheckCircle,
  CircleNotch,
  Database,
  Lock,
  WarningCircle,
  ArrowsClockwise,
  TextAlignLeft,
  ArrowsInSimple,
  SquareSplitHorizontal,
} from '@phosphor-icons/react';
import {
  inspectSqlTemplate,
  resolveSqlExecutionTarget,
  type SqlEditorPreferences,
  type SqlExecutionMode,
  type SqlStatementRange,
  type SqlParameterDescriptor,
  type RelationalSession,
  type SavedSqlDocument,
  type SavedSqlLibrary,
  type SqlDraftState,
  type SqlDraftTab,
  type SqlHistoryEntry,
} from '@fouc/shared';
import { SqlEditor, type SqlEditorCache } from './sql-editor';
import { SqlExecutionResults } from './sql-execution-results';
import { useSqlExecutions } from './use-sql-executions';
import { useResultPins } from './sql-result-history/use-result-pins';
import { ResultPins } from './sql-result-history/result-pins';
import { scopedResultPins } from './sql-result-history/model';
import {
  SqlParameterDialog,
  rememberSqlParameters,
  type SqlParameterRecents,
} from './sql-parameter-dialog';
import { SqlEditorSplit } from './sql-editor-split';
import { SqlQueryToolbar } from './sql-query-toolbar';
import { SqlEditorActions } from './sql-editor-actions';
import { sqlResultLabel } from './sql-result-label';
import { SqlFileActions } from './sql-file-actions';
import { SqlQuickActions } from './sql-quick-actions';
import { SqlExplainAction } from './sql-explain-action';
import { SqlMutationAction } from './sql-mutation-action';
import { useSqlQueryComparison } from './data-compare/query-action';
import type { OpenSqlFile } from './sql-files';
import { SQL_DRAFT_MAX_BYTES } from '@fouc/shared';
import { sqlVariableContext } from '@fouc/shared';
import { SqlEditorPreferencesDialog } from './sql-editor-preferences-dialog';
import { transformSqlEditor } from './sql-editor-transform';
import { compressSqlText, formatSqlForEditing } from './sql-format/formatter';
import { detectAndFormatStructured } from './sql-format/structured';
import { formatSqlSnapshotForSave } from './sql-format/format-on-save';
import { SqlHistoryPanel } from './sql-history-panel';
import { SqlLibraryPanel } from './sql-library-panel';
import { SaveSqlDialog, SqlDialog } from './sql-library-dialog';
import { useSqlResource } from './use-sql-resource';
import type { SqlDraftController, SqlDraftWorkspace } from './sql-draft-controller';
import { useSqlOpenRequest, type SqlOpenRequest } from './use-sql-open-request';
import { useSqlMetadata } from './use-sql-metadata';
import { mergeSqlJoinCompletion } from './sql-assistance/join/completion';
import { SqlTabStrip, type SqlTabAction } from './sql-tab-strip';
import {
  closeSqlTabs,
  mergeSqlDrafts,
  navigateSqlTabs,
  newSqlTab,
  nextSqlQueryTitle,
  pinSqlTab,
  reorderSqlTab,
  sqlTabDirty,
  sqlTabSaveable,
  visitSqlTab,
  type SqlTabVisits,
} from './sql-tabs';
import common from './relational.module.css';
import styles from './sql-library.module.css';
import tabsStyle from './sql-tabs.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
type Restore = {
  sql: string;
  schema: string | null;
  database: string;
  file: SavedSqlDocument | null;
};
type Saving = {
  tabId: string | null;
  sql: string;
  schema: string | null;
  database: string;
  file: SqlDraftTab['savedFile'];
};
function binding(file: SavedSqlDocument): NonNullable<SqlDraftTab['savedFile']> {
  return { id: file.id, version: file.version, name: file.name, folderId: file.folderId };
}
export function RelationalQuery({
  drafts,
  session,
  schema,
  schemas,
  metadataRevision,
  schemaLocked,
  onSchemaChange,
  beforeLeaveRef,
  onLeaveReady,
  openRequest,
  onOpenRequestConsumed,
  onUnlockWrite,
  onMutated,
  onMutationBusy,
  tabsTarget,
  active,
  tabsDisabled,
  onActivate,
  onNoQueries,
}: {
  drafts: {
    state: SqlDraftWorkspace;
    controller: SqlDraftController;
  };
  session: RelationalSession;
  schema: string;
  schemas: string[];
  metadataRevision: number;
  schemaLocked: boolean;
  onSchemaChange: (schema: string) => void;
  beforeLeaveRef: RefObject<(() => Promise<void>) | null>;
  onLeaveReady: () => void;
  openRequest?: SqlOpenRequest | null;
  onOpenRequestConsumed: (id: string) => void;
  onUnlockWrite: () => Promise<void>;
  onMutated: () => void;
  onMutationBusy: (busy: boolean) => void;
  tabsTarget: HTMLElement | null;
  active: boolean;
  tabsDisabled: boolean;
  onActivate: () => void;
  onNoQueries: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const root = `/api/database/relational`;
  const { notify } = useAppAlert();
  const setNotice = useCallback(
    (message: string) => {
      if (message) notify('info', message);
    },
    [notify],
  );
  const base = `${root}/sessions/${session.id}`,
    libraryBase = session.connectionId
      ? `${root}/connections/${session.connectionId}/sql-library`
      : null;
  const { state, controller } = drafts;
  useSqlOpenRequest({
    controller,
    state,
    active,
    request: openRequest,
    provider: session.provider,
    database: session.database,
    schema,
    onConsumed: onOpenRequestConsumed,
  });
  const current = state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
  const [panel, setPanel] = useState<'history' | 'library' | null>(null),
    [revision, setRevision] = useState(0);
  const {
    executions,
    locks,
    run: execute,
    cancel,
    forget,
    selectResult,
  } = useSqlExecutions(base, () => setRevision((value) => value + 1));
  const resultPins = useResultPins();
  const [executionMode, setExecutionMode] = useState<SqlExecutionMode>('current');
  const [wrapLines, setWrapLines] = useState(false),
    [resultsVisible, setResultsVisible] = useState(true),
    [diagnostics, setDiagnostics] = useState(true);
  const mutationAction = useRef<{
    open: () => void;
  } | null>(null);
  const [autoQueryId, setAutoQueryId] = useState<string | null>(null);
  const [resultExplainTarget, setResultExplainTarget] = useState<HTMLDivElement | null>(null);
  const autoRunner = useRef<() => void>(() => undefined);
  const [parameterRequest, setParameterRequest] = useState<{
    tabId: string;
    title: string;
    target: SqlStatementRange;
    schema: string | null;
    declarationSql: string;
    descriptors: SqlParameterDescriptor[];
  } | null>(null);
  const parameterHistories = useRef(new Map<string, SqlParameterRecents>());
  const [saving, setSaving] = useState<Saving | null>(null),
    [restore, setRestore] = useState<{
      target: Restore;
      tabId: string | null;
    } | null>(null);
  const [closing, setClosing] = useState<SqlDraftTab[] | null>(null),
    [closed, setClosed] = useState<SqlDraftTab[]>([]);
  const [renaming, setRenaming] = useState<SqlDraftTab | null>(null),
    [title, setTitle] = useState('');
  const [visits, setVisits] = useState<SqlTabVisits>({ entries: [], index: -1 });
  const [remote, setRemote] = useState<SqlDraftState | null>(null),
    [inspectBusy, setInspectBusy] = useState(false);
  const [editorSettingsOpen, setEditorSettingsOpen] = useState(false),
    [preferencesRevision, setPreferencesRevision] = useState(0);
  const [formatting, setFormatting] = useState(false);
  const editor = useRef<EditorView | null>(null);
  const editorCache = useRef<SqlEditorCache>(new Map());
  const library = useSqlResource<SavedSqlLibrary>(libraryBase, undefined, revision);
  const preferencesBase = libraryBase ?? base;
  const preferences = useSqlResource<SqlEditorPreferences>(
    `${preferencesBase}/preferences`,
    undefined,
    preferencesRevision,
  );
  const busyIds = new Set(Object.keys(executions).filter((id) => executions[id].running));
  const execution = current ? executions[current.id] : undefined;
  const pinScope = { connectionId: session.connectionId ?? session.id, tabId: current?.id ?? '' };
  const selectedStatement = execution?.snapshot?.statements[execution.selectedResult];
  const currentResultId = execution?.snapshot
    ? `${execution.snapshot.id}:${execution.selectedResult}`
    : '';
  const currentResultLabel = selectedStatement
    ? sqlResultLabel(
        selectedStatement.sql,
        session.provider,
        execution?.snapshot?.schema ?? null,
        tConnector('result', { p0: String(execution!.selectedResult + 1) }),
      )
    : tConnector('queryResults');
  const currentResult =
    selectedStatement?.status === 'succeeded' && selectedStatement.result
      ? { id: currentResultId, result: selectedStatement.result, label: currentResultLabel }
      : null;
  const currentResultPinned = scopedResultPins(resultPins.pins, pinScope).some(
    (pin) => pin.sourceId === currentResultId,
  );
  const queryComparison = useSqlQueryComparison({
    tabs: state.tabs,
    executions,
    provider: session.provider,
    activeTabId: state.activeTabId,
    onNotice: setNotice,
    onSqlPreview: openComparisonReview,
  });
  const running = execution?.running ?? false;
  useEffect(() => {
    if (
      state.ready &&
      !state.pending &&
      state.status === 'ready' &&
      !Object.values(executions).some((item) => item.running)
    )
      onLeaveReady();
  }, [state.ready, state.pending, state.status, executions, onLeaveReady]);
  useEffect(() => {
    beforeLeaveRef.current = () => {
      if (locks.current.size)
        return Promise.reject(connectorUiMessages.error('aQueryIsStillRunningWaitForItToFinish'));
      return controller.flush();
    };
    return () => {
      beforeLeaveRef.current = null;
    };
  }, [beforeLeaveRef, controller, locks]);
  useEffect(() => {
    if (state.activeTabId) setVisits((value) => visitSqlTab(value, state.activeTabId!));
  }, [state.activeTabId]);
  useEffect(() => {
    if (!state.ready || !schemas.length) return;
    const fallback = schemas.includes('public') ? 'public' : schemas[0];
    if (state.tabs.some((tab) => tab.schema === null))
      controller.update((snapshot) => ({
        ...snapshot,
        tabs: snapshot.tabs.map((tab) =>
          tab.schema === null
            ? { ...tab, schema: session.provider === 'mysql' ? tab.database : fallback }
            : tab,
        ),
      }));
  }, [state.ready, state.tabs, schemas, controller, session.provider]);
  function updateTab(id: string, update: Partial<SqlDraftTab>) {
    controller.update((snapshot) => ({
      ...snapshot,
      tabs: snapshot.tabs.map((tab) => (tab.id === id ? { ...tab, ...update } : tab)),
    }));
  }
  function targetIssue(target: Pick<Restore, 'database' | 'schema'>): string {
    const targetSchema = session.provider === 'mysql' ? target.database : (target.schema ?? schema);
    if (session.provider !== 'mysql' && target.database !== session.database)
      return tConnector('theSavedTargetDatabaseDiffersFromTheCurrentConnectionConnect');
    if (targetSchema && !schemas.includes(targetSchema))
      return tConnector('targetSchemaIsUnavailableCheckTheConnectionAndPermissionsThen', {
        p0: String(targetSchema),
      });
    if (schemaLocked && targetSchema !== schema)
      return tConnector('theTableHasPendingChangesCommitOrDiscardThemBefore');
    return '';
  }
  function select(id: string) {
    const tab = controller.getSnapshot().tabs.find((item) => item.id === id);
    if (tab) controller.update((snapshot) => ({ ...snapshot, activeTabId: id }));
  }
  function add() {
    const tab = newSqlTab(
      session.provider === 'mysql' ? schema || session.database : session.database,
      schema || null,
      nextSqlQueryTitle(state.tabs, locale),
      undefined,
      locale,
    );
    controller.update((snapshot) => ({ tabs: [...snapshot.tabs, tab], activeTabId: tab.id }));
    setPanel(null);
  }
  function openSqlFiles(files: Pick<OpenSqlFile, 'name' | 'sql'>[]) {
    const snapshot = controller.getSnapshot();
    const imported = files.map((file) => ({
      ...newSqlTab(
        session.provider === 'mysql' ? schema || session.database : session.database,
        schema || null,
        [...file.name].slice(0, 180).join(''),
        undefined,
        locale,
      ),
      sql: file.sql,
      originalSql: '',
      customTitle: true,
    }));
    const next = {
      tabs: [...snapshot.tabs, ...imported],
      activeTabId: imported.at(-1)?.id ?? snapshot.activeTabId,
    };
    if (new TextEncoder().encode(JSON.stringify(next)).byteLength > SQL_DRAFT_MAX_BYTES)
      throw connectorUiMessages.error('fullSqlDraftsSupportUpToMibSaveOrClose');
    controller.edit(next);
    setPanel(null);
    setNotice(tConnector('openedSqlFilesWithTheirCompleteContents', { p0: String(files.length) }));
  }
  function openComparisonReview(sql: string) {
    try {
      openSqlFiles([{ name: tConnector('comparisonFilename'), sql }]);
      setNotice(tConnector('changeSuggestionsWerePlacedInANewQueryTabFor'));
    } catch (reason) {
      setNotice(reason instanceof Error ? uiText(reason, locale) : String(reason));
    }
  }
  async function formatText(sql: string): Promise<string> {
    const settings = preferences.data?.formatter;
    if (!settings || preferences.busy || preferences.error)
      throw connectorUiMessages.error('editorSettingsHaveNotLoadedRetryLoadingThemFirst');
    const structured = detectAndFormatStructured(sql, {
      indentSize: settings.tabWidth,
      useTabs: settings.useTabs,
    });
    if (structured.kind === 'unsupported')
      throw connectorUiMessages.error('xmlContentIsIncompleteTheOriginalTextWasRetained');
    return structured.kind === 'sql'
      ? formatSqlForEditing(sql, session.provider, settings)
      : structured.formatted;
  }
  async function transformCurrent(compress = false) {
    if (!current || formatting || running) return;
    setFormatting(true);
    try {
      const result = await transformSqlEditor(
        () => editor.current,
        compress ? (sql) => compressSqlText(sql, session.provider, locale) : formatText,
      );
      setNotice(
        result === 'stale'
          ? tConnector('contentChangedWhileFormattingThisFormattingWasNotApplied')
          : result === 'unchanged'
            ? tConnector('contentUnchangedItAlreadyMatchesTheSettingsOrIsNot')
            : compress
              ? tConnector('minifiedTheSelectionOrFullSqlUndoToRestore')
              : tConnector('formattedTheSelectionOrFullDocumentUndoToRestore'),
      );
    } catch (reason) {
      setNotice(reason instanceof Error ? uiText(reason, locale) : String(reason));
    } finally {
      setFormatting(false);
    }
  }
  async function saveCurrent() {
    if (
      !current ||
      running ||
      formatting ||
      !libraryBase ||
      library.busy ||
      !sqlTabSaveable(current)
    )
      return;
    if (preferences.busy || preferences.error || !preferences.data) {
      setNotice(tConnector('editorSettingsHaveNotLoadedRetryLoadingThemFirst'));
      return;
    }
    const tabId = current.id,
      view = editor.current;
    let sql = view?.state.doc.toString() ?? current.sql;
    if (preferences.data.formatOnSave) {
      setFormatting(true);
      try {
        sql = await formatSqlSnapshotForSave(
          sql,
          () =>
            editor.current === view && controller.getSnapshot().activeTabId === tabId
              ? (view?.state.doc.toString() ?? '')
              : '',
          formatText,
          (formatted) => {
            if (view)
              view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: formatted },
                selection: { anchor: Math.min(view.state.selection.main.head, formatted.length) },
                annotations: [Transaction.userEvent.of('input.format'), isolateHistory.of('full')],
              });
          },
        );
      } catch (reason) {
        setNotice(reason instanceof Error ? uiText(reason, locale) : String(reason));
        return;
      } finally {
        setFormatting(false);
      }
    }
    const tab = controller.getSnapshot().tabs.find((item) => item.id === tabId);
    if (
      !tab ||
      controller.getSnapshot().activeTabId !== tabId ||
      editor.current !== view ||
      locks.current.has(tabId) ||
      tab.database !== current.database ||
      tab.schema !== current.schema
    ) {
      setNotice(tConnector('theEditTargetChangedSaveAgain'));
      return;
    }
    setSaving({
      tabId,
      sql,
      schema: tab.schema ?? (schema || null),
      database: tab.database,
      file: tab.savedFile,
    });
  }
  function apply(target: Restore, tabId: string | null) {
    if (targetIssue(target)) return;
    const nextSchema = session.provider === 'mysql' ? target.database : (target.schema ?? schema);
    if (nextSchema && nextSchema !== schema) onSchemaChange(nextSchema);
    const existing = controller.getSnapshot().tabs.find((tab) => tab.id === tabId);
    const tab = {
      ...(existing ?? newSqlTab(target.database, target.schema, undefined, undefined, locale)),
      sql: target.sql,
      originalSql: target.sql,
      database: target.database,
      schema: target.schema ?? (schema || null),
      savedFile: target.file ? binding(target.file) : null,
      title: target.file
        ? existing?.customTitle
          ? existing.title
          : target.file.name
        : (existing?.title ?? tConnector('restoredQuery')),
    };
    controller.update((snapshot) => ({
      tabs: existing
        ? snapshot.tabs.map((item) => (item.id === tab.id ? tab : item))
        : [...snapshot.tabs, tab],
      activeTabId: tab.id,
    }));
    forget([tab.id]);
    setRestore(null);
    setPanel(null);
    setNotice(tConnector('sqlAndTargetContextRestoredExecutionStartsOnlyWhenRun'));
  }
  function requestRestore(target: Restore, tabId: string | null) {
    const tab = controller.getSnapshot().tabs.find((item) => item.id === tabId);
    if (tab && locks.current.has(tab.id)) return;
    if (targetIssue(target) || (tab && sqlTabDirty(tab) && tab.sql !== target.sql))
      setRestore({ target, tabId });
    else apply(target, tabId);
  }
  function openFile(file: SavedSqlDocument) {
    const existing = controller.getSnapshot().tabs.find((tab) => tab.savedFile?.id === file.id);
    if (existing && existing.originalSql === file.sql && !targetIssue(file)) {
      if (locks.current.has(existing.id)) {
        select(existing.id);
        setPanel(null);
        setNotice(tConnector('theQueryIsRunningReopenTheFileAfterItFinishes'));
        return;
      }
      const nextSchema = session.provider === 'mysql' ? file.database : (file.schema ?? schema);
      updateTab(existing.id, {
        savedFile: binding(file),
        title: existing.customTitle ? existing.title : file.name,
        database: file.database,
        schema: file.schema ?? (schema || null),
      });
      if (nextSchema && nextSchema !== schema) onSchemaChange(nextSchema);
      select(existing.id);
      setPanel(null);
      return;
    }
    requestRestore(
      { sql: file.sql, schema: file.schema, database: file.database, file },
      existing?.id ?? null,
    );
  }
  function historyRestore(entry: SqlHistoryEntry) {
    requestRestore(
      { sql: entry.sql, schema: entry.schema, database: entry.database, file: null },
      current?.id ?? null,
    );
  }
  function toggleAutoRefresh() {
    if (!current) return;
    if (autoQueryId === current.id) {
      setAutoQueryId(null);
      return;
    }
    try {
      const sql = selectedStatement?.sql ?? current.sql;
      if (inspectSqlTemplate(sql, session.provider).descriptors.length) {
        notify('info', tConnector('refreshParameterizedQueriesManually'));
        return;
      }
      setAutoQueryId(current.id);
    } catch (reason) {
      notify(
        'error',
        reason instanceof Error
          ? uiText(reason, locale)
          : tConnector('couldNotEnableAutomaticRefresh'),
      );
    }
  }
  async function run(mode: SqlExecutionMode = executionMode) {
    if (!current || locks.current.has(current.id)) return;
    const issue = targetIssue(current);
    if (issue) {
      setNotice(issue);
      return;
    }
    const view = editor.current,
      selection = view?.state.selection.main ?? { from: 0, to: 0, head: 0 };
    const document = view?.state.doc.toString() ?? current.sql;
    const target = resolveSqlExecutionTarget(document, session.provider, mode, selection);
    if (!target) {
      setNotice(
        mode === 'current'
          ? tConnector('noExecutableStatementAtTheCursorMoveIntoSqlOr')
          : tConnector('noExecutableSql'),
      );
      return;
    }
    const declarationSql = sqlVariableContext(document.slice(0, target.to), session.provider);
    let inspected;
    try {
      inspected = inspectSqlTemplate(target.sql, session.provider, declarationSql);
    } catch (reason) {
      setNotice(reason instanceof Error ? uiText(reason, locale) : String(reason));
      return;
    }
    const targetSchema =
      session.provider === 'mysql' ? current.database : (current.schema ?? (schema || null));
    if (!inspected.source.sql.trim()) {
      setNotice(tConnector('onlyVariableDefinitionsArePresentMoveTheCursorToA'));
      return;
    }
    if (inspected.descriptors.length > 128) {
      setNotice(tConnector('parameterEntrySupportsUpToParametersPerRunExecuteIn'));
      return;
    }
    setNotice('');
    if (inspected.descriptors.length) {
      if (!parameterHistories.current.has(current.id))
        parameterHistories.current.set(current.id, new Map());
      setParameterRequest({
        tabId: current.id,
        title: current.title,
        target,
        schema: targetSchema,
        declarationSql,
        descriptors: inspected.descriptors,
      });
    } else await execute(current.id, target, targetSchema, { declarationSql });
  }
  useEffect(() => {
    autoRunner.current = () => {
      const view = editor.current;
      if (
        document.visibilityState !== 'visible' ||
        !current ||
        running ||
        !view ||
        selectedStatement?.status !== 'succeeded' ||
        view.state.sliceDoc(selectedStatement.from, selectedStatement.to) !== selectedStatement.sql
      )
        return;
      try {
        if (inspectSqlTemplate(selectedStatement.sql, session.provider).descriptors.length) return;
      } catch {
        return;
      }
      void run();
    };
  });
  useEffect(() => {
    if (!autoQueryId || autoQueryId !== current?.id || !active || !resultsVisible) return;
    const timer = setInterval(() => autoRunner.current(), 15000);
    return () => clearInterval(timer);
  }, [autoQueryId, current?.id, active, resultsVisible]);
  function finishClose(tabs: SqlDraftTab[]) {
    const ids = tabs.map((tab) => tab.id);
    if (ids.some((id) => locks.current.has(id))) {
      setNotice(tConnector('runningQueriesCannotBeClosedWaitForExecutionToFinish'));
      return;
    }
    setClosed((previous) => {
      const next = [...previous, ...tabs].slice(-20),
        retained = new Set(
          [...controller.getSnapshot().tabs.filter((tab) => !ids.includes(tab.id)), ...next].map(
            (tab) => tab.id,
          ),
        );
      for (const key of editorCache.current.keys())
        if (!retained.has(key)) editorCache.current.delete(key);
      return next;
    });
    const closesAll = controller.getSnapshot().tabs.every((tab) => ids.includes(tab.id));
    controller.update((snapshot) => closeSqlTabs(snapshot, ids));
    setClosing(null);
    if (closesAll) onNoQueries();
    forget(ids);
    resultPins.forgetTabs(ids);
    for (const id of ids) parameterHistories.current.delete(id);
  }
  function action(action: SqlTabAction, tab: SqlDraftTab | null) {
    const snapshot = controller.getSnapshot();
    if (action === 'reopen') {
      const item = closed.at(-1);
      if (!item) return;
      controller.update((value) => ({
        tabs: value.tabs.some((tab) => tab.id === item.id)
          ? value.tabs
          : [...value.tabs, item].sort((a, b) => Number(b.pinned) - Number(a.pinned)),
        activeTabId: item.id,
      }));
      setClosed((value) => value.slice(0, -1));
      return;
    }
    if (tab && action === 'pin') {
      controller.update((value) => pinSqlTab(value, tab.id));
      return;
    }
    if (tab && action === 'rename') {
      setRenaming(tab);
      setTitle(tab.title);
      return;
    }
    if (tab && action === 'duplicate') {
      const copy = {
        ...tab,
        id: crypto.randomUUID(),
        title: tConnector('copy', { p0: String(tab.title.slice(0, 190)) }),
        pinned: false,
        customTitle: true,
        savedFile: null,
        originalSql: '',
      };
      controller.update((value) => ({ tabs: [...value.tabs, copy], activeTabId: copy.id }));
      return;
    }
    const index = snapshot.tabs.findIndex((item) => item.id === tab?.id);
    const targets = snapshot.tabs.filter((item, position) =>
      action === 'close'
        ? item.id === tab?.id
        : !item.pinned &&
          (action === 'all' ||
            (action === 'others' && item.id !== tab?.id) ||
            (action === 'left' && position < index) ||
            (action === 'right' && position > index)),
    );
    if (targets.some((item) => locks.current.has(item.id))) {
      setNotice(tConnector('runningQueriesCannotBeClosedWaitForExecutionToFinish'));
      return;
    }
    if (targets.some(sqlTabDirty)) setClosing(targets);
    else finishClose(targets);
  }
  async function inspect() {
    setInspectBusy(true);
    try {
      setRemote(await controller.inspectRemote());
    } catch (reason) {
      setNotice(reason instanceof Error ? uiText(reason, locale) : String(reason));
    } finally {
      setInspectBusy(false);
    }
  }
  function adoptDeviceDrafts(merge: boolean) {
    if (!remote || locks.current.size) return;
    const snapshot = merge ? mergeSqlDrafts(remote, controller.getSnapshot(), locale) : null;
    controller.adoptRemote(remote);
    if (snapshot) controller.edit(snapshot);
    editorCache.current = new Map();
    forget(Object.keys(executions));
    setClosed([]);
    setRemote(null);
    if (snapshot) void controller.flush().catch(() => undefined);
  }
  const restoreError = restore ? targetIssue(restore.target) : '';
  const targetSchema = current
    ? session.provider === 'mysql'
      ? current.database
      : (current.schema ?? schema)
    : schema;
  const { metadata, join, state: metadataState } = useSqlMetadata(session, metadataRevision);
  const complete = useCallback(
    async (context: CompletionContext) => {
      const target = { schema: targetSchema, schemas };
      const [ordinary, related] = await Promise.all([
        metadata.complete(context, target),
        join.complete(context, target, preferences.data?.formatter.keywordCase),
      ]);
      return mergeSqlJoinCompletion(ordinary, related);
    },
    [metadata, join, targetSchema, schemas, preferences.data?.formatter.keywordCase],
  );
  function refreshMetadata() {
    metadata.clear();
    join.clear();
    if (editor.current) {
      closeCompletion(editor.current);
      startCompletion(editor.current);
    }
  }
  const displayDatabase =
    current && session.provider === 'sqlite'
      ? current.database.replace(/^.*[\\/]/, '')
      : current?.database;
  const draftMessage = !libraryBase
    ? tConnector('temporaryConnectionDraftsRetainedUntilLeaving')
    : state.status === 'error'
      ? state.ready
        ? tConnector('couldNotSaveDraftLocalContentRetained')
        : tConnector('couldNotLoadDraftClickToRetry')
      : !state.ready
        ? tConnector('restoringDeviceDrafts')
        : state.status === 'saving'
          ? tConnector('savingDrafts')
          : state.pending
            ? tConnector('draftAwaitingSave')
            : tConnector('draftSavedToTheDevice');
  const draftStatus = (
    <span
      className={tabsStyle.status}
      data-state={state.status}
      role="status"
      aria-label={draftMessage}
      title={draftMessage}
    >
      {state.status === 'error' ? (
        <WarningCircle size={14} />
      ) : !state.ready || state.status === 'saving' || state.pending ? (
        <CircleNotch size={14} className="mw-spin" />
      ) : (
        <CheckCircle size={14} />
      )}
      {draftMessage}
    </span>
  );
  return (
    <div className={styles.workspace}>
      {queryComparison.dialog}
      <SqlMutationAction
        key={`mutation:${base}:${current?.id}:${targetSchema}`}
        actionRef={mutationAction}
        showTrigger={false}
        base={base}
        session={session}
        schema={targetSchema}
        editorRef={editor}
        disabled={!current || busyIds.size > 0 || formatting || schemaLocked}
        contextIssue={current ? targetIssue(current) : ''}
        onNotice={setNotice}
        onUnlock={onUnlockWrite}
        onBusyChange={onMutationBusy}
        onCommitted={() => {
          onMutated();
          setNotice(
            translateConnector('sqlTransactionCommittedExistingResultsAreRetainedRerunToRead'),
          );
        }}
      />
      {editorSettingsOpen && preferences.data && (
        <SqlEditorPreferencesDialog
          base={preferencesBase}
          initial={preferences.data}
          provider={session.provider}
          onClose={() => {
            setEditorSettingsOpen(false);
            editor.current?.focus();
          }}
          onSaved={() => {
            setEditorSettingsOpen(false);
            setPreferencesRevision((value) => value + 1);
            setNotice(translateConnector('editorSettingsSavedAndSnippetCompletionUpdated'));
            editor.current?.focus();
          }}
        />
      )}
      {parameterRequest && (
        <SqlParameterDialog
          key={parameterRequest.tabId}
          sql={parameterRequest.target.sql}
          declarationSql={parameterRequest.declarationSql}
          provider={session.provider}
          descriptors={parameterRequest.descriptors}
          history={parameterHistories.current.get(parameterRequest.tabId)!}
          targetLabel={parameterRequest.title}
          onClose={() => {
            setParameterRequest(null);
            editor.current?.focus();
          }}
          onExecute={(parameters) => {
            rememberSqlParameters(
              parameterHistories.current.get(parameterRequest.tabId)!,
              parameters,
            );
            setParameterRequest(null);
            void execute(parameterRequest.tabId, parameterRequest.target, parameterRequest.schema, {
              parameters,
              declarationSql: parameterRequest.declarationSql,
            });
          }}
        />
      )}
      <div className={`${styles.query} mw-sql-workspace mw-live-sql`}>
        {state.ready &&
          tabsTarget &&
          createPortal(
            <SqlTabStrip
              snapshot={state}
              scope={libraryBase ?? base}
              busyIds={busyIds}
              active={active}
              disabled={tabsDisabled}
              mode={executionMode}
              onModeChange={setExecutionMode}
              canBack={Boolean(navigateSqlTabs(visits, -1, state))}
              canForward={Boolean(navigateSqlTabs(visits, 1, state))}
              canReopen={closed.length > 0}
              onSelect={(id) => {
                onActivate();
                select(id);
              }}
              onAction={action}
              onHistory={(id) => {
                onActivate();
                select(id);
                setPanel('history');
              }}
              onLibrary={(id) => {
                onActivate();
                select(id);
                setPanel('library');
              }}
              canLibrary={Boolean(libraryBase)}
              onCompare={queryComparison.open}
              canCompare={queryComparison.canCompare}
              onMutation={() => mutationAction.current?.open()}
              canMutate={Boolean(current) && busyIds.size === 0 && !formatting && !schemaLocked}
              onNavigate={(direction) => {
                const next = navigateSqlTabs(visits, direction, state);
                if (next) {
                  setVisits(next.visits);
                  select(next.id);
                }
              }}
              onReorder={(id, beforeId) =>
                controller.update((snapshot) => reorderSqlTab(snapshot, id, beforeId))
              }
            />,
            tabsTarget,
          )}
        <SqlQueryToolbar
          database={displayDatabase ?? session.database}
          status={
            <>
              <span
                aria-label={tConnector('readOnlyQuery')}
                title={tConnector('readOnlyQuerySelectionTakesPriority')}
              >
                <Lock size={14} aria-hidden />
              </span>
              {draftStatus}
            </>
          }
          running={running}
          cancelling={execution?.snapshot?.status === 'cancelling'}
          disabled={!current || !state.ready}
          mode={executionMode}
          onRun={(mode) => void run(mode)}
          onRunNewResult={() => {
            if (currentResult && selectedStatement && !currentResultPinned) {
              try {
                resultPins.pin({
                  scope: pinScope,
                  sourceId: currentResultId,
                  label: currentResultLabel,
                  sql: selectedStatement.sql,
                  result: currentResult.result,
                  context: {
                    database: execution!.snapshot!.database,
                    schema: execution!.snapshot!.schema,
                  },
                });
              } catch (reason) {
                notify(
                  'error',
                  reason instanceof Error
                    ? uiText(reason, getLocale())
                    : translateConnector('couldNotRetainResults'),
                );
                return;
              }
            }
            void run();
          }}
          onCancel={() => current && void cancel(current.id)}
          target={
            current && (
              <label className={tabsStyle.target}>
                <Database size={15} />
                <select
                  aria-label={tConnector('sqlTargetSchema')}
                  value={targetSchema}
                  disabled={running || schemaLocked}
                  onChange={(event) => {
                    const next = event.target.value;
                    updateTab(
                      current.id,
                      session.provider === 'mysql'
                        ? { database: next, schema: next }
                        : { schema: next },
                    );
                    if (next !== schema) onSchemaChange(next);
                  }}
                >
                  {targetSchema && !schemas.includes(targetSchema) && (
                    <option value={targetSchema}>
                      {targetSchema}
                      {tConnector('currentlyUnavailable')}
                    </option>
                  )}
                  {schemas.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  loading={metadataState.pending > 0}
                  aria-label={tConnector('refreshSqlMetadata')}
                  title={
                    metadataState.pending
                      ? tConnector('readingSqlMetadata')
                      : tConnector('refreshTableAndColumnCompletion')
                  }
                  onClick={refreshMetadata}
                >
                  <ArrowsClockwise size={15} />
                </Button>
              </label>
            )
          }
        >
          <SqlExplainAction
            key={`explain:${base}:${current?.id}:${targetSchema}`}
            base={base}
            provider={session.provider}
            schema={targetSchema || null}
            targetLabel={displayDatabase ?? session.database}
            editorRef={editor}
            disabled={!current || running || formatting}
            contextIssue={current ? targetIssue(current) : ''}
            onNotice={setNotice}
            resultTriggerTarget={resultExplainTarget}
          />
          <button
            type="button"
            className="fouc-action"
            aria-label={tConnector('sqlEditorSettings')}
            title={tConnector('formattingSavingAndSnippets')}
            disabled={preferences.busy || !preferences.data || Boolean(preferences.error)}
            onClick={() => setEditorSettingsOpen(true)}
          >
            <strong aria-hidden>A</strong>
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            loading={formatting}
            data-sql-tool="format"
            aria-label={tConnector('formatSql')}
            title={tConnector('formatSqlCtrlShiftFSelectionTakesPriority')}
            disabled={
              !current ||
              running ||
              preferences.busy ||
              !preferences.data ||
              Boolean(preferences.error)
            }
            onClick={() => void transformCurrent()}
          >
            <TextAlignLeft size={17} />
          </Button>
          <button
            type="button"
            className="fouc-action"
            data-sql-tool="format"
            aria-label={tConnector('minifySql')}
            title={tConnector('minifySelectedOrFullSqlPreservingLiteralsAndExecutionHints')}
            disabled={!current || running || formatting}
            onClick={() => void transformCurrent(true)}
          >
            <ArrowsInSimple />
          </button>
          <SqlEditorActions
            editorRef={editor}
            disabled={!current || running || formatting}
            wrapLines={wrapLines}
            onWrapChange={() => setWrapLines((value) => !value)}
            diagnostics={diagnostics}
            onDiagnosticsChange={() => setDiagnostics((value) => !value)}
          />
          <button
            type="button"
            className="fouc-action"
            data-sql-tool="pane"
            aria-label={tConnector('showQueryResults')}
            title={
              resultsVisible ? tConnector('collapseQueryResults') : tConnector('showQueryResults')
            }
            aria-pressed={resultsVisible}
            onClick={() => setResultsVisible((value) => !value)}
          >
            <SquareSplitHorizontal />
          </button>
          <button
            type="button"
            className="fouc-action"
            data-sql-tool="file"
            aria-label={tConnector('saveSql')}
            title={tConnector('saveSqlCtrlS')}
            disabled={
              !current ||
              running ||
              formatting ||
              preferences.busy ||
              !libraryBase ||
              library.busy ||
              !sqlTabSaveable(current)
            }
            onClick={() => void saveCurrent()}
          >
            <FloppyDisk />
          </button>
          <SqlFileActions
            provider={session.provider}
            disabled={!state.ready || running}
            getDocument={() =>
              current
                ? { sql: editor.current?.state.doc.toString() ?? current.sql, title: current.title }
                : null
            }
            onOpen={openSqlFiles}
            onNotice={setNotice}
          />
          <SqlQuickActions
            editorRef={editor}
            provider={session.provider}
            disabled={!current || running || formatting}
            keywordCase={preferences.data?.formatter.keywordCase}
            onFormatSql={formatText}
            onNotice={setNotice}
          />
        </SqlQueryToolbar>
        {state.error && (
          <p role="alert" className={styles.error}>
            {uiText(state.error, locale)}
            <button
              type="button"
              onClick={() =>
                void (state.ready ? controller.flush() : controller.load()).catch(() => undefined)
              }
            >
              {tConnector('retryDraftStorage')}
            </button>
            {state.ready && (
              <button type="button" disabled={inspectBusy} onClick={() => void inspect()}>
                {tConnector('viewDeviceVersion')}
              </button>
            )}
          </p>
        )}
        {preferences.error && (
          <p role="alert" className={styles.error}>
            {tConnector('couldNotReadEditorSettings')}
            {preferences.error}
            <button type="button" onClick={() => setPreferencesRevision((value) => value + 1)}>
              {tConnector('retryEditorSettings')}
            </button>
          </p>
        )}
        {metadataState.error && (
          <p role="alert" className={styles.error}>
            {tConnector('couldNotReadSqlMetadata')}
            {metadataState.error}
            <button type="button" onClick={refreshMetadata}>
              {tConnector('retryMetadata')}
            </button>
          </p>
        )}
        {library.error && (
          <p role="alert" className={styles.error}>
            {library.error}
          </p>
        )}
        {current ? (
          <SqlEditorSplit
            resultsVisible={resultsVisible}
            onShowResults={() => setResultsVisible(true)}
            resultMinHeight={scopedResultPins(resultPins.pins, pinScope).length ? 360 : 0}
            editor={
              <div
                className="mw-editor"
                id="fouc-sql-query-document"
                role="tabpanel"
                aria-label={current.title}
              >
                <SqlEditor
                  showRunGutter
                  diagnostics={diagnostics}
                  wrapLines={wrapLines}
                  executionMark={selectedStatement}
                  provider={session.provider}
                  documentId={current.id}
                  value={current.sql}
                  positions={current.editorPosition}
                  cache={editorCache.current}
                  complete={complete}
                  completionScope={`${targetSchema}:${metadataRevision}:${preferences.data?.version ?? 'default'}`}
                  onChange={(sql) => updateTab(current.id, { sql })}
                  onPositionChange={(id, editorPosition) => {
                    const tab = controller.getSnapshot().tabs.find((item) => item.id === id);
                    if (
                      tab &&
                      JSON.stringify(tab.editorPosition) !== JSON.stringify(editorPosition)
                    )
                      updateTab(id, { editorPosition });
                  }}
                  onRun={(mode) => void run(mode ?? executionMode)}
                  onSave={() => void saveCurrent()}
                  onFormat={() => void transformCurrent()}
                  snippets={preferences.data?.snippets}
                  keywordCase={preferences.data?.formatter.keywordCase}
                  functionCase={preferences.data?.formatter.functionCase}
                  editorRef={editor}
                />
              </div>
            }
            result={
              <ResultPins
                view={current.resultView}
                onViewChange={(resultView) => updateTab(current.id, { resultView })}
                key={JSON.stringify(pinScope)}
                scope={pinScope}
                pins={resultPins.pins}
                current={currentResult}
                currentLabel={currentResultLabel}
                hasExecution={Boolean(execution)}
                base={base}
                onExplainTarget={setResultExplainTarget}
                onCollapse={() => setResultsVisible(false)}
                provider={session.provider}
                layoutScopeKey={`${session.connectionId ?? session.id}:${current.database}:${current.schema}:${current.id}`}
                onRemove={resultPins.remove}
                onNotice={setNotice}
                onSqlPreview={openComparisonReview}
              >
                {(headerHost) => (
                  <SqlExecutionResults
                    key={`${current.id}:${execution?.snapshot?.id ?? 'empty'}`}
                    headerHost={headerHost}
                    base={base}
                    onExplainTarget={setResultExplainTarget}
                    onRefresh={() => void run()}
                    autoRefresh={autoQueryId === current.id}
                    onAutoRefresh={toggleAutoRefresh}
                    onCloseLastResult={() => setAutoQueryId(null)}
                    layoutScopeKey={`${session.connectionId ?? session.id}:${current.database}:${current.schema}:${current.id}`}
                    provider={session.provider}
                    execution={execution}
                    onSelect={(index) => selectResult(current.id, index)}
                    view={current.resultView}
                    onViewChange={(resultView) => updateTab(current.id, { resultView })}
                    onCancel={() => void cancel(current.id)}
                    currentPinned={currentResultPinned}
                    onPin={(statement, index) => {
                      if (!statement.result || !execution?.snapshot) return;
                      try {
                        resultPins.pin({
                          scope: pinScope,
                          sourceId: `${execution.snapshot.id}:${index}`,
                          label: sqlResultLabel(
                            statement.sql,
                            session.provider,
                            execution.snapshot.schema,
                            translateConnector('result', { p0: String(index + 1) }),
                          ),
                          sql: statement.sql,
                          result: statement.result,
                          context: {
                            database: execution.snapshot.database,
                            schema: execution.snapshot.schema,
                          },
                        });
                        setNotice(translateConnector('resultPinnedRerunningDoesNotOverwriteIt'));
                      } catch (reason) {
                        setNotice(
                          reason instanceof Error
                            ? uiText(reason, getLocale())
                            : translateConnector('couldNotPinTheResult'),
                        );
                      }
                    }}
                    onReveal={(statement) => {
                      const view = editor.current;
                      if (!view) return;
                      if (view.state.sliceDoc(statement.from, statement.to) !== statement.sql) {
                        setNotice(
                          translateConnector(
                            'sqlChangedAfterThisExecutionAndCannotBeLocatedPrecisely',
                          ),
                        );
                        return;
                      }
                      const position = Math.min(
                        view.state.doc.length,
                        statement.from + (statement.error?.position ?? 0),
                      );
                      view.dispatch({ selection: { anchor: position }, scrollIntoView: true });
                      view.focus();
                    }}
                  />
                )}
              </ResultPins>
            }
          />
        ) : (
          <div className={tabsStyle.empty}>
            <p>{state.ready ? tConnector('noSqlQueriesOpen') : tConnector('loadingSqlDrafts')}</p>
            {state.ready && (
              <>
                <button type="button" className="fouc-action" onClick={add}>
                  {tConnector('newQuery')}
                </button>
                {closed.length > 0 && (
                  <button
                    type="button"
                    className="fouc-action"
                    onClick={() => action('reopen', null)}
                  >
                    {tConnector('reopenTheMostRecentlyClosedQuery')}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {panel === 'history' && (
        <SqlHistoryPanel
          base={`${base}/history`}
          revision={revision}
          canSave={Boolean(libraryBase)}
          onClose={() => setPanel(null)}
          onRestore={historyRestore}
          onSave={(entry) =>
            setSaving({
              tabId: null,
              sql: entry.sql,
              schema: entry.schema,
              database: entry.database,
              file: null,
            })
          }
        />
      )}
      {panel === 'library' && libraryBase && (
        <SqlLibraryPanel
          base={libraryBase}
          library={library.data}
          busy={library.busy}
          error={library.error}
          onRefresh={() => setRevision((value) => value + 1)}
          onClose={() => setPanel(null)}
          onOpen={openFile}
          onUpdated={(document) =>
            controller.update((snapshot) => ({
              ...snapshot,
              tabs: snapshot.tabs.map((tab) =>
                tab.savedFile?.id === document.id && tab.originalSql === document.sql
                  ? {
                      ...tab,
                      savedFile: binding(document),
                      title: tab.customTitle ? tab.title : document.name,
                    }
                  : tab,
              ),
            }))
          }
          onDeleted={(ids) => {
            controller.update((snapshot) => ({
              ...snapshot,
              tabs: snapshot.tabs.map((tab) =>
                tab.savedFile && ids.includes(tab.savedFile.id)
                  ? { ...tab, savedFile: null, originalSql: '' }
                  : tab,
              ),
            }));
            setNotice(translateConnector('theSqlFileWasDeletedEditorContentIsRetainedAnd'));
          }}
        />
      )}
      {saving && libraryBase && (
        <SaveSqlDialog
          base={libraryBase}
          {...saving}
          library={library.data}
          onClose={() => setSaving(null)}
          onSaved={(document) => {
            const tab = controller.getSnapshot().tabs.find((item) => item.id === saving.tabId);
            if (
              tab &&
              tab.database === document.database &&
              (tab.schema ?? (schema || null)) === document.schema
            )
              updateTab(tab.id, {
                savedFile: binding(document),
                originalSql: document.sql,
                title: tab.customTitle ? tab.title : document.name,
              });
            setSaving(null);
            setNotice(translateConnector('saved', { p0: String(document.name) }));
            setRevision((value) => value + 1);
          }}
        />
      )}
      {restore && (
        <SqlDialog title={tConnector('restoreSqlEditorContent')} onClose={() => setRestore(null)}>
          <div className={common.formBody}>
            <p>
              {restoreError
                ? tConnector('theSavedTargetContextCannotBeRestoredNowEditorContent')
                : tConnector('theCurrentQueryHasChangesRestoringReplacesAllEditorContent')}
            </p>
            <small>{tConnector('restoringDoesNotExecuteSql')}</small>
            {restoreError && (
              <p role="alert" className={styles.error}>
                {restoreError}
              </p>
            )}
          </div>
          <footer className={common.dialogFooter}>
            <button type="button" className={common.secondary} onClick={() => setRestore(null)}>
              {tConnector('keepCurrentContent')}
            </button>
            <span />
            <button
              type="button"
              className={common.primary}
              disabled={Boolean(restoreError)}
              onClick={() => apply(restore.target, restore.tabId)}
            >
              {tConnector('replaceAndRestore')}
            </button>
          </footer>
        </SqlDialog>
      )}
      {closing && (
        <SqlDialog
          title={tConnector('confirmClosingSqlTabs')}
          role="alertdialog"
          onClose={() => setClosing(null)}
        >
          <div className={common.formBody}>
            <p>
              {tConnector('close')}
              {closing.length}
              {tConnector('tabsIncluding')}
              {closing.filter(sqlTabDirty).length}
              {tConnector('modifiedTabsClosingRemovesTheirDraftsFromTheDeviceRestore')}
            </p>
            <ul className={tabsStyle.closing}>
              {closing.map((tab) => (
                <li key={tab.id}>
                  {tab.title}
                  {sqlTabDirty(tab) ? tConnector('notSavedToASqlFile') : ''}
                </li>
              ))}
            </ul>
            <small>{tConnector('cancelToSaveEachTabFirstRecentlyClosedTabsCan')}</small>
          </div>
          <footer className={common.dialogFooter}>
            <button type="button" className={common.secondary} onClick={() => setClosing(null)}>
              {tConnector('keepTabs')}
            </button>
            <span />
            <button type="button" className={common.danger} onClick={() => finishClose(closing)}>
              {tConnector('discardChangesAndClose')}
            </button>
          </footer>
        </SqlDialog>
      )}
      {renaming && (
        <SqlDialog title={tConnector('renameSqlTab')} onClose={() => setRenaming(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (title.trim()) {
                updateTab(renaming.id, { title: title.trim(), customTitle: true });
                setRenaming(null);
              }
            }}
          >
            <div className={common.formBody}>
              <label>
                {tConnector('tabName')}
                <input
                  aria-label={tConnector('sqlTabName')}
                  value={title}
                  maxLength={200}
                  required
                  autoFocus
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <small>{tConnector('changeTheTabTitleManageSqlFilenamesInTheSql')}</small>
            </div>
            <footer className={common.dialogFooter}>
              <button type="button" className={common.secondary} onClick={() => setRenaming(null)}>
                {tConnector('cancel')}
              </button>
              <span />
              <button type="submit" className={common.primary} disabled={!title.trim()}>
                {tConnector('confirmTabName')}
              </button>
            </footer>
          </form>
        </SqlDialog>
      )}
      {remote && (
        <SqlDialog title={tConnector('viewDeviceSqlDrafts')} onClose={() => setRemote(null)}>
          <div className={common.formBody}>
            <p>
              {tConnector('theDeviceVersionContains')}
              {remote.tabs.length}
              {tConnector('tabsCompleteDeviceSqlIsShownBelowCurrentWindowContent')}
            </p>
            {busyIds.size > 0 && (
              <p role="status">
                {tConnector('queriesAreStillRunningReplaceOrMergeDraftsAfterExecution')}
              </p>
            )}
            <div className={tabsStyle.preview}>
              {remote.tabs.map((tab) => (
                <label key={tab.id}>
                  {tab.title} · {tab.database}
                  {tab.schema ? ` / ${tab.schema}` : ''}
                  <textarea
                    readOnly
                    aria-label={tConnector('deviceDraft', { p0: String(tab.title) })}
                    value={tab.sql}
                  />
                </label>
              ))}
            </div>
          </div>
          <footer className={common.dialogFooter}>
            <button type="button" className={common.secondary} onClick={() => setRemote(null)}>
              {tConnector('keepCurrentContent')}
            </button>
            <button
              type="button"
              className={common.secondary}
              disabled={busyIds.size > 0}
              onClick={() => adoptDeviceDrafts(false)}
            >
              {tConnector('replaceWithDeviceVersion')}
            </button>
            <button
              type="button"
              className={common.primary}
              disabled={busyIds.size > 0}
              onClick={() => adoptDeviceDrafts(true)}
            >
              {tConnector('keepLocalContentAndMergeSave')}
            </button>
          </footer>
        </SqlDialog>
      )}
    </div>
  );
}
