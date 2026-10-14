'use client';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './resource-tree-object.messages';
import { useId, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Columns3,
  Eye,
  Grid2X2,
  KeyRound,
  Zap,
  Network,
  List,
} from 'lucide-react';
import type { DatabaseObjectInfo, RelationalTableStructure } from '@fouc/shared';
import { Button } from '@/components/ui/button';
import type { StructureTab } from './structure-metadata';
import { useSqlResource } from './use-sql-resource';
import styles from './resource-tree.module.css';
const sections = (locale?: Locale) => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    { key: 'columns', label: tConnector('field'), icon: List },
    { key: 'indexes', label: tConnector('indexes'), icon: KeyRound },
    { key: 'foreignKeys', label: tConnector('foreignKeys'), icon: Network },
    { key: 'triggers', label: tConnector('triggers'), icon: Zap },
  ] as const;
};
type Section = ReturnType<typeof sections>[number]['key'];
type Props = {
  base: string;
  schema: string;
  entry: DatabaseObjectInfo;
  revision: number;
  selected: boolean;
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onStructure?: (table: string, section: StructureTab, record?: string) => void;
};
export function ResourceTreeObject({
  base,
  schema,
  entry,
  revision,
  selected,
  expanded,
  disabled,
  onToggle,
  onOpen,
  onStructure,
}: Props) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const id = useId();
  const [requested, setRequested] = useState(expanded);
  const [openSections, setOpenSections] = useState<ReadonlySet<Section>>(new Set());
  const [retry, setRetry] = useState(0);
  // Keep a visited object's catalog loaded while its rows are collapsed.
  if (expanded && !requested) setRequested(true);
  const resource = useSqlResource<RelationalTableStructure>(
    requested && onStructure
      ? `${base}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(entry.name)}/structure`
      : null,
    undefined,
    revision + retry,
  );
  const structure = resource.error ? null : resource.data;
  const ObjectIcon = entry.kind === 'table' ? Grid2X2 : Eye;
  function toggleSection(section: Section) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }
  return (
    <div data-resource-object={entry.name}>
      <div
        className={`${styles.row} ${styles.table} fouc-action`}
        data-selected={selected}
        data-active={selected}
      >
        <button
          type="button"
          className={`${styles.chevron} fouc-action`}
          data-variant="disclosure"
          aria-label={tConnector('objects', {
            p0: String(expanded ? tConnector('collapse') : tConnector('expand')),
            p1: String(entry.name),
          })}
          disabled={disabled}
          aria-expanded={expanded}
          aria-controls={`${id}-structure`}
          onClick={onToggle}
        >
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </button>
        <button
          type="button"
          className={`${styles.tableName} fouc-action`}
          data-variant="disclosure"
          disabled={disabled}
          onClick={onOpen}
        >
          <ObjectIcon
            size={15}
            className={entry.kind === 'table' ? styles.tableIcon : styles.viewIcon}
          />
          <span title={entry.name}>{entry.name}</span>
        </button>
      </div>
      {expanded && onStructure ? (
        <div
          id={`${id}-structure`}
          aria-label={tConnector('structureCatalog', { p0: String(entry.name) })}
          aria-busy={resource.busy}
        >
          {resource.error ? (
            <div className={styles.catalogError} role="status">
              <span title={resource.error}>{tConnector('couldNotReadStructure')}</span>
              <Button variant="ghost" size="sm" onClick={() => setRetry((value) => value + 1)}>
                {tConnector('retry')}
              </Button>
            </div>
          ) : (
            sections(locale).map((section) => {
              const open = openSections.has(section.key),
                records = structure?.[section.key];
              return (
                <div key={section.key}>
                  <div className={`${styles.row} ${styles.section} fouc-action`}>
                    <button
                      type="button"
                      className={`${styles.chevron} fouc-action`}
                      data-variant="disclosure"
                      disabled={disabled}
                      aria-label={`${open ? tConnector('collapse') : tConnector('expand')} ${entry.name} ${section.label}`}
                      aria-expanded={open}
                      aria-controls={`${id}-${section.key}`}
                      onClick={() => toggleSection(section.key)}
                    >
                      {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </button>
                    <button
                      type="button"
                      className={`${styles.tableName} fouc-action`}
                      data-variant="disclosure"
                      disabled={disabled}
                      aria-label={tConnector('viewStructureFor', {
                        p0: String(entry.name),
                        p1: String(section.label),
                      })}
                      onClick={() => onStructure(entry.name, section.key)}
                    >
                      <section.icon size={15} className={styles[section.key]} />
                      <span>{section.label}</span>
                      <small aria-label={tConnector('count', { p0: String(section.label) })}>
                        {records?.length ?? '—'}
                      </small>
                    </button>
                  </div>
                  {open ? (
                    <div
                      id={`${id}-${section.key}`}
                      aria-label={tConnector('list', {
                        p0: String(entry.name),
                        p1: String(section.label),
                      })}
                    >
                      {!structure ? (
                        <div
                          className={styles.catalogLoading}
                          role="status"
                          aria-label={tConnector('reading', { p0: String(section.label) })}
                        >
                          <i />
                          <i />
                          <i />
                        </div>
                      ) : records?.length === 0 ? (
                        <p className={styles.emptySection}>
                          {tConnector('noneYet')}
                          {section.label}
                        </p>
                      ) : (
                        <CatalogRows
                          structure={structure}
                          section={section.key}
                          disabled={disabled}
                          onOpen={(record) => onStructure(entry.name, section.key, record)}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
function CatalogRows({
  structure,
  section,
  disabled,
  onOpen,
}: {
  structure: RelationalTableStructure;
  section: Section;
  disabled: boolean;
  onOpen: (record: string) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  if (section === 'columns')
    return structure.columns.map((column) => {
      const nullable = column.isNullable ? tConnector('nullable') : tConnector('isNotNull'),
        label = `${column.name} (${column.dataType}) · ${nullable}`;
      const Icon = column.isPrimaryKey ? KeyRound : Columns3;
      return (
        <button
          key={column.name}
          type="button"
          disabled={disabled}
          className={`${styles.row} ${styles.catalogRow} fouc-action`}
          aria-label={tConnector('viewColumnIn', {
            p0: String(structure.table),
            p1: String(label),
          })}
          title={`${label}${column.isPrimaryKey ? tConnector('primaryKey') : column.isUnique ? tConnector('unique') : ''}${column.comment ? ` · ${column.comment}` : ''}`}
          onClick={() => onOpen(column.name)}
        >
          <Icon size={14} className={column.isPrimaryKey ? styles.indexes : styles.fieldIcon} />
          <span className={styles.fieldText}>
            <strong>{column.name}</strong>
            <small>({column.dataType})</small>
          </span>
          <span className={styles.nullability} data-required={!column.isNullable}>
            {nullable}
          </span>
        </button>
      );
    });
  const records =
    section === 'indexes'
      ? structure.indexes.map((index) => ({
          name: index.name,
          detail: index.parts
            .filter((part) => part.role === 'key')
            .map((part) => part.column ?? part.expression ?? tConnector('expression'))
            .join(', '),
          badge: index.primary
            ? tConnector('primaryKey965')
            : index.unique
              ? tConnector('unique980')
              : '',
        }))
      : section === 'foreignKeys'
        ? structure.foreignKeys.map((key) => ({
            name: key.name,
            detail: `${key.columns.join(', ')} → ${key.referencedSchema}.${key.referencedTable} (${key.referencedColumns.join(', ')})`,
            badge: '',
          }))
        : structure.triggers.map((trigger) => ({
            name: trigger.name,
            detail: `${trigger.timing} ${trigger.events.join(' / ')}`,
            badge: '',
          }));
  const Icon = section === 'indexes' ? KeyRound : section === 'foreignKeys' ? Network : Zap;
  return records.map((record) => (
    <button
      key={record.name}
      type="button"
      className={`${styles.row} ${styles.catalogRow} fouc-action`}
      disabled={disabled}
      aria-label={tConnector('view', {
        p0: String(structure.table),
        p1: String(sections(locale).find((item) => item.key === section)?.label),
        p2: String(record.name),
      })}
      title={`${record.name}${record.detail ? ` · ${record.detail}` : ''}${record.badge ? ` · ${record.badge}` : ''}`}
      onClick={() => onOpen(record.name)}
    >
      <Icon size={14} className={styles[section]} />
      <span className={styles.catalogName}>{record.name}</span>
      {record.badge ? <small className={styles.catalogBadge}>{record.badge}</small> : null}
    </button>
  ));
}
