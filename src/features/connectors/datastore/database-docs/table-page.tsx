import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './table-page.messages';
import {
  databaseDocsGroupColor,
  type DatabaseDocsEdit,
  type DatabaseDocsSnapshot,
  type DatabaseDocsTable,
} from '@fouc/shared/database-docs';
import { DocsNoteEditor } from './note-editor';
import { DocsRelationships } from './relationships';
import styles from './database-docs.module.css';
export function DocsTablePage({
  table,
  snapshot,
  editable,
  saving,
  onSave,
  onSelect,
  onOpenTable,
}: {
  table: DatabaseDocsTable;
  snapshot: DatabaseDocsSnapshot;
  editable: boolean;
  saving: boolean;
  onSave: (edit: DatabaseDocsEdit) => Promise<void>;
  onSelect: (key: string) => void;
  onOpenTable?: (schema: string, table: string) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const structure = table.structure,
    group = snapshot.groups.find((group) => group.id === table.groupId),
    target = { schema: structure.schema, table: structure.table };
  return (
    <article className={styles.tablePage}>
      <header className={styles.tableHeader}>
        <div>
          <span className={styles.eyebrow}>
            {structure.schema} / {structure.kind.replace('_', ' ')}
          </span>
          <h2>{structure.table}</h2>
          <div className={styles.tableMeta}>
            <span>
              {structure.columns.length}
              {tConnector('field')}
            </span>
            <span>
              {structure.indexes.length}
              {tConnector('indexes')}
            </span>
            <span>
              {structure.foreignKeys.length}
              {tConnector('foreignKeys')}
            </span>
            {group && (
              <span
                className={styles.groupBadge}
                style={{
                  color: databaseDocsGroupColor(group.hue),
                  borderColor: databaseDocsGroupColor(group.hue),
                }}
              >
                {group.name}
              </span>
            )}
          </div>
        </div>
        {onOpenTable && (
          <button
            className={styles.secondary}
            onClick={() => onOpenTable(structure.schema, structure.table)}
          >
            {tConnector('openNativeObject')}
          </button>
        )}
      </header>
      {editable && (
        <label className={styles.assignment}>
          {tConnector('colorGroups')}
          <select
            aria-label={tConnector('tableDocumentationGroup')}
            value={table.groupId ?? ''}
            disabled={saving}
            onChange={(event) => {
              void onSave({
                kind: 'table-group',
                ...target,
                groupId: event.target.value || null,
              }).catch(() => undefined);
            }}
          >
            <option value="">{tConnector('ungrouped')}</option>
            {snapshot.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <DocsNoteEditor
        label={tConnector('tableDescription')}
        note={table.note}
        editable={editable}
        saving={saving}
        onSave={(note) => onSave({ kind: 'table-note', ...target, note })}
      />
      <section className={styles.columnsSection}>
        <h3>
          {tConnector('columnsAndMarkdownNotes')}
          <small>{structure.columns.length}</small>
        </h3>
        <div className={styles.columnList}>
          {structure.columns.map((column) => (
            <div key={column.name} className={styles.column}>
              <header>
                <code>{column.name}</code>
                <code className={styles.type}>{column.dataType}</code>
                <span>{column.isPrimaryKey ? 'PK' : column.isUnique ? 'UNIQUE' : ''}</span>
                <small>{column.isNullable ? 'NULL' : 'NOT NULL'}</small>
              </header>
              {column.columnDefault !== null && (
                <div className={styles.columnDefault}>
                  DEFAULT <code>{column.columnDefault}</code>
                </div>
              )}
              {column.enumValues?.length ? (
                <div className={styles.columnDefault}>
                  ENUM{' '}
                  {column.enumValues.map((value) => (
                    <code key={value}>{JSON.stringify(value)}</code>
                  ))}
                </div>
              ) : null}
              <DocsNoteEditor
                label={tConnector('descriptionForColumn', { p0: String(column.name) })}
                note={table.columnNotes[column.name]}
                editable={editable}
                saving={saving}
                onSave={(note) =>
                  onSave({ kind: 'column-note', ...target, column: column.name, note })
                }
              />
            </div>
          ))}
        </div>
      </section>
      <DocsRelationships table={table} snapshot={snapshot} onSelect={onSelect} />
      <section className={styles.nativeMetadata}>
        <h3>{tConnector('nativeStructureDetails')}</h3>
        {structure.indexes.map((index) => (
          <details key={`index:${index.name}`}>
            <summary>
              <span>INDEX</span>
              <strong>{index.name}</strong>
              <small>
                {index.method}
                {index.primary ? ' · PRIMARY' : index.unique ? ' · UNIQUE' : ''}
              </small>
            </summary>
            <pre>{JSON.stringify(index, null, 2)}</pre>
          </details>
        ))}
        {structure.constraints.map((constraint) => (
          <details key={`constraint:${constraint.name}`}>
            <summary>
              <span>{constraint.kind.toUpperCase()}</span>
              <strong>{constraint.name}</strong>
            </summary>
            <pre>{constraint.definition ?? JSON.stringify(constraint, null, 2)}</pre>
          </details>
        ))}
        {structure.triggers.map((trigger) => (
          <details key={`trigger:${trigger.name}`}>
            <summary>
              <span>TRIGGER</span>
              <strong>{trigger.name}</strong>
              <small>
                {trigger.timing} {trigger.events.join(' / ')}
              </small>
            </summary>
            <pre>{trigger.definition}</pre>
          </details>
        ))}
        <details>
          <summary>
            <span>DDL</span>
            <strong>{tConnector('completeOriginalDefinition')}</strong>
            <small>{structure.definition.origin}</small>
          </summary>
          <pre>{structure.definition.sql}</pre>
        </details>
        <details>
          <summary>
            <span>CATALOG</span>
            <strong>{tConnector('nativeProperties')}</strong>
          </summary>
          <dl className={styles.properties}>
            {Object.entries(structure.properties).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value ?? tConnector('unknown')}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>
    </article>
  );
}
