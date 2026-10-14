'use client';

import { uiText, uiFailure, type UiMessage, createUiMessages } from '../../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './panel.messages';
import { useMemo, useState } from 'react';
import { BookOpenText } from '@phosphor-icons/react/dist/csr/BookOpenText';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { Palette } from '@phosphor-icons/react/dist/csr/Palette';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import {
  applyDatabaseDocsAnnotations,
  databaseDocsGroupColor,
  exportDatabaseDocsDbml,
  exportDatabaseDocsMarkdown,
  type DatabaseDocsWarning,
} from '@fouc/shared/database-docs';
import { useDatabaseDocs } from './use-docs';
import { DocsGroups } from './groups';
import { DocsMarkdown, DocsNoteEditor } from './note-editor';
import { DocsTablePage } from './table-page';
import styles from './database-docs.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export interface DatabaseDocsPanelProps {
  base: string;
  schemas: string[];
  persistent: boolean;
  onOpenTable?: (schema: string, table: string) => void;
}
export function DatabaseDocsPanel(props: DatabaseDocsPanelProps) {
  return <Browser key={`${props.base}:${JSON.stringify(props.schemas)}`} {...props} />;
}
function Browser({ base, schemas, persistent, onOpenTable }: DatabaseDocsPanelProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [revision, setRevision] = useState(0),
    [search, setSearch] = useState(''),
    [selected, setSelected] = useState<string | null>(null),
    [groupFilter, setGroupFilter] = useState<string>('all'),
    [groupEditor, setGroupEditor] = useState(false),
    [exportWarnings, setExportWarnings] = useState<DatabaseDocsWarning[]>([]),
    [feedbackStored, setFeedback] = useState<UiMessage>('');
  const feedback = uiText(feedbackStored, locale);
  const resource = useDatabaseDocs(base, schemas, revision);
  const snapshot = useMemo(
    () =>
      resource.raw && resource.notes
        ? applyDatabaseDocsAnnotations(resource.raw, resource.notes.annotations)
        : null,
    [resource.raw, resource.notes],
  );
  const editable = persistent && resource.notes?.persistent === true;
  const tables =
    snapshot?.tables.filter(
      (table) =>
        (groupFilter === 'all' ||
          (groupFilter === 'ungrouped' ? table.groupId === null : table.groupId === groupFilter)) &&
        `${table.structure.schema}.${table.structure.table} ${table.note.effective ?? ''} ${table.structure.columns.map((column) => column.name).join(' ')}`
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
    ) ?? [];
  const current = snapshot?.tables.find((table) => table.key === selected) ?? null;
  function download(format: 'dbml' | 'markdown') {
    if (!snapshot) return;
    try {
      const result =
          format === 'dbml'
            ? exportDatabaseDocsDbml(snapshot, (issue) => uiText(issue, locale))
            : exportDatabaseDocsMarkdown(snapshot, (issue) => uiText(issue, locale)),
        url = URL.createObjectURL(new Blob([result.text], { type: 'text/plain;charset=utf-8' })),
        anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${snapshot.project.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || 'database-docs'}.${format === 'dbml' ? 'dbml' : 'md'}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportWarnings(result.warnings.filter((warning) => warning.kind === 'dbml-omitted'));
      setFeedback(
        connectorUiMessages.message('exported', {
          p0: String(format === 'dbml' ? 'DBML' : 'Markdown'),
          p1: result.warnings.some((warning) => warning.kind === 'dbml-omitted')
            ? connectorUiMessages.message('checkFormatOmissionNotices')
            : '',
        }),
      );
    } catch (error) {
      setFeedback(
        connectorUiMessages.message('exportFailed', {
          p0: uiFailure(error),
        }),
      );
    }
  }
  return (
    <section className={styles.panel} aria-label={tConnector('nativeDatabaseDocumentation')}>
      <header className={styles.toolbar}>
        <div>
          <BookOpenText size={18} />
          <strong>{tConnector('databaseDocumentation')}</strong>
          <span>{schemas.join(', ')}</span>
        </div>
        <div className={styles.toolbarActions}>
          <span className={styles.saveStatus} role="status">
            {resource.saving
              ? tConnector('savingLocalNotes')
              : resource.savedAt
                ? tConnector('localNotesSaved')
                : editable
                  ? tConnector('currentDevicePersistentNotes')
                  : tConnector('readOnlyStructurePreview')}
          </span>
          <button
            className={styles.secondary}
            disabled={!snapshot}
            onClick={() => download('dbml')}
          >
            <DownloadSimple size={13} />
            DBML
          </button>
          <button
            className={styles.secondary}
            disabled={!snapshot}
            onClick={() => download('markdown')}
          >
            <DownloadSimple size={13} />
            Markdown
          </button>
          <button
            className={styles.iconButton}
            aria-label={tConnector('refreshDatabaseDocumentationStructure')}
            disabled={resource.saving}
            onClick={() => setRevision((value) => value + 1)}
          >
            <ArrowsClockwise size={15} />
          </button>
        </div>
      </header>
      {resource.loading ? (
        <div className={styles.empty} role="status">
          <span className={styles.spinner} />
          <strong>{tConnector('collectingNativeDatabaseStructure')}</strong>
          <span>
            {tConnector('columnsIndexesConstraintsForeignKeysAndNativeDefinitionsComeFrom')}
          </span>
        </div>
      ) : resource.error ? (
        <div className={styles.empty}>
          <p className={styles.error} role="alert">
            {resource.error}
          </p>
          <button className={styles.primary} onClick={() => setRevision((value) => value + 1)}>
            {tConnector('retryDocumentationCollection')}
          </button>
        </div>
      ) : (
        snapshot && (
          <div className={styles.layout}>
            <aside className={styles.sidebar}>
              <button
                className={styles.overviewLink}
                data-active={selected === null}
                onClick={() => setSelected(null)}
              >
                <BookOpenText size={14} />
                {tConnector('documentationOverview')}
                <span>{snapshot.tables.length}</span>
              </button>
              <label className={styles.search}>
                <MagnifyingGlass size={13} />
                <input
                  aria-label={tConnector('searchDatabaseTablesColumnsOrNotes')}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={tConnector('searchTablesColumnsOrNotes')}
                />
              </label>
              <div className={styles.groupFilter}>
                <select
                  aria-label={tConnector('filterDocumentationColorGroups')}
                  value={groupFilter}
                  onChange={(event) => setGroupFilter(event.target.value)}
                >
                  <option value="all">{tConnector('allGroups')}</option>
                  <option value="ungrouped">{tConnector('ungrouped')}</option>
                  {snapshot.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                {editable && (
                  <button
                    className={styles.iconButton}
                    aria-label={tConnector('manageDocumentationColorGroups')}
                    onClick={() => setGroupEditor((value) => !value)}
                  >
                    <Palette size={15} />
                  </button>
                )}
              </div>
              <div className={styles.listCaption}>
                <span>{tConnector('nativeStructure')}</span>
                <span>{tables.length}</span>
              </div>
              <nav
                className={styles.tableList}
                aria-label={tConnector('databaseDocumentationObjectList')}
              >
                {tables.map((table) => {
                  const group = snapshot.groups.find((group) => group.id === table.groupId);
                  return (
                    <button
                      key={table.key}
                      data-active={table.key === selected}
                      onClick={() => setSelected(table.key)}
                    >
                      <i
                        style={{
                          background: group
                            ? databaseDocsGroupColor(group.hue)
                            : 'var(--line-strong)',
                        }}
                      />
                      <span>
                        <strong>{table.structure.table}</strong>
                        <small>
                          {table.structure.schema} · {table.structure.kind.replace('_', ' ')}
                        </small>
                      </span>
                      <small>{table.structure.columns.length}</small>
                    </button>
                  );
                })}
                {!tables.length && (
                  <p className={styles.emptyNote}>{tConnector('noMatchingNativeObjects')}</p>
                )}
              </nav>
              <footer>
                {snapshot.provider} · {snapshot.database}
              </footer>
            </aside>
            <main className={styles.content}>
              {resource.saveError && (
                <div className={styles.warning} role="alert">
                  <span>{resource.saveError}</span>
                  <button disabled={resource.saving} onClick={() => void resource.reloadNotes()}>
                    {tConnector('reloadDeviceNotes')}
                  </button>
                </div>
              )}
              {feedback && (
                <p className={styles.exportFeedback} role="status">
                  {feedback}
                </p>
              )}
              {exportWarnings.length > 0 && (
                <details className={styles.warnings} open>
                  <summary>
                    {tConnector('dbmlOmissions')}
                    {exportWarnings.length}
                  </summary>
                  {exportWarnings.map((warning, index) => (
                    <p key={index}>
                      <strong>
                        {warning.table} / {warning.item}
                      </strong>
                      {warning.message}
                    </p>
                  ))}
                </details>
              )}
              {groupEditor && editable && (
                <DocsGroups
                  groups={resource.notes!.annotations.groups}
                  saving={resource.saving}
                  onSave={resource.save}
                  onClose={() => setGroupEditor(false)}
                />
              )}
              {current ? (
                <DocsTablePage
                  key={current.key}
                  table={current}
                  snapshot={snapshot}
                  editable={editable}
                  saving={resource.saving}
                  onSave={resource.save}
                  onSelect={setSelected}
                  onOpenTable={onOpenTable}
                />
              ) : (
                <article className={styles.overview}>
                  <span className={styles.eyebrow}>{tConnector('databaseFieldGuide')}</span>
                  <h1>{snapshot.project.name}</h1>
                  <p className={styles.subtitle}>
                    {snapshot.provider} · {snapshot.database} ·{' '}
                    {snapshot.project.schemas.join(', ')}
                  </p>
                  <div className={styles.statistics}>
                    <div>
                      <strong>{snapshot.tables.length}</strong>
                      <span>{tConnector('tablesAndViews')}</span>
                    </div>
                    <div>
                      <strong>
                        {snapshot.tables.reduce(
                          (sum, table) => sum + table.structure.columns.length,
                          0,
                        )}
                      </strong>
                      <span>{tConnector('nativeColumns')}</span>
                    </div>
                    <div>
                      <strong>{snapshot.relationships.length}</strong>
                      <span>{tConnector('foreignKeyRelationships')}</span>
                    </div>
                    <div>
                      <strong>{snapshot.groups.length}</strong>
                      <span>{tConnector('colorGroups')}</span>
                    </div>
                  </div>
                  <DocsNoteEditor
                    label={tConnector('databaseDocumentationMarkdownOverview')}
                    note={{
                      database: null,
                      local: snapshot.project.note,
                      effective: snapshot.project.note,
                      source: snapshot.project.note ? 'local' : 'none',
                    }}
                    editable={editable}
                    saving={resource.saving}
                    onSave={(note) =>
                      resource.save({
                        kind: 'project',
                        name: resource.notes!.annotations.project.name,
                        note,
                      })
                    }
                  />
                  {snapshot.groups.map((group) => (
                    <section key={group.id} className={styles.groupSummary}>
                      <h3>
                        <i style={{ background: databaseDocsGroupColor(group.hue) }} />
                        {group.name}
                        <small>
                          {snapshot.tables.filter((table) => table.groupId === group.id).length}
                          {tConnector('objects')}
                        </small>
                      </h3>
                      {group.note && <DocsMarkdown>{group.note}</DocsMarkdown>}
                      <div>
                        {snapshot.tables
                          .filter((table) => table.groupId === group.id)
                          .map((table) => (
                            <button
                              key={table.key}
                              className={styles.textButton}
                              onClick={() => setSelected(table.key)}
                            >
                              {table.structure.schema}.{table.structure.table}
                              <ArrowRight size={12} />
                            </button>
                          ))}
                      </div>
                    </section>
                  ))}
                  <p className={styles.helper}>
                    {tConnector('collectedAt')}
                    {new Date(snapshot.generatedAt).toLocaleString(locale)}
                    {tConnector('documentationExportsRetainFullNativeStructureAndLocalNotes')}
                  </p>
                  {!editable && (
                    <p className={styles.notice}>
                      {tConnector('theCurrentConnectionIsNotSavedBrowseSearchAndExport')}
                    </p>
                  )}
                </article>
              )}
              {snapshot.warnings.length > 0 && (
                <details className={styles.warnings}>
                  <summary>
                    {tConnector('structureAndNoteWarnings')}
                    {snapshot.warnings.length}
                  </summary>
                  {snapshot.warnings.map((warning, index) => (
                    <p key={index}>
                      <strong>{warning.table ?? warning.kind}</strong>
                      {warning.message}
                    </p>
                  ))}
                  {snapshot.orphans.map((orphan, index) => (
                    <code key={index}>
                      {orphan.schema}.{orphan.table}
                      {orphan.column ? `.${orphan.column}` : ''}
                      {tConnector('notesRetained')}
                    </code>
                  ))}
                </details>
              )}
            </main>
          </div>
        )
      )}
    </section>
  );
}
