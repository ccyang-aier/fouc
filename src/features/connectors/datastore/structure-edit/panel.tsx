'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';
import { useTranslation, createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './panel.messages';
import { useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  Code,
  Copy,
  DownloadSimple,
  PencilSimple,
  Plus,
  Stack,
  Trash,
  Warning,
} from '@phosphor-icons/react';
import type { RelationalTableStructure } from '@fouc/shared';
import type {
  StructureEditCommitResult,
  StructureEditInput,
  StructureEditPreview,
} from '@fouc/shared/relational-structure-edit';
import { StructureColumnForm } from './column-form';
import { StructureIndexForm } from './index-form';
import {
  createStructureEditorDraft,
  newStructureColumn,
  newStructureIndex,
  structureDraftInput,
  validateStructureDraft,
  type StructureEditorDraft,
} from './draft';
import styles from './structure-edit.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export interface TableStructureEditorPanelProps {
  structure: RelationalTableStructure;
  className?: string;
  onPreview: (input: StructureEditInput) => Promise<StructureEditPreview>;
  onCommit: (preview: StructureEditPreview) => Promise<StructureEditCommitResult>;
  onCommitted?: (result: StructureEditCommitResult) => void;
  onClose?: () => void;
}
export function TableStructureEditorPanel(props: TableStructureEditorPanelProps) {
  return (
    <StructureEditor
      key={`${props.structure.connectionId}/${props.structure.schema}/${props.structure.table}`}
      {...props}
    />
  );
}
function StructureEditor({
  structure,
  className = '',
  onPreview,
  onCommit,
  onCommitted,
  onClose,
}: TableStructureEditorPanelProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [initial] = useState(structure);
  const [draft, setDraft] = useState(() => createStructureEditorDraft(initial));
  const [tab, setTab] = useState<'columns' | 'indexes' | 'primary' | 'preview'>('columns');
  const [selected, setSelected] = useState(draft.columns[0]?.id ?? '');
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null),
    [errorStored, setError] = useState<UiMessage>(''),
    [noticeStored, setNotice] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const notice = uiText(noticeStored, locale);
  const [preview, setPreview] = useState<StructureEditPreview | null>(null),
    [result, setResult] = useState<StructureEditCommitResult | null>(null),
    [acknowledged, setAcknowledged] = useState(false);
  const sequence = useRef(0);
  const input = useMemo(() => structureDraftInput(initial, draft), [initial, draft]);
  const validation = useMemo(
    () => validateStructureDraft(initial, draft, locale),
    [initial, draft, locale],
  );
  const stale = structure !== initial && JSON.stringify(structure) !== JSON.stringify(initial);
  const frozen = Boolean(
    busy || stale || (result && ['partial', 'unknown', 'committed'].includes(result.outcome)),
  );
  const activeColumn = draft.columns.find((column) => column.id === selected),
    activeIndex = draft.indexes.find((index) => index.id === selected);
  const names = draft.columns
    .filter((column) => !column.dropped)
    .map((column) => column.value.name)
    .filter(Boolean);
  const changed = input.operations.length;
  function update(next: StructureEditorDraft) {
    sequence.current++;
    setDraft(next);
    setPreview(null);
    setResult(null);
    setAcknowledged(false);
    setError('');
    setNotice('');
  }
  function addColumn() {
    const id = `new-column-${crypto.randomUUID()}`;
    update({
      ...draft,
      columns: [
        ...draft.columns,
        { id, originalName: null, value: newStructureColumn(initial.provider), dropped: false },
      ],
    });
    setSelected(id);
    setTab('columns');
  }
  function addIndex() {
    const id = `new-index-${crypto.randomUUID()}`;
    update({
      ...draft,
      indexes: [
        ...draft.indexes,
        { id, originalName: null, value: newStructureIndex(), dropped: false, protected: false },
      ],
    });
    setSelected(id);
    setTab('indexes');
  }
  async function review() {
    const version = sequence.current;
    setBusy('preview');
    setError('');
    setNotice('');
    try {
      const next = await onPreview(input);
      if (version === sequence.current) {
        setPreview(next);
        setAcknowledged(false);
        setTab('preview');
      }
    } catch (reason) {
      setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      setBusy(null);
    }
  }
  async function commit() {
    if (!preview?.executable || !acknowledged) return;
    setBusy('commit');
    setError('');
    try {
      const next = await onCommit(preview);
      setResult(next);
      if (next.outcome === 'committed') onCommitted?.(next);
    } catch (reason) {
      setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      setBusy(null);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(preview!.script);
      setNotice(connectorUiMessages.message('changeScriptCopied'));
    } catch {
      setError(connectorUiMessages.message('copyFailedRetryOrDownloadTheSql'));
    }
  }
  function download() {
    const url = URL.createObjectURL(
        new Blob([preview!.script], { type: 'application/sql;charset=utf-8' }),
      ),
      link = document.createElement('a');
    link.href = url;
    link.download = `${initial.table.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')}-structure.sql`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(connectorUiMessages.message('changeScriptDownloaded'));
  }
  const summary = preview ? preview.issues.filter((issue) => issue.severity !== 'warning') : [];
  return (
    <section
      className={`${styles.panel} ${className}`}
      aria-label={tConnector('nativeTableStructureEditor')}
      aria-busy={Boolean(busy)}
    >
      <header className={styles.header}>
        <div className={styles.title}>
          <div className={styles.icon}>
            <Stack size={22} />
          </div>
          <div>
            <h2>{tConnector('editTableStructure')}</h2>
            <p>
              <span>{initial.provider.toUpperCase()}</span>
              {initial.schema}.{initial.table}
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <span className={changed ? styles.dirty : styles.clean}>
            {changed
              ? tConnector('changesToReview', { p0: String(changed) })
              : tConnector('synced')}
          </span>
          {onClose && (
            <button type="button" disabled={Boolean(busy)} onClick={onClose}>
              {tConnector('close')}
            </button>
          )}
        </div>
      </header>
      <nav className={styles.tabs} aria-label={tConnector('tableStructureEditorPages')}>
        <button
          type="button"
          aria-current={tab === 'columns' ? 'page' : undefined}
          onClick={() => {
            setTab('columns');
            if (!draft.columns.some((column) => column.id === selected))
              setSelected(draft.columns[0]?.id ?? '');
          }}
        >
          <PencilSimple size={15} />
          {tConnector('field')}
          <span>{draft.columns.filter((column) => !column.dropped).length}</span>
        </button>
        <button
          type="button"
          aria-current={tab === 'indexes' ? 'page' : undefined}
          onClick={() => {
            setTab('indexes');
            if (!draft.indexes.some((index) => index.id === selected))
              setSelected(draft.indexes[0]?.id ?? '');
          }}
        >
          {tConnector('indexesAndUniqueness')}
          <span>{draft.indexes.filter((index) => !index.dropped).length}</span>
        </button>
        <button
          type="button"
          aria-current={tab === 'primary' ? 'page' : undefined}
          onClick={() => setTab('primary')}
        >
          {tConnector('primaryKey')}
        </button>
        <button
          type="button"
          aria-current={tab === 'preview' ? 'page' : undefined}
          onClick={() => setTab('preview')}
        >
          <Code size={15} />
          {tConnector('changeReview')}
        </button>
      </nav>
      {stale && (
        <div className={styles.alert} role="alert">
          {tConnector('theTableStructureHasChangedYourDraftWasKeptClose')}
        </div>
      )}
      <fieldset className={styles.body} disabled={frozen}>
        {(tab === 'columns' || tab === 'indexes') && (
          <>
            <aside className={styles.list}>
              <div className={styles.listHead}>
                <span>
                  {tab === 'columns' ? tConnector('columnList') : tConnector('indexList')}
                </span>
                <button type="button" onClick={tab === 'columns' ? addColumn : addIndex}>
                  <Plus size={14} />
                  {tConnector('added')}
                </button>
              </div>
              {tab === 'columns'
                ? draft.columns.map((column) => (
                    <button
                      type="button"
                      key={column.id}
                      className={`${styles.object} ${selected === column.id ? styles.active : ''} ${column.dropped ? styles.dropped : ''}`}
                      onClick={() => setSelected(column.id)}
                    >
                      <span>
                        <b>{column.value.name || tConnector('untitledColumn')}</b>
                        <small>{column.value.dataType}</small>
                      </span>
                      <em>
                        {column.dropped
                          ? tConnector('delete')
                          : column.originalName
                            ? input.operations.some((op) => op.id === column.id)
                              ? tConnector('modified')
                              : ''
                            : tConnector('added')}
                      </em>
                    </button>
                  ))
                : draft.indexes.map((index) => (
                    <button
                      type="button"
                      key={index.id}
                      className={`${styles.object} ${selected === index.id ? styles.active : ''} ${index.dropped ? styles.dropped : ''}`}
                      onClick={() => setSelected(index.id)}
                    >
                      <span>
                        <b>{index.value.name || tConnector('untitledIndex')}</b>
                        <small>
                          {index.value.unique ? 'UNIQUE · ' : ''}
                          {index.value.method.toUpperCase()}
                        </small>
                      </span>
                      <em>
                        {index.dropped
                          ? tConnector('delete')
                          : index.originalName
                            ? ''
                            : tConnector('added')}
                      </em>
                    </button>
                  ))}
              {tab === 'indexes' && !draft.indexes.length && (
                <p className={styles.emptySmall}>
                  {tConnector('noRegularIndexesYetAdjustThePrimaryKeyOnThe')}
                </p>
              )}
            </aside>
            <div className={styles.inspector}>
              {tab === 'columns' && activeColumn && (
                <>
                  <div className={styles.inspectorHead}>
                    <h3>
                      {activeColumn.originalName
                        ? activeColumn.originalName
                        : tConnector('addColumn')}
                    </h3>
                    <button
                      type="button"
                      className={activeColumn.dropped ? styles.subtle : styles.danger}
                      onClick={() =>
                        update({
                          ...draft,
                          columns: draft.columns.map((column) =>
                            column.id === selected
                              ? { ...column, dropped: !column.dropped }
                              : column,
                          ),
                        })
                      }
                    >
                      <Trash size={14} />
                      {activeColumn.dropped
                        ? tConnector('restoreColumn')
                        : activeColumn.originalName
                          ? tConnector('markForDeletion')
                          : tConnector('cancelAddition')}
                    </button>
                  </div>
                  {activeColumn.dropped ? (
                    <div className={styles.empty}>
                      <Warning size={28} />
                      <h3>{tConnector('markedForDeletion')}</h3>
                      <p>{tConnector('thePreviewIdentifiesDataLossAndDependencyImpactsYouCan')}</p>
                    </div>
                  ) : (
                    <StructureColumnForm
                      value={activeColumn.value}
                      provider={initial.provider}
                      onChange={(value) =>
                        update({
                          ...draft,
                          columns: draft.columns.map((column) =>
                            column.id === selected ? { ...column, value } : column,
                          ),
                        })
                      }
                    />
                  )}
                </>
              )}
              {tab === 'indexes' && activeIndex && (
                <>
                  <div className={styles.inspectorHead}>
                    <h3>{activeIndex.originalName || tConnector('addIndex')}</h3>
                    <button
                      type="button"
                      className={activeIndex.dropped ? styles.subtle : styles.danger}
                      disabled={activeIndex.protected}
                      onClick={() =>
                        update({
                          ...draft,
                          indexes: draft.indexes.map((index) =>
                            index.id === selected ? { ...index, dropped: !index.dropped } : index,
                          ),
                        })
                      }
                    >
                      <Trash size={14} />
                      {activeIndex.dropped
                        ? tConnector('restoreIndex')
                        : tConnector('markForDeletion')}
                    </button>
                  </div>
                  {activeIndex.dropped ? (
                    <div className={styles.empty}>
                      <Warning size={28} />
                      <h3>{tConnector('indexWillBeDeleted')}</h3>
                      <p>
                        {tConnector(
                          'deletingAUniqueIndexRemovesUniquenessProtectionTheServerBlocks',
                        )}
                      </p>
                    </div>
                  ) : activeIndex.originalName ? (
                    <div className={styles.existingIndex}>
                      <p>
                        {activeIndex.protected
                          ? tConnector('thisIndexIsManagedByAConstraintAndCannotBe')
                          : tConnector(
                              'existingIndexesRetainTheirNativeDefinitionsExplicitlyDeleteAndAdd',
                            )}
                      </p>
                      <pre>
                        {initial.indexes.find((index) => index.name === activeIndex.originalName)
                          ?.definition ||
                          initial.indexes
                            .find((index) => index.name === activeIndex.originalName)
                            ?.parts.map((part) => part.column || part.expression)
                            .join(', ')}
                      </pre>
                      <dl>
                        <dt>{tConnector('uniqueness')}</dt>
                        <dd>
                          {activeIndex.value.unique ? tConnector('unique') : tConnector('regular')}
                        </dd>
                        <dt>{tConnector('condition')}</dt>
                        <dd>{activeIndex.value.predicate || tConnector('none')}</dd>
                        <dt>{tConnector('notes')}</dt>
                        <dd>{activeIndex.value.comment || tConnector('none')}</dd>
                      </dl>
                    </div>
                  ) : (
                    <StructureIndexForm
                      value={activeIndex.value}
                      provider={initial.provider}
                      columns={names}
                      onChange={(value) =>
                        update({
                          ...draft,
                          indexes: draft.indexes.map((index) =>
                            index.id === selected ? { ...index, value } : index,
                          ),
                        })
                      }
                    />
                  )}
                </>
              )}
              {!(tab === 'columns' ? activeColumn : activeIndex) && (
                <div className={styles.empty}>
                  <Stack size={28} />
                  <p>{tConnector('selectAnObjectOrAddOne')}</p>
                </div>
              )}
            </div>
          </>
        )}
        {tab === 'primary' && (
          <div className={styles.primary}>
            <h3>{tConnector('primaryKeyAndOrder')}</h3>
            <p>{tConnector('selectedColumnsFollowClickOrderPrimaryKeysRequireUniqueNon')}</p>
            <div className={styles.chips}>
              {names.map((name) => (
                <label key={name}>
                  <input
                    type="checkbox"
                    checked={draft.primaryKey.includes(name)}
                    onChange={(event) =>
                      update({
                        ...draft,
                        primaryKey: event.target.checked
                          ? [...draft.primaryKey, name]
                          : draft.primaryKey.filter((column) => column !== name),
                      })
                    }
                  />
                  {name}
                  {draft.primaryKey.includes(name) && <b>{draft.primaryKey.indexOf(name) + 1}</b>}
                </label>
              ))}
            </div>
            <div className={styles.keyPreview}>
              PRIMARY KEY (
              {draft.primaryKey.length ? draft.primaryKey.join(', ') : tConnector('none')})
            </div>
            {initial.provider === 'sqlite' && (
              <p className={styles.hint}>
                {tConnector('sqlitePrimaryKeyChangesGenerateManualRebuildInstructionsDirectCommit')}
              </p>
            )}
          </div>
        )}
      </fieldset>
      {tab === 'preview' && (
        <div className={styles.review}>
          {preview ? (
            <>
              <div className={styles.reviewHead}>
                <div>
                  <h3>
                    {preview.executable
                      ? tConnector('changeScriptReady')
                      : tConnector('adjustmentOrManualReviewRequired')}
                  </h3>
                  <p>
                    {preview.steps.length}
                    {tConnector('steps')}
                    {preview.transaction === 'implicit-commit'
                      ? tConnector('mysqlImplicitCommitAtEachStep')
                      : tConnector('singleTransaction')}
                  </p>
                </div>
                <button type="button" onClick={() => void copy()}>
                  <Copy size={14} />
                  {tConnector('copy')}
                </button>
                <button type="button" onClick={download}>
                  <DownloadSimple size={14} />
                  {tConnector('download')}
                </button>
              </div>
              <div className={styles.reviewGrid}>
                <pre aria-label={tConnector('tableStructureChangeScript')}>{preview.script}</pre>
                <aside>
                  <h4>{tConnector('impactsAndLimitations')}</h4>
                  {preview.issues.map((issue, index) => (
                    <p
                      key={index}
                      className={issue.severity === 'warning' ? styles.warning : styles.blocking}
                    >
                      <Warning size={14} />
                      <span>{issue.message}</span>
                    </p>
                  ))}
                </aside>
              </div>
              {preview.executable && !result && (
                <label className={styles.acknowledge}>
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    disabled={Boolean(busy)}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                  />
                  {tConnector('iHaveReviewedTheScriptAndItsImpacts')}
                  {preview.transaction === 'implicit-commit'
                    ? tConnector('andUnderstandThatSuccessfulDdlCannotBeRolledBack')
                    : tConnector('andConfirmTheseChangesCanBeCommitted')}
                </label>
              )}
              {result && (
                <div
                  role="status"
                  className={result.outcome === 'committed' ? styles.success : styles.alert}
                >
                  <h4>
                    {result.outcome === 'committed'
                      ? tConnector('structureChangesCommitted')
                      : result.outcome === 'rolled-back'
                        ? tConnector('commitFailedTransactionRollbackRequested')
                        : result.outcome === 'partial'
                          ? tConnector('someStepsWereCommittedReadTheStructureAgain')
                          : result.outcome === 'unknown'
                            ? tConnector('commitOutcomeUncertainReadTheStructureAgain')
                            : tConnector('changesNotCommitted')}
                  </h4>
                  {result.error && <p>{result.error}</p>}
                  <ul>
                    {result.steps.map((step) => (
                      <li key={step.id}>
                        {preview.steps.find((entry) => entry.id === step.id)?.label} ·{' '}
                        {statusText(step.status, locale)}
                        {step.error ? ` · ${step.error}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className={styles.empty}>
              <Code size={32} />
              <h3>{tConnector('finishTheDraftThenReviewTheDdl')}</h3>
              <p>{tConnector('theServerGeneratesThePreviewUsingCurrentNativeMetadataNothing')}</p>
            </div>
          )}
        </div>
      )}
      {validation.length > 0 && (
        <div className={styles.validation} role="alert">
          {validation.slice(0, 4).map((message) => (
            <p key={message}>{message}</p>
          ))}
          {validation.length > 4 && (
            <p>
              {tConnector('another')}
              {validation.length - 4}
              {tConnector('itemsNeedCorrection')}
            </p>
          )}
        </div>
      )}
      {error && (
        <div role="alert" className={styles.alert}>
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          <CheckCircle size={14} />
          {notice}
        </p>
      )}
      <footer className={styles.footer}>
        <span>
          {busy === 'preview'
            ? tConnector('generatingNativePreview')
            : busy === 'commit'
              ? tConnector('committingKeepThisPageOpen')
              : summary.length
                ? tConnector('itemsNeedAdjustment', { p0: String(summary.length) })
                : changed
                  ? tConnector('draftNotWrittenToTheDatabase')
                  : tConnector('modifyColumnsIndexesOrThePrimaryKeyThenGenerateA')}
        </span>
        <button
          type="button"
          disabled={frozen || !changed}
          onClick={() => {
            update(createStructureEditorDraft(initial));
            setSelected(initial.columns[0] ? 'column-0' : '');
          }}
        >
          {tConnector('resetDraft')}
        </button>
        <button
          type="button"
          className={styles.secondary}
          disabled={frozen || !changed || Boolean(validation.length)}
          onClick={() => void review()}
        >
          {tConnector('generatePreview')}
        </button>
        <button
          type="button"
          className={styles.commit}
          disabled={frozen || !preview?.executable || !acknowledged || Boolean(result)}
          onClick={() => void commit()}
        >
          {busy === 'commit' ? tConnector('committing') : tConnector('commitReviewedChanges')}
        </button>
      </footer>
    </section>
  );
}
function statusText(
  status: StructureEditCommitResult['steps'][number]['status'],
  locale?: Locale,
): string {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    committed: tConnector('committed'),
    'rolled-back': tConnector('rollbackRequested'),
    failed: tConnector('failed'),
    unattempted: tConnector('notExecuted'),
    unknown: tConnector('awaitingConfirmation'),
  }[status];
}
