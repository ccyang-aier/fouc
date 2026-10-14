'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './inspector.messages';
import { useState } from 'react';
import {
  ArrowSquareOut,
  ArrowsLeftRight,
  Code,
  Copy,
  Key,
  Link,
  Stack,
  Table,
  Warning,
} from '@phosphor-icons/react';
import {
  diagramFieldRelations,
  diagramJoinSql,
  type ErDiagramEdge,
  type ErDiagramModel,
  type ErDiagramNode,
} from '@fouc/shared/er-diagram';
import type { DiagramSelection } from './canvas';
import styles from './diagram.module.css';
interface InspectorProps {
  hidden?: boolean;
  model: ErDiagramModel;
  selection: DiagramSelection;
  onSelect: (selection: DiagramSelection) => void;
  onCopy: (text: string) => void;
  onOpenTable?: (node: ErDiagramNode) => void;
  onOpenQuery?: (sql: string) => void;
}
export function DiagramInspector(props: InspectorProps) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const node = props.model.nodes.find((item) => item.id === props.selection.nodeId),
    edge = props.model.edges.find((item) => item.id === props.selection.edgeId);
  return (
    <aside
      hidden={props.hidden}
      className={styles.inspector}
      aria-label={tConnector('diagramDetails')}
    >
      {edge ? (
        <EdgeInspector {...props} edge={edge} />
      ) : node ? (
        <NodeInspector key={node.id} {...props} node={node} />
      ) : (
        <div className={styles.inspectorEmpty}>
          <Stack size={20} />
          <h3>{tConnector('selectAnObject')}</h3>
          <p>{tConnector('clickATableOrConnectionToInspectColumnsAndConstraints')}</p>
          <div className={styles.legend}>
            <span>
              <b>PK</b>
              {tConnector('primaryKey')}
            </span>
            <span>
              <b>FK</b>
              {tConnector('foreignKeys')}
            </span>
            <span>
              <b>UQ</b>
              {tConnector('uniqueColumn')}
            </span>
            <span>
              <b>N</b>
              {tConnector('multipleRows')}
            </span>
            <span>
              <b>?</b>
              {tConnector('unknownCardinality')}
            </span>
          </div>
          <p className={styles.hint}>
            {tConnector('cardinalityComesFromCompleteUniqueKeysAndColumnNullabilityIt')}
          </p>
        </div>
      )}
    </aside>
  );
}
function NodeInspector({
  model,
  selection,
  node,
  onSelect,
  onOpenTable,
  onCopy,
}: InspectorProps & {
  node: ErDiagramNode;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [filter, setFilter] = useState(''),
    [limit, setLimit] = useState(80);
  const column = node.columns.find((item) => item.name === selection.column),
    rows = node.columns.filter(
      (item) => !filter || item.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase()),
    );
  const relations = column ? diagramFieldRelations(model, node.id, column.name) : [];
  const edges = model.edges.filter((edge) => edge.source === node.id || edge.target === node.id);
  return (
    <>
      <div className={styles.inspectorHead}>
        <Table size={16} />
        <div className={styles.identity}>
          <h3 title={node.schema + '.' + node.table}>{node.table}</h3>
          <p>
            {node.schema} ·{' '}
            {node.external
              ? tConnector('referenceOnly')
              : node.kind === 'view'
                ? tConnector('view')
                : node.kind === 'materialized_view'
                  ? tConnector('materializedView')
                  : tConnector('table')}
          </p>
          {node.comment && <p>{node.comment}</p>}
        </div>
        {!node.external && onOpenTable && (
          <button
            type="button"
            aria-label={tConnector('openObject')}
            title={tConnector('open') + node.schema + '.' + node.table}
            className="fouc-action"
            onClick={() => onOpenTable(node)}
          >
            <ArrowSquareOut size={16} />
          </button>
        )}
      </div>
      {node.external && (
        <p className={styles.callout}>
          <Warning size={16} />
          {tConnector('fullStructureWasNotLoadedForThisObjectOnlyReferenced')}
        </p>
      )}
      {column && (
        <section className={styles.fieldDetail}>
          <div className={styles.sectionLabel}>
            <Key size={14} />
            {tConnector('columnDetails')}
          </div>
          <h4>{column.name}</h4>
          <dl>
            <dt>{tConnector('type')}</dt>
            <dd>{column.dataType ?? tConnector('notLoaded')}</dd>
            <dt>{tConnector('nullable')}</dt>
            <dd>
              {column.nullable === null
                ? tConnector('unknown')
                : column.nullable
                  ? tConnector('yes')
                  : tConnector('no')}
            </dd>
            <dt>{tConnector('key')}</dt>
            <dd>
              {[
                column.primary && tConnector('primaryKey'),
                column.foreign && tConnector('foreignKeys'),
                column.unique && tConnector('unique'),
              ]
                .filter(Boolean)
                .join(' · ') || tConnector('noKnownKey')}
            </dd>
            <dt>{tConnector('generatedColumn')}</dt>
            <dd>
              {node.external
                ? tConnector('unknown')
                : column.generated
                  ? tConnector('yes')
                  : tConnector('no')}
            </dd>
            <dt>{tConnector('defaultValue')}</dt>
            <dd>
              {column.default ??
                (node.external ? tConnector('notLoaded') : tConnector('notDeclared'))}
            </dd>
          </dl>
          {column.comment && <p>{column.comment}</p>}
          <button type="button" className="fouc-action" onClick={() => onCopy(column.name)}>
            <Copy size={13} />
            {tConnector('copyColumnName')}
          </button>
          <div className={styles.sectionLabel}>
            <ArrowsLeftRight size={14} />
            {tConnector('columnRelationships')}
            <b>{relations.length}</b>
          </div>
          {relations.map(({ edge, direction, peer, peerColumns }) => (
            <button
              type="button"
              key={`${edge.id}/${direction}`}
              className={'fouc-action ' + styles.relationItem}
              onClick={() => onSelect({ nodeId: peer?.id, column: peerColumns[0] })}
            >
              <span>
                {direction === 'outgoing' ? tConnector('references') : tConnector('referencedBy')} ·{' '}
                {edge.name}
              </span>
              <b>
                {peer?.schema}.{peer?.table}
              </b>
              <small>{peerColumns.join(', ')}</small>
            </button>
          ))}
          {!relations.length && (
            <p className={styles.hint}>{tConnector('noDeclaredColumnRelationships')}</p>
          )}
        </section>
      )}
      <section className={styles.fields}>
        <div className={styles.sectionLabel}>
          {node.external ? tConnector('referencedColumns') : tConnector('field')}
          <b>{node.columns.length}</b>
        </div>
        <input
          aria-label={tConnector('filterDiagramColumns')}
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setLimit(80);
          }}
          placeholder={tConnector('filterColumns')}
        />
        {rows.slice(0, limit).map((item) => {
          const key = item.primary
            ? 'PK'
            : item.foreign
              ? 'FK'
              : item.unique
                ? 'UQ'
                : item.nullable === false
                  ? 'NN'
                  : '';
          return (
            <button
              type="button"
              key={item.name}
              className={
                'fouc-action ' + (selection.column === item.name ? styles.activeField : '')
              }
              aria-pressed={selection.column === item.name}
              onClick={() => onSelect({ nodeId: node.id, column: item.name })}
            >
              <span>
                <b title={item.name}>{item.name}</b>
                <small title={item.dataType ?? undefined}>
                  {item.dataType ?? tConnector('notLoaded')}
                </small>
              </span>
              <em data-key={key}>{key}</em>
            </button>
          );
        })}
        {rows.length > limit && (
          <button type="button" className="fouc-action" onClick={() => setLimit(limit + 80)}>
            {tConnector('showMoreRemaining')}
            {rows.length - limit}
          </button>
        )}
        {!rows.length && <p className={styles.hint}>{tConnector('noMatchingColumns')}</p>}
      </section>
      <section className={styles.nodeRelations}>
        <div className={styles.sectionLabel}>
          <Link size={14} />
          {tConnector('foreignKeyRelationships')}
          <b>{edges.length}</b>
        </div>
        {edges.map((edge) => (
          <button
            type="button"
            key={edge.id}
            className="fouc-action"
            onClick={() => onSelect({ edgeId: edge.id })}
          >
            {edge.name}
            <span>
              {edge.source === node.id ? tConnector('references') : tConnector('referencedBy')}
            </span>
          </button>
        ))}
        {!edges.length && <p className={styles.hint}>{tConnector('noDeclaredForeignKeys')}</p>}
      </section>
    </>
  );
}
function EdgeInspector({
  model,
  edge,
  onSelect,
  onCopy,
  onOpenQuery,
}: InspectorProps & {
  edge: ErDiagramEdge;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const source = model.nodes.find((node) => node.id === edge.source),
    target = model.nodes.find((node) => node.id === edge.target);
  let sql = '';
  try {
    sql = diagramJoinSql(model, edge.id);
  } catch {
    /* Missing native endpoints disable SQL generation. */
  }
  return (
    <>
      <div className={styles.inspectorHead}>
        <Link size={16} />
        <div className={styles.identity}>
          <h3>{edge.name}</h3>
          <p>
            {tConnector('foreignKey')}
            {edge.nameSource === 'catalog'
              ? tConnector('nativeName')
              : tConnector('metadataIdentifier')}
          </p>
          <p>
            {edge.sourceCardinality === 'many'
              ? tConnector('multipleRows')
              : tConnector('atMostOneRow')}{' '}
            →{' '}
            {edge.targetCardinality === 'unknown'
              ? tConnector('unknownCardinality1000')
              : edge.targetCardinality === 'many'
                ? tConnector('potentiallyMultipleParentRows')
                : edge.nullable
                  ? tConnector('zeroOrOneParentRow')
                  : tConnector('oneParentRow')}
          </p>
        </div>
      </div>
      <section className={styles.fieldDetail}>
        <div className={styles.sectionLabel}>
          {tConnector('compositeColumnMapping')}
          <b>{edge.pairs.length}</b>
        </div>
        <button
          type="button"
          className={'fouc-action ' + styles.endpoint}
          onClick={() => onSelect({ nodeId: source?.id })}
        >
          {source?.schema}.{source?.table}
        </button>
        {edge.pairs.map((pair, index) => (
          <div key={index} className={styles.pair}>
            <button
              type="button"
              className="fouc-action"
              onClick={() => onSelect({ nodeId: source?.id, column: pair.sourceColumn })}
            >
              {pair.sourceColumn}
            </button>
            <span>→</span>
            <button
              type="button"
              className="fouc-action"
              onClick={() => onSelect({ nodeId: target?.id, column: pair.targetColumn })}
            >
              {pair.targetColumn}
            </button>
          </div>
        ))}
        <button
          type="button"
          className={'fouc-action ' + styles.endpoint}
          onClick={() => onSelect({ nodeId: target?.id })}
        >
          {target?.schema}.{target?.table}
          {target?.external ? tConnector('notLoaded958') : ''}
        </button>
      </section>
      <section className={styles.fieldDetail}>
        <div className={styles.sectionLabel}>{tConnector('nativeConstraint')}</div>
        <dl>
          <dt>ON DELETE</dt>
          <dd>{edge.onDelete || tConnector('notProvided')}</dd>
          <dt>ON UPDATE</dt>
          <dd>{edge.onUpdate || tConnector('notProvided')}</dd>
          <dt>MATCH</dt>
          <dd>{edge.match || tConnector('notProvided')}</dd>
          <dt>{tConnector('validated')}</dt>
          <dd>
            {edge.validated === null
              ? tConnector('notProvided')
              : edge.validated
                ? tConnector('yes')
                : tConnector('no')}
          </dd>
          <dt>{tConnector('deferrable')}</dt>
          <dd>
            {edge.deferrable === null
              ? tConnector('notProvided')
              : edge.deferrable
                ? tConnector('yes')
                : tConnector('no')}
          </dd>
          <dt>{tConnector('initiallyDeferred')}</dt>
          <dd>
            {edge.initiallyDeferred === null
              ? tConnector('notProvided')
              : edge.initiallyDeferred
                ? tConnector('yes')
                : tConnector('no')}
          </dd>
        </dl>
        {edge.validated === false && (
          <p className={styles.callout}>
            {tConnector('thisConstraintHasNotBeenValidatedReferentialIntegrityOfExisting')}
          </p>
        )}
        {edge.definition && (
          <details>
            <summary>{tConnector('nativeDefinition')}</summary>
            <pre>{edge.definition}</pre>
          </details>
        )}
      </section>
      <section className={styles.join}>
        <div className={styles.sectionLabel}>
          <Code size={14} />
          {tConnector('relatedQuery')}
        </div>
        {sql ? (
          <>
            <pre aria-label={tConnector('foreignKeyJoinSql')}>{sql}</pre>
            <div>
              <button type="button" className="fouc-action" onClick={() => onCopy(sql)}>
                <Copy size={14} />
                {tConnector('copySql')}
              </button>
              {onOpenQuery && (
                <button type="button" className="fouc-action" onClick={() => onOpenQuery(sql)}>
                  {tConnector('openQuery')}
                </button>
              )}
            </div>
            <p className={styles.hint}>{tConnector('afterOpeningRunTheQueryInTheEditor')}</p>
          </>
        ) : (
          <p className={styles.hint}>
            {tConnector('referencedColumnMetadataIsIncompleteAccurateJoinSqlCannotBe')}
          </p>
        )}
      </section>
    </>
  );
}
