'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './source.messages';
import { useRef } from 'react';
import { useAppAlert } from '@/components/app-alert-provider';
import type { EditorView } from '@codemirror/view';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import type { DatabaseAdminObjectSource } from '@fouc/shared/database-admin-objects';
import type { RelationalProvider } from '@fouc/shared';
import { SqlEditor } from '../sql-editor';
import styles from './admin-objects.module.css';
export function AdminObjectSource({
  source,
  name,
  label,
  provider,
}: {
  source: DatabaseAdminObjectSource;
  name: string;
  label: string;
  provider: RelationalProvider;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const editor = useRef<EditorView | null>(null);
  const { notify } = useAppAlert();
  const available = source.text !== null && source.complete;
  async function copy() {
    if (!available) return;
    try {
      await navigator.clipboard.writeText(source.text!);
      notify('success', tConnector('sqlCopied'));
    } catch {
      notify('error', tConnector('clipboardAccessIsUnavailableSelectTheSourceInTheEditor'));
    }
  }
  function download() {
    if (!available) return;
    const url = URL.createObjectURL(new Blob([source.text!], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${name}.sql`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('success', tConnector('sqlFileGenerated'));
  }
  return (
    <section className={styles.source} aria-label={label}>
      <div className={styles.sourceToolbar}>
        <span>
          {source.origin === 'native'
            ? tConnector('nativeSource')
            : source.origin === 'reconstructed'
              ? tConnector('declarationReconstructedFromMetadata')
              : tConnector('unknownSource')}
          {source.bytes !== null && (
            <small>
              {source.bytes.toLocaleString(locale)} bytes
              {source.complete ? '' : tConnector('fragment')}
            </small>
          )}
        </span>
        <button
          type="button"
          disabled={!available}
          aria-label={tConnector('copy', { p0: String(label) })}
          onClick={() => void copy()}
        >
          <Copy size={13} />
          {tConnector('copySql')}
        </button>
        <button
          type="button"
          disabled={!available}
          aria-label={tConnector('download', { p0: String(label) })}
          onClick={download}
        >
          <DownloadSimple size={13} />
          {tConnector('download271')}
        </button>
      </div>
      {source.text !== null ? (
        <div className={styles.editor}>
          <SqlEditor
            value={source.text}
            onChange={() => {}}
            onRun={() => {}}
            editorRef={editor}
            provider={provider}
            readOnly
            label={tConnector('source', { p0: String(label) })}
          />
        </div>
      ) : (
        <p className={styles.empty}>
          {tConnector('theNativeCatalogDoesNotProvideThisSourceOrThe')}
        </p>
      )}
      {source.warning && (
        <p className={styles.warning}>
          <Warning size={14} />
          {source.warning}
        </p>
      )}
    </section>
  );
}
