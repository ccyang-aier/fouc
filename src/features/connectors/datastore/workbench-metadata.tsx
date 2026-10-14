'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './workbench-metadata.messages';
import type { ReactNode } from 'react';
import { Table, Toolbox } from '@phosphor-icons/react';
import { WorkbenchMenu } from './workbench-menu';
import styles from './dbx-workbench.module.css';
import menuStyles from './data-tools-menu.module.css';
export function WorkbenchMetadata({
  table,
  schema,
  columnCount,
  structureAction,
  onProperties,
  propertiesOpen,
  pending,
  tools,
  generateAction,
  importAction,
  onGridHeader,
  onGridTools,
  onExportTools,
  onEditTools,
}: {
  table: string;
  schema: string;
  columnCount: number;
  structureAction: ReactNode;
  onProperties: () => void;
  pending: boolean;
  propertiesOpen: boolean;
  generateAction: ReactNode;
  importAction: ReactNode;
  tools: ReactNode;
  onGridHeader: (node: HTMLSpanElement | null) => void;
  onGridTools: (node: HTMLDivElement | null) => void;
  onExportTools: (node: HTMLDivElement | null) => void;
  onEditTools: (node: HTMLDivElement | null) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  return (
    <div className={styles.metadata}>
      <div className={styles.objectIdentity} aria-label={tConnector('currentDataTable')}>
        <span className={styles.qualifiedName}>
          {table && <span title={tConnector('currentSchema')}>{schema}.</span>}
          <strong title={table}>{table || tConnector('chooseADataTable')}</strong>
        </span>
        {table && (
          <span
            className={styles.columnCount}
            title={tConnector('totalNumberOfColumnsInTheDataTable')}
          >
            {columnCount}
            {tConnector('field')}
          </span>
        )}
      </div>
      <div className={styles.metadataActions}>
        <span
          ref={onGridHeader}
          className={`${styles.gridHeaderSlot} ${styles.commandGroup}`}
          role="group"
          aria-label={tConnector('gridDisplay')}
        />
        <div
          className={styles.commandGroup}
          role="group"
          aria-label={tConnector('tableStructureAndTools')}
        >
          {structureAction}
          <button
            type="button"
            className="fouc-action"
            title={tConnector('tableProperties')}
            data-workbench-panel-trigger
            aria-expanded={propertiesOpen}
            disabled={pending || !table}
            onClick={onProperties}
          >
            <Table size={16} />
            {tConnector('tableProperties')}
          </button>
          <WorkbenchMenu
            label={tConnector('dataTools')}
            icon={<Toolbox size={16} />}
            disabled={pending || !table}
          >
            <h3 className={menuStyles.title}>{tConnector('dataTools')}</h3>
            {generateAction}
            {importAction}
            <div ref={onExportTools} className={menuStyles.exportSlot} />
            <details className={menuStyles.advanced}>
              <summary>{tConnector('moreActions')}</summary>
              <div>
                {tools}
                <div ref={onEditTools} />
              </div>
            </details>
          </WorkbenchMenu>
          <div ref={onGridTools} className={menuStyles.viewSlot} />
        </div>
      </div>
    </div>
  );
}
