'use client';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './extension-details.messages';
import { useState } from 'react';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import type {
  DatabaseAdminObjectRows,
  PostgresExtensionDetails,
  PostgresExtensionMember,
  PostgresExtensionDependency,
} from '@fouc/shared/database-admin-objects';
import { AdminObjectSource } from './source';
import styles from './admin-objects.module.css';
const yesNo = (value: boolean | null, locale?: Locale) => {
  const tConnector = createTranslator(connectorMessages, locale);
  return value === null ? tConnector('unknown') : value ? tConnector('yes') : tConnector('no');
};
function Coverage({
  rows,
}: {
  rows: Pick<
    DatabaseAdminObjectRows<unknown>,
    'items' | 'complete' | 'hasMore' | 'limit' | 'error'
  >;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  return (
    <p className={styles.coverage} data-incomplete={!rows.complete}>
      {rows.error
        ? tConnector('cannotReadThisSection', { p0: String(rows.error) })
        : rows.hasMore
          ? tConnector('onlyTheFirstItemsAreShownTheNativeCatalogContains', {
              p0: String(rows.limit),
            })
          : rows.complete
            ? tConnector('readNativeCatalogRecords', { p0: String(rows.items.length) })
            : tConnector('readCompletenessIsUnknown')}
    </p>
  );
}
function MemberRows({
  rows,
  dependencies = false,
}: {
  rows: DatabaseAdminObjectRows<PostgresExtensionMember | PostgresExtensionDependency>;
  dependencies?: boolean;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  return (
    <>
      <Coverage rows={rows} />
      {rows.items.length ? (
        <div className={styles.tableViewport}>
          <table className={styles.metadataTable}>
            <thead>
              <tr>
                {dependencies && <th>{tConnector('relationship')}</th>}
                <th>{tConnector('nativeObject')}</th>
                <th>{tConnector('typeSchema')}</th>
                <th>{tConnector('catalogIdentifier')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.items.map((row, position) => (
                <tr key={`${row.catalog}:${row.oid}:${row.subId}:${position}`}>
                  {dependencies && (
                    <td>
                      {'direction' in row
                        ? row.direction === 'requires'
                          ? tConnector('extensionDependencies')
                          : tConnector('dependsOnThisExtension')
                        : tConnector('unknown')}
                      <small>{'dependencyType' in row ? row.dependencyType : ''}</small>
                    </td>
                  )}
                  <td>
                    <code>
                      {row.identity ?? row.name ?? tConnector('unknownObjectDescription')}
                    </code>
                  </td>
                  <td>
                    {row.objectType ?? tConnector('unknown')}
                    <small>{row.schema ?? tConnector('objectWithoutASchema')}</small>
                  </td>
                  <td>
                    <code>{row.catalog}</code>
                    <small>
                      OID {row.oid}
                      {row.subId ? ` · sub ${row.subId}` : ''}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !rows.error && (
          <p className={styles.empty}>
            {tConnector('theNativeCatalogReturnedNoRecordsOfThisType')}
          </p>
        )
      )}
    </>
  );
}
export function PostgresExtensionDetailsView({ details }: { details: PostgresExtensionDetails }) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [tab, setTab] = useState<'overview' | 'versions' | 'members' | 'dependencies' | 'source'>(
    'overview',
  );
  const installed = details.installed;
  return (
    <>
      <header className={styles.detailHeader}>
        <div>
          <span className={styles.kind}>{tConnector('postgresqlExtension')}</span>
          <h3>{details.name}</h3>
          <code>{installed?.schema ?? tConnector('availableCatalogForTheCurrentDatabase')}</code>
        </div>
        <span className={styles.status} data-tone={installed ? 'success' : 'neutral'}>
          {installed
            ? tConnector('installed', { p0: String(installed.version) })
            : tConnector('notInstalled')}
        </span>
      </header>
      <nav className={styles.detailTabs} aria-label={tConnector('extensionDetailType')}>
        {(
          [
            ['overview', tConnector('overview')],
            ['versions', tConnector('version')],
            ['members', tConnector('installationMembers')],
            ['dependencies', tConnector('nativeDependencies')],
            ['source', tConnector('metadataSql')],
          ] as const
        ).map(([key, label]) => (
          <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>
            {label}
            {key === 'versions' && <small>{details.versions.items.length}</small>}
          </button>
        ))}
      </nav>
      <div className={styles.detailContent}>
        {tab === 'overview' && (
          <>
            {details.comment && <p className={styles.comment}>{details.comment}</p>}
            <dl className={styles.properties}>
              {(
                [
                  [
                    tConnector('installedVersion'),
                    installed?.version ?? tConnector('notInstalled'),
                  ],
                  [tConnector('defaultAvailableVersion'), details.defaultVersion],
                  [tConnector('exportedObjectSchema'), installed?.schema ?? null],
                  [tConnector('extensionOwner'), installed?.owner ?? null],
                  [
                    tConnector('relocatableSchema'),
                    installed ? yesNo(installed.relocatable, locale) : tConnector('notInstalled'),
                  ],
                  [tConnector('nativeExtensionOid'), installed?.oid ?? null],
                  [tConnector('currentRole'), details.permissions.currentUser],
                  [tConnector('roleIsASuperuser'), yesNo(details.permissions.superuser, locale)],
                  [
                    tConnector('databaseCreatePermission'),
                    yesNo(details.permissions.databaseCreate, locale),
                  ],
                ] as Array<[string, string | null]>
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd data-unknown={value === null}>{value ?? tConnector('unknownNotProvided')}</dd>
                </div>
              ))}
            </dl>
            {details.permissions.error && (
              <p className={styles.warning}>
                <Warning size={14} />
                {tConnector('cannotReadRolePermissions')}
                {details.permissions.error}
              </p>
            )}
            <p className={styles.scopeNote}>
              {tConnector('extensionNamesAreUniqueWithinTheCurrentDatabaseTheSchema')}
            </p>
          </>
        )}
        {tab === 'versions' && (
          <>
            <Coverage rows={details.versions} />
            {details.versions.items.length ? (
              <div className={styles.tableViewport}>
                <table className={styles.metadataTable}>
                  <thead>
                    <tr>
                      <th>{tConnector('version')}</th>
                      <th>{tConnector('installed222')}</th>
                      <th>Trusted</th>
                      <th>{tConnector('requiresSuperuser')}</th>
                      <th>Relocatable</th>
                      <th>{tConnector('fixedSchema')}</th>
                      <th>{tConnector('requiredExtensions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.versions.items.map((version) => (
                      <tr key={version.version}>
                        <td>
                          <code>{version.version}</code>
                          {version.version === details.defaultVersion && (
                            <small>{tConnector('default')}</small>
                          )}
                        </td>
                        <td>{yesNo(version.installed, locale)}</td>
                        <td>{yesNo(version.trusted, locale)}</td>
                        <td>{yesNo(version.superuser, locale)}</td>
                        <td>{yesNo(version.relocatable, locale)}</td>
                        <td>
                          {version.requiredSchema ??
                            (details.versionColumns.includes('schema')
                              ? tConnector('noFixedRequirement')
                              : tConnector('unknown'))}
                        </td>
                        <td>
                          <code>
                            {version.requires === null
                              ? tConnector('unknown')
                              : version.requires.length
                                ? version.requires.join(', ')
                                : tConnector('none')}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !details.versions.error && (
                <p className={styles.empty}>
                  {tConnector('theServerDidNotProvideInstallableVersionControlFilesFor')}
                </p>
              )
            )}
          </>
        )}
        {tab === 'members' &&
          (installed ? (
            <MemberRows rows={details.members} />
          ) : (
            <p className={styles.empty}>
              {tConnector('thisExtensionIsNotInstalledSoItHasNoInstallation')}
            </p>
          ))}
        {tab === 'dependencies' &&
          (installed ? (
            <MemberRows rows={details.dependencies} dependencies />
          ) : (
            <p className={styles.empty}>
              {tConnector('thisExtensionIsNotInstalledSeeVersionsForVersionRequirements')}
            </p>
          ))}
        {tab === 'source' && (
          <AdminObjectSource
            source={details.source}
            name={`${details.name}.metadata`}
            label={tConnector('extensionMetadataSql')}
            provider="postgres"
          />
        )}
        <div className={styles.notices}>
          {details.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      </div>
    </>
  );
}
