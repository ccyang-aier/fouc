'use client';

import { useState } from 'react';
import { DotsThree, DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ExistingTransferConnection } from '@fouc/shared/connection-config-transfer-plan';
import type { TransferConnectionConfig } from '@fouc/shared/connection-config-transfer';
import { ExportConnectionDialog } from './export-dialog';
import { ImportConnectionDialog } from './import-dialog';
import styles from './transfer.module.css';

export function ConnectionConfigTransferActions({
  workspaceId,
  provider,
  connections,
  selectedIds = [],
  onImported,
  disabled = false,
}: {
  workspaceId: string;
  provider: TransferConnectionConfig['provider'];
  connections: readonly ExistingTransferConnection[];
  selectedIds?: readonly string[];
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
  const selected = current.filter(entry => selectedIds.includes(entry.id));
  return (
    <>
      <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className={styles.more} aria-label="连接配置操作" disabled={disabled}><DotsThree size={19} weight="bold" /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setImporting(true)}><UploadSimple size={14} />导入连接配置</DropdownMenuItem>
          <DropdownMenuItem disabled={!current.length} onSelect={() => setExportSnapshot(selected.length ? selected : current)}><DownloadSimple size={14} />{selected.length ? `导出所选配置（${selected.length}）` : '导出连接配置'}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
