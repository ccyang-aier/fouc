'use client';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './workbench-tabs.messages';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  BookOpenText,
  Database,
  FileCode,
  Network,
  Grid2X2,
  Plus,
  Activity,
  PanelsTopLeft,
  X,
} from 'lucide-react';
import { WorkbenchMenu } from './workbench-menu';
import { navigateWorkbenchTabs } from './workbench-tab-navigation';
import styles from './dbx-workbench.module.css';
export type WorkbenchMode =
  'data' | 'structure' | 'sql' | 'objects' | 'diagram' | 'docs' | 'activity';
const views = (locale?: Locale) => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    { mode: 'data', label: tConnector('browseData'), icon: Grid2X2 },
    { mode: 'sql', label: tConnector('sqlQuery'), icon: FileCode },
    { mode: 'objects', label: tConnector('schemaObjects'), icon: Database },
    { mode: 'diagram', label: tConnector('relationshipDiagram'), icon: Network },
    { mode: 'docs', label: tConnector('databaseDocumentation'), icon: BookOpenText },
    { mode: 'activity', label: tConnector('activityMonitor'), icon: Activity },
  ] as const;
};
export function WorkbenchViewMenu({
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange: (mode: WorkbenchMode) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  return (
    <WorkbenchMenu
      label={tConnector('workbenchView')}
      icon={<PanelsTopLeft size={16} />}
      disabled={disabled}
    >
      {views(locale).map(({ mode, label, icon: Icon }) => (
        <button
          key={mode}
          type="button"
          role="menuitem"
          className="fouc-menu-item"
          onClick={() => onChange(mode)}
        >
          <Icon size={15} />
          {label}
        </button>
      ))}
    </WorkbenchMenu>
  );
}
export function WorkbenchShortcuts({
  mode,
  disabled,
  onChange,
}: {
  mode: WorkbenchMode;
  disabled: boolean;
  onChange: (mode: WorkbenchMode) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  return (
    <nav className={styles.shortcuts} aria-label={tConnector('databaseWorkbenchFeatures')}>
      {views(locale)
        .filter((view) => view.mode !== 'data' && view.mode !== 'sql')
        .map(({ mode: value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            className="fouc-action"
            disabled={disabled}
            aria-pressed={mode === value}
            onClick={() => onChange(value)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
    </nav>
  );
}
function WorkbenchTab({
  label,
  icon,
  selected,
  disabled,
  closeLabel,
  onSelect,
  onClose,
}: {
  label: string;
  icon: ReactNode;
  selected: boolean;
  disabled: boolean;
  closeLabel?: string;
  onSelect: () => void;
  onClose?: () => void;
}) {
  return (
    <div
      role="tab"
      aria-label={label}
      aria-selected={selected}
      aria-disabled={disabled}
      tabIndex={selected && !disabled ? 0 : -1}
      className={`${styles.objectTab} fouc-action`}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      onKeyDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !disabled &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      {icon}
      <span title={label}>{label}</span>
      {onClose && (
        <button
          type="button"
          className={`${styles.tabClose} fouc-action`}
          data-variant="nested"
          disabled={disabled}
          aria-label={closeLabel}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
export function WorkbenchTabs({
  table,
  schema,
  mode,
  openedViews,
  disabled,
  sqlReady,
  onChange,
  onCloseTable,
  onCloseView,
  onNewQuery,
  onSqlTabsTarget,
}: {
  table: string;
  schema: string;
  mode: WorkbenchMode;
  openedViews: WorkbenchMode[];
  disabled: boolean;
  sqlReady: boolean;
  onChange: (mode: WorkbenchMode) => void;
  onCloseTable: () => void;
  onCloseView: (mode: WorkbenchMode) => void;
  onNewQuery: () => void;
  onSqlTabsTarget: (target: HTMLDivElement | null) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const dataActive = mode === 'data' || mode === 'structure';
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reveal = () =>
      list.current
        ?.querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const observer = new ResizeObserver(reveal);
    if (list.current) observer.observe(list.current);
    reveal();
    return () => observer.disconnect();
  }, [mode, table]);
  return (
    <div className={styles.tabs} aria-label={tConnector('workObjectTabs')}>
      <div
        ref={list}
        className={styles.tabItems}
        role="tablist"
        aria-label={tConnector('workbenchPage')}
        onKeyDown={(event) => {
          if (!disabled) navigateWorkbenchTabs(event);
        }}
      >
        <WorkbenchTab
          label={table ? `${table}@${schema}` : tConnector('browseData')}
          icon={<Grid2X2 size={15} className={styles.tableIcon} />}
          selected={dataActive}
          disabled={disabled}
          onSelect={() => onChange('data')}
          closeLabel={tConnector('closeDataTable', { p0: String(table) })}
          onClose={table ? onCloseTable : undefined}
        />
        <div ref={onSqlTabsTarget} className={styles.sqlTabsSlot} />
        {openedViews
          .filter((value) => value !== 'sql')
          .map((value) => {
            const view = views(locale).find((item) => item.mode === value);
            return view ? (
              <WorkbenchTab
                key={value}
                label={view.label}
                icon={<view.icon size={15} />}
                selected={mode === value}
                disabled={disabled}
                onSelect={() => onChange(value)}
                closeLabel={tConnector('closeView', { p0: String(view.label) })}
                onClose={() => onCloseView(value)}
              />
            ) : null;
          })}
      </div>
      <div
        className={`${styles.tabActions} ${styles.commandGroup}`}
        role="group"
        aria-label={tConnector('workbenchViewActions')}
      >
        <button
          type="button"
          className="fouc-action"
          aria-label={tConnector('createSqlQuery')}
          title={
            sqlReady
              ? tConnector('createSqlQuery')
              : tConnector('createQueriesAfterSqlDraftsFinishLoading')
          }
          disabled={disabled || !sqlReady}
          onClick={onNewQuery}
        >
          <Plus size={16} />
        </button>
        <WorkbenchViewMenu disabled={disabled} onChange={onChange} />
      </div>
    </div>
  );
}
