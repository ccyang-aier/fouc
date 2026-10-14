'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './table-import-action.messages';
import { useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import type { RelationalProvider, RelationalTablePage } from '@fouc/shared';
import { TableImportPanel } from './table-import';
import { SqlDialog } from './sql-library-dialog';
import styles from './data-tools.module.css';
export function TableImportAction({
  base,
  sessionId,
  provider,
  schema,
  page,
  disabled,
  onImported,
}: {
  base: string;
  sessionId: string;
  provider: RelationalProvider;
  schema: string;
  page: RelationalTablePage | null;
  disabled: boolean;
  onImported: () => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [source, setSource] = useState<{
    schema: string;
    page: RelationalTablePage;
  } | null>(null);
  return (
    <>
      <button
        type="button"
        className="fouc-menu-item"
        aria-label={tConnector('importTableData')}
        title={
          disabled
            ? tConnector('unlockWritesAndFinishStagedChangesFirst')
            : tConnector('appendImportsFromCsvTsvJsonNdjsonAndLiteralInsert')
        }
        disabled={disabled || !page}
        onClick={() => page && setSource({ schema, page })}
      >
        <DownloadSimple size={16} />
        <span>{tConnector('importData')}</span>
      </button>
      {source && (
        <SqlDialog
          title={tConnector('importTableData')}
          className={styles.dialog}
          onClose={() => setSource(null)}
        >
          <div className={styles.body}>
            <TableImportPanel
              provider={provider}
              sessionId={sessionId}
              base={base}
              schema={source.schema}
              table={source.page.table}
              columns={source.page.columns}
              onImported={onImported}
              onClose={() => setSource(null)}
            />
          </div>
        </SqlDialog>
      )}
    </>
  );
}
