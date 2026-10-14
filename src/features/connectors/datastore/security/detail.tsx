'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './detail.messages';
import { useMemo, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import {
  databaseRolePaths,
  type DatabasePrincipal,
  type DatabaseSecurityDetail,
  type DatabaseSecurityDirectory,
} from '@fouc/shared/database-security';
import styles from './security.module.css';
export function DatabasePrincipalDetail({
  principal,
  directory,
  detail,
  busy,
  error,
}: {
  principal: DatabasePrincipal;
  directory: DatabaseSecurityDirectory;
  detail: DatabaseSecurityDetail | null;
  busy: boolean;
  error: string;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const flagLabels = {
    login: tConnector('flagLogin'),
    superuser: tConnector('flagSuperuser'),
    createDatabase: tConnector('flagCreateDatabase'),
    createRole: tConnector('flagCreateRole'),
    inherit: tConnector('flagInherit'),
    replication: tConnector('flagReplication'),
    bypassRls: tConnector('flagBypassRls'),
    locked: tConnector('flagLocked'),
    passwordExpired: tConnector('flagPasswordExpired'),
  };
  const [tab, setTab] = useState<'attributes' | 'roles' | 'privileges'>('attributes');
  const [search, setSearch] = useState('');
  const paths = useMemo(
    () => databaseRolePaths(directory, principal.id),
    [directory, principal.id],
  );
  const principals = useMemo(
    () => new Map(directory.principals.map((item) => [item.id, item])),
    [directory],
  );
  const members = directory.memberships.filter((item) => item.roleId === principal.id);
  const privileges =
    detail?.privileges.filter((item) =>
      `${item.scope} ${item.schema ?? ''} ${item.object ?? ''} ${item.column ?? ''} ${item.privilege}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? [];
  return (
    <section className={styles.detail} aria-label={tConnector('databaseAccountDetails')}>
      <header className={styles.principalHead}>
        <span className={styles.avatar}>{principal.name.slice(0, 1).toUpperCase() || '@'}</span>
        <div>
          <h3>{principal.name || tConnector('anonymousAccount')}</h3>
          <p>
            {principal.host !== null
              ? `@${principal.host} · ${principal.authentication ?? tConnector('authenticationPluginUnknown')}`
              : tConnector('roleOid', { p0: String(principal.id) })}
          </p>
        </div>
      </header>
      <nav className={styles.tabs} aria-label={tConnector('accountDetailCategories')}>
        {(
          [
            ['attributes', tConnector('nativeProperties')],
            ['roles', tConnector('roleRelationships')],
            ['privileges', tConnector('objectPermissions')],
          ] as const
        ).map(([id, label]) => (
          <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
            {id === 'roles' && <span>{paths.length}</span>}
            {id === 'privileges' && detail && (
              <span>
                {detail.privileges.length}
                {detail.privilegesTruncated ? '+' : ''}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className={styles.detailBody}>
        {tab === 'attributes' && (
          <>
            <dl className={styles.attributes}>
              {Object.entries(principal.flags).map(([key, value]) => (
                <div key={key}>
                  <dt>
                    {Object.hasOwn(flagLabels, key)
                      ? flagLabels[key as keyof typeof flagLabels]
                      : key}
                  </dt>
                  <dd data-state={value === null ? 'unknown' : value ? 'yes' : 'no'}>
                    {value === null
                      ? tConnector('unknown')
                      : value
                        ? tConnector('yes')
                        : tConnector('no')}
                  </dd>
                </div>
              ))}
              {principal.connectionLimit !== null && (
                <div>
                  <dt>{tConnector('connectionLimit')}</dt>
                  <dd>
                    {principal.connectionLimit === '-1'
                      ? tConnector('noNativeLimit')
                      : principal.connectionLimit}
                  </dd>
                </div>
              )}
              <div>
                <dt>{tConnector('expiration')}</dt>
                <dd>{principal.validUntil ?? tConnector('unspecifiedNotDisclosed')}</dd>
              </div>
            </dl>
            <p className={styles.note}>
              {tConnector('attributesComeFromTheCurrentNativeCatalogAttributeValuesAnd')}
            </p>
          </>
        )}
        {tab === 'roles' && (
          <>
            <div className={styles.sectionHeading}>
              <strong>{tConnector('memberOfRoles')}</strong>
              <span>
                {tConnector('declaredPath')}
                {paths.length}
                {tConnector('items')}
              </span>
            </div>
            {paths.length ? (
              paths.map((path) => (
                <article className={styles.role} key={path.principal.id}>
                  <strong>
                    {path.principal.name}
                    {path.principal.host !== null ? `@${path.principal.host}` : ''}
                  </strong>
                  <div className={styles.path}>
                    {path.path.map((id, index) => (
                      <span key={id}>
                        {index > 0 && <ArrowRight size={11} />} {principals.get(id)?.name ?? id}
                      </span>
                    ))}
                  </div>
                  <small>
                    {path.edges.length === 1
                      ? tConnector('directMembers')
                      : tConnector('relationshipLevels', { p0: String(path.edges.length) })}{' '}
                    · ADMIN{' '}
                    {path.edges.at(-1)?.admin === null
                      ? tConnector('unknown')
                      : path.edges.at(-1)?.admin
                        ? tConnector('yes')
                        : tConnector('no')}{' '}
                    · INHERIT{' '}
                    {path.edges.at(-1)?.inherit === null
                      ? tConnector('unknown')
                      : path.edges.at(-1)?.inherit
                        ? tConnector('yes')
                        : tConnector('no')}{' '}
                    · SET{' '}
                    {path.edges.at(-1)?.setRole === null
                      ? tConnector('unknown')
                      : path.edges.at(-1)?.setRole
                        ? tConnector('yes')
                        : tConnector('no')}
                  </small>
                </article>
              ))
            ) : (
              <p className={styles.empty}>{tConnector('theVisibleCatalogReturnedNoParentRoles')}</p>
            )}
            <div className={styles.sectionHeading}>
              <strong>{tConnector('directMembers')}</strong>
              <span>
                {members.length}
                {tConnector('items')}
              </span>
            </div>
            {members.length ? (
              members.map((item, index) => (
                <div className={styles.member} key={`${item.memberId}:${index}`}>
                  <strong>
                    {principals.get(item.memberId)?.name ??
                      tConnector('membersOutsideTheCatalogScope')}
                  </strong>
                  <span>
                    ADMIN{' '}
                    {item.admin === null
                      ? tConnector('unknown')
                      : item.admin
                        ? tConnector('yes')
                        : tConnector('no')}
                  </span>
                </div>
              ))
            ) : (
              <p className={styles.empty}>
                {tConnector('theVisibleCatalogReturnedNoDirectMembers')}
              </p>
            )}
            <p className={styles.note}>
              {tConnector('pathsShowTheShortestVisibleRelationshipsWithoutExpandingCyclesRepeated')}
            </p>
          </>
        )}
        {tab === 'privileges' && (
          <>
            <label className={styles.search}>
              {tConnector('filterObjectsOrPermissions')}
              <input
                aria-label={tConnector('filterDatabasePermissions')}
                value={search}
                placeholder={tConnector('selectSchemaOrTableName')}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            {busy && (
              <p className={styles.empty} role="status">
                {tConnector('readingNativePermissions')}
              </p>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            {detail?.issues.map((issue, index) => (
              <p className={styles.error} role="alert" key={index}>
                {issue.message}
              </p>
            ))}
            {detail && (
              <>
                <div className={styles.sectionHeading}>
                  <strong>
                    {directory.provider === 'mysql'
                      ? tConnector('visibleExplicitGrants')
                      : tConnector('nativeEffectivePermissionChecks')}
                  </strong>
                  <span>{detail.schema ?? tConnector('instanceDatabaseScope')}</span>
                </div>
                <div className={styles.privileges}>
                  <table>
                    <thead>
                      <tr>
                        <th>{tConnector('scopeObject')}</th>
                        <th>{tConnector('permission')}</th>
                        <th>{tConnector('grantOption')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {privileges.map((item, index) => (
                        <tr key={index}>
                          <td>
                            <small>{item.scope}</small>
                            <span
                              title={[item.schema, item.object, item.column]
                                .filter(Boolean)
                                .join('.')}
                            >
                              {[item.schema, item.object, item.column].filter(Boolean).join('.') ||
                                tConnector('instance')}
                            </span>
                          </td>
                          <td>{item.privilege}</td>
                          <td>
                            {item.grantable === null
                              ? tConnector('notExpanded')
                              : item.grantable
                                ? tConnector('grantable')
                                : tConnector('no')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!privileges.length && (
                  <p className={styles.empty}>
                    {tConnector('noMatchingVisiblePermissionsPermissionsNotReturnedRemainUnknown')}
                  </p>
                )}
                {detail.warnings.map((message) => (
                  <p className={styles.note} key={message}>
                    {message}
                  </p>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
