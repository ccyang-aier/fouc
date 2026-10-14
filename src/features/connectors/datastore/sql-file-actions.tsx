'use client';

import { uiText, type UiMessage, uiFailure } from '../i18n/ui-message';

import { useTranslation, createTranslator, getLocale } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-file-actions.messages';
const translateConnector = createTranslator(connectorMessages);
import { useEffect, useRef, useState } from 'react';
import {
  DownloadSimple,
  FolderOpen,
  CheckCircle,
  CircleNotch,
  FileSql,
  WarningCircle,
} from '@phosphor-icons/react';
import { SQL_FILE_MAX_BYTES, type RelationalProvider } from '@fouc/shared';
import type { EditorView } from '@codemirror/view';
import { SqlEditor } from './sql-editor';
import { SqlDialog } from './sql-library-dialog';
import {
  downloadSqlFile,
  formatSqlFileSize,
  readBrowserSqlFile,
  type OpenSqlFile,
  type SqlFileEncoding,
} from './sql-files';
import common from './relational.module.css';
import styles from './sql-file-actions.module.css';
type Props = {
  provider: RelationalProvider;
  disabled: boolean;
  getDocument: () => {
    sql: string;
    title: string;
  } | null;
  onOpen: (files: OpenSqlFile[]) => void;
  onNotice: (message: string) => void;
};
export function SqlFileActions({ provider, disabled, getDocument, onOpen, onNotice }: Props) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const input = useRef<HTMLInputElement>(null),
    reader = useRef<AbortController | null>(null),
    editor = useRef<EditorView | null>(null);
  const [files, setFiles] = useState<File[]>([]),
    [encoding, setEncoding] = useState<SqlFileEncoding>('auto');
  const [decoded, setDecoded] = useState<OpenSqlFile[]>([]),
    [index, setIndex] = useState(0),
    [errorStored, setError] = useState<UiMessage>(''),
    [busy, setBusy] = useState(false);
  const error = uiText(errorStored, locale);
  useEffect(() => {
    const controller = new AbortController();
    reader.current = controller;
    if (!files.length) return () => controller.abort();
    void (async () => {
      const items: OpenSqlFile[] = [];
      for (const file of files)
        items.push(await readBrowserSqlFile(file, encoding, controller.signal));
      if (!controller.signal.aborted) setDecoded(items);
    })()
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? uiFailure(reason) : String(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [files, encoding]);
  function prepareRead() {
    reader.current?.abort();
    setBusy(true);
    setDecoded([]);
    setError('');
  }
  function close() {
    reader.current?.abort();
    setFiles([]);
    setDecoded([]);
    setError('');
    setBusy(false);
  }
  const preview = decoded[index],
    partial = (preview?.sql.length ?? 0) > 16000;
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".sql"
        multiple
        hidden
        aria-label={tConnector('openSqlFiles')}
        onChange={(event) => {
          const selected = [...(event.target.files ?? [])];
          event.target.value = '';
          if (!selected.length) return;
          if (selected.length > 20) {
            onNotice(translateConnector('openAtMostSqlFilesAtATime'));
            return;
          }
          if (selected.reduce((bytes, file) => bytes + file.size, 0) > SQL_FILE_MAX_BYTES) {
            onNotice(translateConnector('sqlFilesInOneBatchMustTotalNoMoreThan'));
            return;
          }
          prepareRead();
          setIndex(0);
          setFiles(selected);
        }}
      />
      <button
        type="button"
        className="fouc-action"
        aria-label={tConnector('importSqlFiles')}
        title={tConnector('openLocalSqlFilesLoadIntoQueryTabsOnly')}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <FolderOpen />
      </button>
      <button
        type="button"
        className="fouc-action"
        aria-label={tConnector('downloadSqlFile')}
        title={tConnector('downloadTheFullCurrentDocumentAsUtfSql')}
        disabled={disabled}
        onClick={() => {
          const document = getDocument();
          if (!document) return;
          try {
            downloadSqlFile(document.sql, document.title);
            onNotice(translateConnector('fullSqlDocumentDownloadedAsUtf'));
          } catch (reason) {
            onNotice(reason instanceof Error ? uiText(reason, getLocale()) : String(reason));
          }
        }}
      >
        <DownloadSimple />
      </button>
      {files.length > 0 && (
        <SqlDialog title={tConnector('openSqlFiles')} className={styles.dialog} onClose={close}>
          <div className={styles.body}>
            <div className={styles.intro}>
              <FileSql size={24} />
              <div>
                <strong>{tConnector('openScriptsInTheCurrentConnection')}</strong>
                <p>{tConnector('eachFileOpensInASeparateQueryTabChooseThe')}</p>
              </div>
            </div>
            <div className={styles.controls}>
              <label>
                {tConnector('fileEncoding')}
                <select
                  aria-label={tConnector('sqlFileEncoding')}
                  value={encoding}
                  onChange={(event) => {
                    const next = event.target.value as SqlFileEncoding;
                    if (next !== encoding) {
                      prepareRead();
                      setEncoding(next);
                    }
                  }}
                >
                  <option value="auto">{tConnector('detectBomUtfAutomatically')}</option>
                  <option value="utf-8">UTF-8</option>
                  <option value="utf-16le">UTF-16 LE</option>
                  <option value="utf-16be">UTF-16 BE</option>
                  <option value="gb18030">GB18030 / GBK</option>
                </select>
              </label>
              <small>
                {files.length}
                {tConnector('filesUpToMibEach')}
              </small>
            </div>
            <div className={styles.files} role="list" aria-label={tConnector('sqlFilesToOpen')}>
              {files.map((file, position) => (
                <button
                  type="button"
                  role="listitem"
                  key={position}
                  data-active={index === position}
                  onClick={() => setIndex(position)}
                >
                  <FileSql size={15} />
                  <span>{file.name}</span>
                  <small>{formatSqlFileSize(file.size)}</small>
                  {decoded[position] && <CheckCircle size={14} />}
                </button>
              ))}
            </div>
            {busy ? (
              <p className={styles.loading} role="status">
                <CircleNotch size={16} className="mw-spin" />
                {tConnector('readingAndValidatingOriginalFiles')}
              </p>
            ) : error ? (
              <p className={styles.error} role="alert">
                <WarningCircle size={16} />
                {error}
              </p>
            ) : (
              preview && (
                <>
                  <div className={styles.previewHead}>
                    <strong>{tConnector('originalContentPreview')}</strong>
                    <span>
                      {preview.encoding.toUpperCase()} ·{' '}
                      {partial ? tConnector('firstCharacters') : tConnector('fullFile')}
                    </span>
                  </div>
                  <div className={styles.preview}>
                    <SqlEditor
                      key={`${index}:${encoding}`}
                      provider={provider}
                      value={preview.sql.slice(0, 16000)}
                      editorRef={editor}
                      readOnly
                      label={tConnector('sqlFileContentPreview')}
                      onRun={() => {}}
                      onChange={() => {}}
                    />
                  </div>
                  <small className={styles.note}>
                    {partial
                      ? tConnector('thePreviewIsTruncatedTheFullOriginalFileIsKept')
                      : tConnector('originalSqlContentIsPreservedWithoutFormattingOrReplacement')}
                    {tConnector('eachExecutionSupportsUpToMibSelectPartOfA')}
                  </small>
                </>
              )
            )}
          </div>
          <footer className={`${common.dialogFooter} ${styles.footer}`}>
            <small>
              {tConnector('currentConnection')}
              {provider === 'postgres' ? 'PostgreSQL' : provider === 'mysql' ? 'MySQL' : 'SQLite'}
            </small>
            <button type="button" className={common.secondary} onClick={close}>
              {tConnector('cancel')}
            </button>
            <button
              type="button"
              className={common.primary}
              disabled={busy || Boolean(error) || decoded.length !== files.length || disabled}
              onClick={() => {
                try {
                  onOpen(decoded);
                  close();
                } catch (reason) {
                  setError(reason instanceof Error ? uiFailure(reason) : String(reason));
                }
              }}
            >
              {tConnector('open')}
              {files.length}
              {tConnector('queryTabs')}
            </button>
          </footer>
        </SqlDialog>
      )}
    </>
  );
}
