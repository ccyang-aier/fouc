'use client';
import { uiText, type UiMessage, uiFailure } from '../i18n/ui-message';
import { useTranslation, createTranslator } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-library-panel.messages';
const translateConnector = createTranslator(connectorMessages);
import { useState, type ReactNode } from 'react';
import {
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  FileCode,
  Folder,
  FolderPlus,
  PencilSimple,
  Trash,
  Copy,
  ArrowUp,
  ArrowDown,
  X,
} from '@phosphor-icons/react';
import {
  savedSqlScore,
  sqlFolderPath,
  type SavedSqlDocument,
  type SavedSqlFile,
  type SavedSqlFolder,
  type SavedSqlLibrary,
} from '@fouc/shared';
import { backendFetch } from '@/lib/backend';
import { SqlDialog } from './sql-library-dialog';
import common from './relational.module.css';
import styles from './sql-library.module.css';
type Edit =
  | {
      kind: 'folder';
      folder: SavedSqlFolder | null;
      parent: string | null;
    }
  | {
      kind: 'file';
      file: SavedSqlFile;
    };
export function SqlLibraryPanel({
  base,
  library,
  busy,
  error,
  onRefresh,
  onClose,
  onOpen,
  onUpdated,
  onDeleted,
}: {
  base: string;
  library: SavedSqlLibrary | null;
  busy: boolean;
  error: string;
  onRefresh: () => void;
  onClose: () => void;
  onOpen: (file: SavedSqlDocument) => void;
  onUpdated: (file: SavedSqlDocument) => void;
  onDeleted: (ids: string[]) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [expanded, setExpanded] = useState<Set<string>>(new Set()),
    [search, setSearch] = useState(''),
    [sort, setSort] = useState('folder');
  const [edit, setEdit] = useState<Edit | null>(null),
    [name, setName] = useState(''),
    [parent, setParent] = useState(''),
    [moving, setMoving] = useState(false);
  const [removing, setRemoving] = useState<{
    kind: 'folder' | 'file';
    id: string;
    name: string;
    version?: string;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false),
    [actionErrorStored, setActionError] = useState<UiMessage>(''),
    [noticeStored, setNotice] = useState<UiMessage>('');
  const actionError = uiText(actionErrorStored, locale);
  const notice = uiText(noticeStored, locale);
  const files = library?.files ?? [],
    folders = library?.folders ?? [],
    normalizedSearch = search.trim().toLocaleLowerCase();
  const matches = (file: SavedSqlFile) =>
    !normalizedSearch ||
    `${file.name} ${file.database} ${file.schema ?? ''}`
      .toLocaleLowerCase()
      .includes(normalizedSearch);
  async function action(work: () => Promise<unknown>, message = '') {
    if (actionBusy) return;
    setActionBusy(true);
    setActionError('');
    setNotice('');
    try {
      await work();
      onRefresh();
      setNotice(message);
    } catch (reason) {
      setActionError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      setActionBusy(false);
    }
  }
  function beginEdit(next: Edit) {
    setActionError('');
    setMoving(false);
    setEdit(next);
    setName(
      next.kind === 'file' ? next.file.name : (next.folder?.name ?? tConnector('createFolder')),
    );
    setParent(
      next.kind === 'file'
        ? (next.file.folderId ?? '')
        : (next.folder?.parentFolderId ?? next.parent ?? ''),
    );
  }
  async function saveMetadata() {
    if (!edit) return;
    await action(async () => {
      const document = await backendFetch<SavedSqlDocument | SavedSqlFolder>(
        `${base}/${edit.kind === 'folder' ? 'folders' : 'files'}${edit.kind === 'folder' ? (edit.folder ? `/${edit.folder.id}` : '') : `/${edit.file.id}`}`,
        {
          method: edit.kind === 'folder' && !edit.folder ? 'POST' : 'PUT',
          body: JSON.stringify(
            edit.kind === 'folder'
              ? {
                  name,
                  parentFolderId:
                    moving || !edit.folder ? parent || null : edit.folder.parentFolderId,
                }
              : {
                  name,
                  folderId: moving ? parent || null : edit.file.folderId,
                  version: edit.file.version,
                },
          ),
        },
      );
      if ('sql' in document) onUpdated(document);
      setEdit(null);
    }, tConnector('nameAndLocationSaved'));
  }
  async function reorder(file: SavedSqlFile, direction: number) {
    const siblings = files
      .filter((item) => item.folderId === file.folderId && item.database === file.database)
      .sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name));
    const index = siblings.findIndex((item) => item.id === file.id),
      target = index + direction;
    if (target < 0 || target >= siblings.length) return;
    [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
    await action(
      () =>
        backendFetch(`${base}/order`, {
          method: 'PUT',
          body: JSON.stringify({
            kind: 'files',
            ids: siblings.map((item) => item.id),
            parentFolderId: file.folderId,
            database: file.database,
          }),
        }),
      tConnector('sqlOrderUpdated'),
    );
  }
  async function deleteSelected() {
    if (!removing) return;
    await action(async () => {
      await backendFetch(
        `${base}/${removing.kind === 'folder' ? 'folders' : 'files'}/${removing.id}`,
        { method: 'DELETE', body: JSON.stringify({ confirmed: true, version: removing.version }) },
      );
      const ids =
        removing.kind === 'file'
          ? [removing.id]
          : files
              .filter((file) => {
                let folder = file.folderId;
                while (folder) {
                  if (folder === removing.id) return true;
                  folder = folders.find((entry) => entry.id === folder)?.parentFolderId ?? null;
                }
                return false;
              })
              .map((file) => file.id);
      onDeleted(ids);
      setRemoving(null);
    }, tConnector('sqlItemDeleted'));
  }
  function fileRow(file: SavedSqlFile, depth = 0) {
    return (
      <div className={styles.fileRow} key={file.id} style={{ paddingLeft: 12 + depth * 14 }}>
        <button
          type="button"
          className={styles.fileOpen}
          disabled={busy || actionBusy}
          onClick={() =>
            void action(async () => {
              onOpen(
                await backendFetch<SavedSqlDocument>(`${base}/files/${file.id}/open`, {
                  method: 'POST',
                }),
              );
            })
          }
        >
          <FileCode size={15} />
          <span>
            {file.name}
            <small>
              {file.database}
              {file.schema && file.schema !== file.database ? ` / ${file.schema}` : ''} ·{' '}
              {file.sqlBytes.toLocaleString(locale)}
              {tConnector('bytes')}
            </small>
          </span>
        </button>
        <div className={styles.rowActions}>
          <button
            type="button"
            aria-label={tConnector('copySqlFile', { p0: String(file.name) })}
            disabled={actionBusy}
            onClick={() =>
              void action(async () => {
                const document = await backendFetch<SavedSqlDocument>(`${base}/files/${file.id}`);
                await navigator.clipboard.writeText(document.sql);
              }, translateConnector('fullSqlCopied'))
            }
          >
            <Copy size={13} />
          </button>
          <button
            type="button"
            aria-label={tConnector('renameOrMoveSql', { p0: String(file.name) })}
            disabled={actionBusy}
            onClick={() => beginEdit({ kind: 'file', file })}
          >
            <PencilSimple size={13} />
          </button>
          <button
            type="button"
            aria-label={tConnector('moveSqlUp', { p0: String(file.name) })}
            disabled={actionBusy}
            onClick={() => void reorder(file, -1)}
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            aria-label={tConnector('moveSqlDown', { p0: String(file.name) })}
            disabled={actionBusy}
            onClick={() => void reorder(file, 1)}
          >
            <ArrowDown size={12} />
          </button>
          <button
            type="button"
            aria-label={tConnector('deleteSql', { p0: String(file.name) })}
            disabled={actionBusy}
            onClick={() =>
              setRemoving({ kind: 'file', id: file.id, name: file.name, version: file.version })
            }
          >
            <Trash size={13} />
          </button>
        </div>
      </div>
    );
  }
  function tree(parentId: string | null, depth = 0): ReactNode {
    return (
      <>
        {folders
          .filter((folder) => folder.parentFolderId === parentId)
          .map((folder) => (
            <div key={folder.id}>
              <div className={styles.folderRow} style={{ paddingLeft: 12 + depth * 14 }}>
                <button
                  type="button"
                  aria-expanded={expanded.has(folder.id)}
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(folder.id)) next.delete(folder.id);
                      else next.add(folder.id);
                      return next;
                    })
                  }
                >
                  {expanded.has(folder.id) ? <CaretDown size={13} /> : <CaretRight size={13} />}
                  <Folder size={15} />
                  <span>{folder.name}</span>
                </button>
                <button
                  type="button"
                  aria-label={tConnector('createSqlFolderUnder', { p0: String(folder.name) })}
                  disabled={actionBusy}
                  onClick={() => beginEdit({ kind: 'folder', folder: null, parent: folder.id })}
                >
                  <FolderPlus size={13} />
                </button>
                <button
                  type="button"
                  aria-label={tConnector('renameOrMoveFolder', { p0: String(folder.name) })}
                  disabled={actionBusy}
                  onClick={() =>
                    beginEdit({ kind: 'folder', folder, parent: folder.parentFolderId })
                  }
                >
                  <PencilSimple size={13} />
                </button>
                <button
                  type="button"
                  aria-label={tConnector('deleteSqlFolder', { p0: String(folder.name) })}
                  disabled={actionBusy}
                  onClick={() => setRemoving({ kind: 'folder', id: folder.id, name: folder.name })}
                >
                  <Trash size={13} />
                </button>
              </div>
              {expanded.has(folder.id) && tree(folder.id, depth + 1)}
            </div>
          ))}
        {files.filter((file) => file.folderId === parentId).map((file) => fileRow(file, depth))}
      </>
    );
  }
  return (
    <aside className={styles.panel} aria-label={tConnector('savedSqlLibrary')}>
      <header>
        <div>
          <strong>{tConnector('sqlLibrary')}</strong>
          <small>
            {tConnector('currentConnection')}
            {files.length}
            {tConnector('files')}
          </small>
        </div>
        <button
          type="button"
          aria-label={tConnector('createSqlFolder')}
          disabled={busy || actionBusy}
          onClick={() => beginEdit({ kind: 'folder', folder: null, parent: null })}
        >
          <FolderPlus size={17} />
        </button>
        <button
          type="button"
          aria-label={tConnector('refreshSqlLibrary')}
          disabled={busy || actionBusy}
          onClick={onRefresh}
        >
          <ArrowsClockwise size={16} />
        </button>
        <button type="button" aria-label={tConnector('closeSqlLibrary')} onClick={onClose}>
          <X size={17} />
        </button>
      </header>
      <div className={styles.filters}>
        <input
          aria-label={tConnector('searchSavedSql')}
          placeholder={tConnector('searchFileNamesDatabasesSchemas')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label={tConnector('sqlLibrarySorting')}
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="folder">{tConnector('folderOrder')}</option>
          <option value="recent">{tConnector('recentlyOpened')}</option>
          <option value="frequent">{tConnector('reusableSql')}</option>
        </select>
      </div>
      {(error || actionError) && (
        <p role="alert" className={styles.error}>
          {error || actionError}
          <button type="button" onClick={onRefresh}>
            {tConnector('refreshAndRetry')}
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      {busy && (
        <p role="status" className={styles.notice}>
          {tConnector('readingSqlLibrary')}
        </p>
      )}
      <div className={styles.list}>
        {search || sort !== 'folder'
          ? files
              .filter(matches)
              .sort((a, b) =>
                sort === 'frequent'
                  ? savedSqlScore(b) - savedSqlScore(a)
                  : (b.openedAt ?? 0) - (a.openedAt ?? 0) || b.updatedAt - a.updatedAt,
              )
              .map((file) => fileRow(file))
          : tree(null)}
        {!busy && !files.length && !folders.length && !error && (
          <p className={styles.empty}>{tConnector('noSqlSavedYetEditAQueryThenClickSave')}</p>
        )}
        {search && !files.some(matches) && (
          <p className={styles.empty}>{tConnector('noMatchingSqlFiles')}</p>
        )}
      </div>
      <footer>
        <span>{tConnector('openAFileToRestoreItsEditsSqlExecutesOnly')}</span>
      </footer>
      {edit && (
        <SqlDialog
          title={
            edit.kind === 'folder'
              ? edit.folder
                ? tConnector('manageSqlFolders')
                : tConnector('createSqlFolder')
              : tConnector('manageSqlFiles')
          }
          busy={actionBusy}
          onClose={() => setEdit(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveMetadata();
            }}
          >
            <div className={common.formBody}>
              <label>
                {tConnector('name')}
                <input
                  aria-label={tConnector('sqlItemName')}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={200}
                  autoFocus
                />
              </label>
              <label className={common.checkbox}>
                <input
                  type="checkbox"
                  checked={moving}
                  onChange={(event) => setMoving(event.target.checked)}
                />
                {tConnector('alsoAdjustTheFolderLocation')}
              </label>
              {(moving || (edit.kind === 'folder' && !edit.folder)) && (
                <label>
                  {tConnector('targetFolder')}
                  <select
                    aria-label={tConnector('sqlTargetFolder')}
                    value={parent}
                    onChange={(event) => setParent(event.target.value)}
                  >
                    <option value="">{tConnector('rootFolder')}</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {sqlFolderPath(folders, folder.id)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {actionError && (
                <p role="alert" className={styles.error}>
                  {actionError}
                </p>
              )}
            </div>
            <footer className={common.dialogFooter}>
              <button
                type="button"
                className={common.secondary}
                disabled={actionBusy}
                onClick={() => setEdit(null)}
              >
                {tConnector('cancel')}
              </button>
              <span />
              <button type="submit" className={common.primary} disabled={actionBusy}>
                {actionBusy ? tConnector('saving') : tConnector('saveSqlItem')}
              </button>
            </footer>
          </form>
        </SqlDialog>
      )}
      {removing && (
        <SqlDialog
          title={tConnector('deleteSqlItem')}
          busy={actionBusy}
          onClose={() => setRemoving(null)}
        >
          <div className={common.formBody}>
            <p>
              {tConnector('delete')}
              {removing.name}？
              {removing.kind === 'folder' &&
                tConnector('allNestedFoldersAndSqlDocumentsInThisFolderWill')}
            </p>
            <small>{tConnector('sqlWillNotBeExecutedAndTheDataSourceWill')}</small>
            {actionError && (
              <p role="alert" className={styles.error}>
                {actionError}
              </p>
            )}
          </div>
          <footer className={common.dialogFooter}>
            <button
              type="button"
              className={common.secondary}
              disabled={actionBusy}
              onClick={() => setRemoving(null)}
            >
              {tConnector('cancel')}
            </button>
            <span />
            <button
              type="button"
              className={common.primary}
              disabled={actionBusy}
              onClick={() => void deleteSelected()}
            >
              {tConnector('confirmSqlItemDeletion')}
            </button>
          </footer>
        </SqlDialog>
      )}
    </aside>
  );
}
