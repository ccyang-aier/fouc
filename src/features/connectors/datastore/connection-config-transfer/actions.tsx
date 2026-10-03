'use client';

import { useState } from 'react';
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import type { ExistingTransferConnection } from '@fouc/shared/connection-config-transfer-plan';
import type { TransferConnectionConfig } from '@fouc/shared/connection-config-transfer';
import { ExportConnectionDialog } from './export-dialog';
import { ImportConnectionDialog } from './import-dialog';
import styles from './transfer.module.css';

export function ConnectionConfigTransferActions({
  workspaceId,
  provider,
  connections,
  onImported,
  disabled = false,
}: {
  workspaceId: string;
  provider: TransferConnectionConfig['provider'];
  connections: readonly ExistingTransferConnection[];
  onImported: () => void;
  disabled?: boolean;
}) {
  const [exportSnapshot, setExportSnapshot] = useState<
      ExistingTransferConnection[] | null
    >(null),
    [importing, setImporting] = useState(false);
  const current = connections.filter(
    (entry) =>
      entry.config.provider === provider && entry.workspaceId === workspaceId,
  );
  return (
    <>
      <div className={styles.actions}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setImporting(true)}
        >
          <UploadSimple size={14} />
          导入配置
        </button>
        <button
          type="button"
          disabled={disabled || !current.length}
          onClick={() => setExportSnapshot(current)}
        >
          <DownloadSimple size={14} />
          导出配置
        </button>
      </div>
      {exportSnapshot && (
        <ExportConnectionDialog
          connections={exportSnapshot}
          onClose={() => setExportSnapshot(null)}
        />
      )}
      {importing && (
        <ImportConnectionDialog
          workspaceId={workspaceId}
          onClose={() => setImporting(false)}
          onImported={onImported}
        />
      )}
    </>
  );
}
