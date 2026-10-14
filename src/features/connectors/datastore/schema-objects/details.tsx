import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './details.messages';
import { useState } from 'react';
import { type SchemaObjectDetails, type SchemaObjectReference } from '@fouc/shared/schema-objects';
import { SchemaSqlSource } from './sql-source';
import styles from './schema-objects.module.css';
const PROPERTY_LABELS = (locale?: Locale): Record<string, string> => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    owner: tConnector('owner'),
    comment: tConnector('comment'),
    created_at: tConnector('created'),
    updated_at: tConnector('modified'),
    timing: tConnector('timing'),
    event: tConnector('event'),
    events: tConnector('event'),
    orientation: tConnector('triggerLevel'),
    enabled: tConnector('enabledStatus'),
    condition: tConnector('triggerCondition'),
    security_type: tConnector('securityMode'),
    security_definer: tConnector('executeAsDefiner'),
    language: tConnector('language'),
    volatility: tConnector('volatility'),
    parallel: tConnector('parallelSafety'),
    strict: tConnector('strictNullHandling'),
    leakproof: tConnector('leakproof'),
    returns_set: tConnector('returnsASet'),
    arguments: tConnector('completeParameterDeclaration'),
    rows: tConnector('estimatedReturnedRows'),
    cost: tConnector('planCost'),
    settings: tConnector('functionLocalSettings'),
    start_value: tConnector('startValue'),
    increment: tConnector('increment'),
    minimum: tConnector('minimum'),
    maximum: tConnector('maximum'),
    cache: tConnector('cacheSize'),
    cycle: tConnector('cycle'),
    last_value: tConnector('currentCacheEndValue'),
    data_type: tConnector('dataType'),
    check_option: tConnector('checkOption'),
    is_updatable: tConnector('updatable'),
    sql_mode: 'SQL Mode',
    is_deterministic: tConnector('deterministic'),
    sql_data_access: tConnector('sqlDataAccess'),
    options: tConnector('catalogOptions'),
    populated: tConnector('populated'),
    tablespace: tConnector('tablespace'),
    size_bytes: tConnector('storageBytes'),
    deferrable: tConnector('deferrableConstraint'),
    initially_deferred: tConnector('initiallyDeferred'),
    action_order: tConnector('triggerOrder'),
  };
};
export function SchemaObjectDetailView({
  details,
  onOpenReference,
}: {
  details: SchemaObjectDetails;
  onOpenReference?: (reference: SchemaObjectReference) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [tab, setTab] = useState<'ddl' | 'body' | 'properties' | 'parameters' | 'references'>(
    'ddl',
  );
  const routine = details.object.kind === 'function' || details.object.kind === 'procedure';
  const tabs: Array<readonly [typeof tab, string]> = [
    ['ddl', 'DDL'],
    ['body', tConnector('body')],
    ['properties', tConnector('property')],
    ...(routine ? [['parameters', tConnector('parameters')] as const] : []),
    ['references', tConnector('references')],
  ];
  const properties = {
    owner: details.object.owner,
    comment: details.object.comment,
    created_at: details.object.createdAt,
    updated_at: details.object.updatedAt,
    ...details.properties,
  };
  return (
    <>
      <header className={styles.detailHeader}>
        <div>
          <span className={styles.kindBadge}>{schemaObjectLabel(details.object.kind, locale)}</span>
          <h3>{details.object.displayName}</h3>
          <code>
            {details.object.schema}
            {details.object.parentName ? ` / ${details.object.parentName}` : ''}
          </code>
        </div>
        <span className={styles.origin}>
          {details.definition.origin === 'native'
            ? tConnector('nativeDefinition')
            : details.definition.origin === 'reconstructed'
              ? tConnector('reconstructedFromNativeCatalog')
              : tConnector('unknownDefinition')}
        </span>
      </header>
      <nav className={styles.detailTabs} aria-label={tConnector('objectMetadataDetails')}>
        {tabs.map(([value, label]) => (
          <button key={value} data-active={tab === value} onClick={() => setTab(value)}>
            {label}
            {value === 'references' && <small>{details.references.length}</small>}
            {value === 'parameters' && <small>{details.parameters.length}</small>}
          </button>
        ))}
      </nav>
      <div className={styles.detailBody}>
        {(tab === 'ddl' || tab === 'body') && (
          <SchemaSqlSource
            key={tab}
            sql={tab === 'ddl' ? details.definition.sql : details.definition.body}
            name={`${details.object.name}${tab === 'body' ? '.body' : ''}`}
            provider={details.provider}
            caption={
              tab === 'ddl'
                ? tConnector('completeDefinition', {
                    p0: String(
                      details.definition.origin === 'native'
                        ? 'NATIVE'
                        : details.definition.origin === 'reconstructed'
                          ? 'CATALOG'
                          : 'UNKNOWN',
                    ),
                  })
                : tConnector('nativeBodyOriginalBody')
            }
          />
        )}
        {tab === 'properties' && (
          <dl className={styles.properties}>
            {Object.entries(properties).map(([name, value]) => (
              <div key={name}>
                <dt>{PROPERTY_LABELS(locale)[name] ?? name}</dt>
                <dd data-unknown={value === null}>{value ?? tConnector('unknown')}</dd>
              </div>
            ))}
          </dl>
        )}
        {tab === 'parameters' && (
          <div className={styles.parameterSection}>
            {details.returnType !== null && (
              <div className={styles.returnType}>
                <span>RETURN</span>
                <code>{details.returnType}</code>
              </div>
            )}
            <table className={styles.parameterTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{tConnector('parameterName')}</th>
                  <th>{tConnector('direction')}</th>
                  <th>{tConnector('nativeType')}</th>
                  <th>{tConnector('defaultValue')}</th>
                </tr>
              </thead>
              <tbody>
                {details.parameters.map((parameter) => (
                  <tr key={parameter.position}>
                    <td>{parameter.position}</td>
                    <td>{parameter.name ?? tConnector('unnamed')}</td>
                    <td>{parameter.mode ?? tConnector('unknown')}</td>
                    <td>
                      <code>{parameter.type ?? tConnector('unknown')}</code>
                    </td>
                    <td>
                      <code>
                        {parameter.hasDefault === false
                          ? '—'
                          : (parameter.defaultValue ??
                            (parameter.hasDefault
                              ? tConnector('defaultActualValueUnknown')
                              : tConnector('unknown')))}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!details.parameters.length && (
              <p className={styles.muted}>{tConnector('theCurrentCatalogReturnedNoParameters')}</p>
            )}
          </div>
        )}
        {tab === 'references' && (
          <div className={styles.referenceSection}>
            <div className={styles.referenceStatus}>
              {details.referencesComplete
                ? tConnector('directNativeCatalogReferencesLoaded')
                : tConnector('partialReferencesUnrecordedDependenciesRemainUnknown')}
            </div>
            {details.references.length ? (
              <table className={styles.parameterTable}>
                <thead>
                  <tr>
                    <th>{tConnector('target')}</th>
                    <th>{tConnector('type')}</th>
                    <th>{tConnector('relationship')}</th>
                  </tr>
                </thead>
                <tbody>
                  {details.references.map((reference, index) => (
                    <tr key={index}>
                      <td>
                        {onOpenReference ? (
                          <button
                            className={styles.referenceLink}
                            onClick={() => onOpenReference(reference)}
                          >
                            {reference.schema ? `${reference.schema}.` : ''}
                            {reference.name}
                            {reference.column ? `.${reference.column}` : ''}
                          </button>
                        ) : (
                          <code>
                            {reference.schema ? `${reference.schema}.` : ''}
                            {reference.name}
                            {reference.column ? `.${reference.column}` : ''}
                          </code>
                        )}
                      </td>
                      <td>{reference.kind}</td>
                      <td>
                        {reference.relation === 'owned-by'
                          ? tConnector('ownedColumn')
                          : reference.relation === 'trigger-target'
                            ? tConnector('triggerTarget')
                            : reference.relation === 'trigger-function'
                              ? tConnector('executionFunction')
                              : tConnector('directDependencies')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={styles.muted}>
                {details.referencesComplete
                  ? tConnector('theNativeCatalogRecordsNoDirectReferences')
                  : tConnector('referencesUnknownDependenciesWereNotInferredFromSqlText')}
              </p>
            )}
          </div>
        )}
      </div>
      {(tab === 'ddl' ? details.definition.warnings : [])
        .concat(details.warnings)
        .map((warning) => (
          <p key={warning} className={styles.notice}>
            {warning}
          </p>
        ))}
    </>
  );
}
import { schemaObjectLabel } from './labels';
