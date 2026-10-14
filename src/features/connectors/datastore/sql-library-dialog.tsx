'use client';
import { uiText, type UiMessage, uiFailure } from '../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-library-dialog.messages';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { getOverlayRoot } from '@/lib/overlay-root';
import { X } from '@phosphor-icons/react';
import { sqlFolderPath, type SavedSqlDocument, type SavedSqlLibrary } from '@fouc/shared';
import { backendFetch } from '@/lib/backend';
import common from './relational.module.css';
import styles from './sql-library.module.css';
export function SqlDialog({
  title,
  busy = false,
  role = 'dialog',
  className = '',
  onClose,
  children,
}: {
  title: string;
  busy?: boolean;
  role?: 'dialog' | 'alertdialog';
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const dialog = useRef<HTMLDialogElement>(null);
  const origin = useRef<HTMLSpanElement>(null),
    [host, setHost] = useState<HTMLElement | null>(null);
  // Leave collapsing menus, while retaining the workbench's fonts and SQL tokens.
  useLayoutEffect(() => {
    setHost(origin.current?.closest<HTMLElement>('.mw') ?? getOverlayRoot() ?? document.body);
  }, []);
  useEffect(() => {
    dialog.current?.showModal();
  }, [host]);
  return (
    <>
      <span ref={origin} hidden />
      {host &&
        createPortal(
          <dialog
            ref={dialog}
            role={role}
            className={`${common.dialog} ${styles.dialog} ${className}`}
            aria-label={title}
            onCancel={(event) => {
              event.preventDefault();
              if (!busy) onClose();
            }}
          >
            <header className={common.dialogHead}>
              <h2>{title}</h2>
              <button
                type="button"
                className="fouc-action"
                disabled={busy}
                aria-label={tConnector('close', { p0: String(title) })}
                onClick={onClose}
              >
                <X size={18} />
              </button>
            </header>
            {children}
          </dialog>,
          host,
        )}
    </>
  );
}
export function SaveSqlDialog({
  base,
  sql,
  database,
  schema,
  library,
  file,
  onClose,
  onSaved,
}: {
  base: string;
  sql: string;
  database: string;
  schema: string | null;
  library: SavedSqlLibrary | null;
  file: Pick<SavedSqlDocument, 'id' | 'name' | 'folderId' | 'version'> | null;
  onClose: () => void;
  onSaved: (document: SavedSqlDocument) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [name, setName] = useState(file?.name ?? tConnector('defaultQueryFilename')),
    [folder, setFolder] = useState(file?.folderId ?? ''),
    [saveAs, setSaveAs] = useState(false);
  const [busy, setBusy] = useState(false),
    [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  async function save() {
    setBusy(true);
    setError('');
    try {
      onSaved(
        await backendFetch<SavedSqlDocument>(
          `${base}/files${file && !saveAs ? `/${file.id}` : ''}`,
          {
            method: file && !saveAs ? 'PUT' : 'POST',
            body: JSON.stringify({
              name,
              folderId: folder || null,
              database,
              schema,
              sql,
              ...(file && !saveAs ? { version: file.version } : {}),
            }),
          },
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SqlDialog title={tConnector('saveSqlFile')} busy={busy} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) void save();
        }}
      >
        <div className={common.formBody}>
          <label>
            {tConnector('filename')}
            <input
              aria-label={tConnector('sqlFileName')}
              value={name}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            {tConnector('saveFolder')}
            <select
              aria-label={tConnector('sqlSaveFolder')}
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
            >
              <option value="">{tConnector('rootFolder')}</option>
              {library?.folders.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {sqlFolderPath(library.folders, entry.id)}
                </option>
              ))}
            </select>
          </label>
          {file && (
            <label className={common.checkbox}>
              <input
                type="checkbox"
                checked={saveAs}
                onChange={(event) => setSaveAs(event.target.checked)}
              />
              {tConnector('saveAsANewFile')}
            </label>
          )}
          <small>
            {tConnector('database')}
            {database || tConnector('default')}
            {schema && schema !== database ? ` / ${schema}` : ''}
            {tConnector('fullSql')}
            {new TextEncoder().encode(sql).length.toLocaleString(locale)}
            {tConnector('bytes')}
          </small>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </div>
        <footer className={common.dialogFooter}>
          <button type="button" className={common.secondary} disabled={busy} onClick={onClose}>
            {tConnector('cancel')}
          </button>
          <span />
          <button type="submit" className={common.primary} disabled={busy || !name.trim()}>
            {busy ? tConnector('saving') : tConnector('confirmSqlSave')}
          </button>
        </footer>
      </form>
    </SqlDialog>
  );
}
