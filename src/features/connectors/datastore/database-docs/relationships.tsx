import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './relationships.messages';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import type { DatabaseDocsSnapshot, DatabaseDocsTable } from '@fouc/shared/database-docs';
import styles from './database-docs.module.css';
export function DocsRelationships({
  table,
  snapshot,
  onSelect,
}: {
  table: DatabaseDocsTable;
  snapshot: DatabaseDocsSnapshot;
  onSelect: (key: string) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const outgoing = snapshot.relationships.filter(
      (relationship) => relationship.from.tableKey === table.key,
    ),
    incoming = snapshot.relationships.filter(
      (relationship) => relationship.to.tableKey === table.key,
    );
  return (
    <section className={styles.relationships}>
      <h3>
        {tConnector('bidirectionalForeignKeyRelationships')}
        <small>{outgoing.length + incoming.length}</small>
      </h3>
      {(
        [
          ['out', tConnector('referencesOtherTables'), outgoing],
          ['in', tConnector('referencedByOtherTables'), incoming],
        ] as const
      ).map(([direction, label, rows]) => (
        <div key={direction}>
          <div className={styles.subHeading}>{label}</div>
          {rows.length ? (
            rows.map((relationship) => {
              const target = direction === 'out' ? relationship.to : relationship.from;
              return (
                <button
                  key={relationship.id}
                  className={styles.relationshipRow}
                  disabled={!relationship.resolved}
                  onClick={() => onSelect(target.tableKey)}
                >
                  <div>
                    <strong>
                      {target.schema}.{target.table}
                    </strong>
                    <small>{relationship.name}</small>
                  </div>
                  <span>
                    <code>{relationship.from.columns.join(', ')}</code>
                    <ArrowRight size={12} />
                    <code>{relationship.to.columns.join(', ')}</code>
                  </span>
                  <small>
                    {relationship.cardinality === 'one-to-one' ? '1:1' : 'N:1'}
                    {relationship.nullable ? tConnector('nullable') : ''}
                    <br />
                    {relationship.resolved
                      ? `UPDATE ${relationship.onUpdate} · DELETE ${relationship.onDelete}`
                      : tConnector('theTargetWasNotConfirmedInTheCurrentSnapshot')}
                  </small>
                </button>
              );
            })
          ) : (
            <p className={styles.emptyNote}>
              {tConnector('theNativeCatalogRecordsNoForeignKeysInThisDirection')}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
