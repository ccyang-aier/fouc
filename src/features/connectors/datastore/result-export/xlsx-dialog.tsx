'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './xlsx-dialog.messages';
import { useRef, useState } from 'react';
import type { DatabaseQueryResult } from '@fouc/shared';
import { Button } from '@/components/ui/button';
import { useAppAlert } from '@/components/app-alert-provider';
import { SqlDialog } from '../sql-library-dialog';
import common from '../relational.module.css';
import { buildResultXlsx } from './xlsx';
const connectorUiMessages = createUiMessages(connectorMessages);
export function XlsxExportDialog({
  result,
  title,
  selectedRows,
  selectedColumns,
  onClose,
}: {
  result: DatabaseQueryResult;
  title: string;
  selectedRows?: readonly number[];
  selectedColumns?: readonly number[];
  onClose: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [filename, setFilename] = useState(title),
    [headers, setHeaders] = useState(true),
    [busy, setBusy] = useState(false),
    [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const saving = useRef(false),
    { notify } = useAppAlert();
  const rows = selectedRows ?? result.rows.map((_, index) => index),
    columns = selectedColumns ?? result.columns.map((_, index) => index);
  async function download() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const bytes = await buildResultXlsx(result, title, rows, columns, headers, locale),
        url = URL.createObjectURL(
          new Blob([bytes], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
        );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${filename.trim() || title}.xlsx`.replace(
        /[<>:"/\\|?*\u0000-\u001f]/g,
        '_',
      );
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('success', tConnector('xlsxFileGenerated'));
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? uiFailure(reason)
          : connectorUiMessages.message('couldNotExportXlsx'),
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <SqlDialog title={tConnector('exportXlsx')} busy={busy} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void download();
        }}
      >
        <div className={common.formBody}>
          <label>
            {tConnector('filename')}
            <input
              autoFocus
              aria-label={tConnector('xlsxFilename')}
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              disabled={busy}
            />
          </label>
          <label className={common.checkbox}>
            <input
              type="checkbox"
              checked={headers}
              onChange={(event) => setHeaders(event.target.checked)}
              disabled={busy}
            />
            {tConnector('includeColumnNames')}
          </label>
          <small>
            {tConnector('currentlyLoadedData')}
            {rows.length}
            {tConnector('rows')}
            {columns.length}
            {tConnector('columns')}
          </small>
          {error && (
            <p role="alert" style={{ color: 'var(--err-ink)' }}>
              {error}
            </p>
          )}
        </div>
        <footer className={common.dialogFooter}>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {tConnector('cancel')}
          </Button>
          <Button type="submit" loading={busy}>
            {tConnector('exportXlsx')}
          </Button>
        </footer>
      </form>
    </SqlDialog>
  );
}
