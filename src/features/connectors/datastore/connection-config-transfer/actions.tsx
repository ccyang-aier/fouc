'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './actions.messages';
import { useState } from 'react';
import { DotsThree, DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ExistingTransferConnection } from '@fouc/shared/connection-config-transfer-plan';
import type { TransferConnectionConfig } from '@fouc/shared/connection-config-transfer';
import { ExportConnectionDialog } from './export-dialog';
import { ImportConnectionDialog } from './import-dialog';
import styles from './transfer.module.css';
export function ConnectionConfigTransferActions({
  provider,
  connections,
  selectedIds = [],
  onImported,
  disabled = false,
}: {
  provider: TransferConnectionConfig['provider'];
  connections: readonly ExistingTransferConnection[];
  selectedIds?: readonly string[];
  onImported: () => void;
  disabled?: boolean;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [exportSnapshot, setExportSnapshot] = useState<ExistingTransferConnection[] | null>(null),
    [importing, setImporting] = useState(false);
  const current = connections.filter((entry) => entry.config.provider === provider);
  const selected = current.filter((entry) => selectedIds.includes(entry.id));
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={styles.more}
            aria-label={tConnector('connectionConfigurationActions')}
            disabled={disabled}
          >
            <DotsThree size={19} weight="bold" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-0 w-max whitespace-nowrap">
          <DropdownMenuItem onSelect={() => setImporting(true)}>
            <UploadSimple size={14} />
            {tConnector('importConnectionConfigurations')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!current.length}
            onSelect={() => setExportSnapshot(selected.length ? selected : current)}
          >
            <DownloadSimple size={14} />
            {selected.length
              ? tConnector('exportSelectedConfigurations', { p0: String(selected.length) })
              : tConnector('exportConnectionConfigurations')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {exportSnapshot && (
        <ExportConnectionDialog
          connections={exportSnapshot}
          onClose={() => setExportSnapshot(null)}
        />
      )}
      {importing && (
        <ImportConnectionDialog onClose={() => setImporting(false)} onImported={onImported} />
      )}
    </>
  );
}
