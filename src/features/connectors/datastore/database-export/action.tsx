'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './action.messages';
import { useState } from 'react';
import { FileArrowDown } from '@phosphor-icons/react/dist/csr/FileArrowDown';
import type { DatabaseObjectInfo, RelationalSession } from '@fouc/shared';
import type { DatabaseExportTableTarget } from '@fouc/shared/database-export';
import { SqlDialog } from '../sql-library-dialog';
import { DatabaseExportPanel } from './panel';
import styles from './database-export-action.module.css';
interface Props {
  session: RelationalSession;
  schemas: string[];
  schema: string;
  table: string;
  tables: DatabaseObjectInfo[];
  disabled: boolean;
}
interface ExportSource {
  schemas: string[];
  currentSchema: string;
  currentTable: DatabaseExportTableTarget[];
  tables: DatabaseExportTableTarget[];
}
export function DatabaseExportAction({ session, schemas, schema, table, tables, disabled }: Props) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [source, setSource] = useState<ExportSource | null>(null);
  const base = `/api/database/relational/sessions/${encodeURIComponent(session.id)}`;
  function open() {
    const targets = tables
      .filter((object) => ['table', 'view', 'materialized_view'].includes(object.kind))
      .map((object) => ({ schema: object.schema ?? schema, table: object.name }));
    const currentTable = targets.filter(
      (target) => target.schema === schema && target.table === table,
    );
    setSource({ schemas: [...schemas], currentSchema: schema, currentTable, tables: targets });
  }
  return (
    <>
      <button
        type="button"
        aria-label={tConnector('exportDatabaseAndFullTableData')}
        title={tConnector('nativeStructureFullTableDataReadOnlyStreamingExport')}
        disabled={disabled || !schemas.length}
        onClick={open}
      >
        <FileArrowDown size={15} />
        <span>{tConnector('nativeExport')}</span>
      </button>
      {source && (
        <SqlDialog
          title={tConnector('databaseAndFullTableExport')}
          className={styles.dialog}
          onClose={() => setSource(null)}
        >
          <div className={styles.body}>
            <DatabaseExportPanel
              base={base}
              provider={session.provider}
              database={session.database}
              schemas={source.schemas}
              tables={source.tables}
              initialSchemas={
                source.currentSchema ? [source.currentSchema] : source.schemas.slice(0, 1)
              }
              initialTables={source.currentTable}
              onClose={() => setSource(null)}
            />
          </div>
        </SqlDialog>
      )}
    </>
  );
}
