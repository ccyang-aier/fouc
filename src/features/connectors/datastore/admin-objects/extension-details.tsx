'use client'

import { useState } from 'react'
import { Warning } from '@phosphor-icons/react/dist/csr/Warning'
import type { DatabaseAdminObjectRows, PostgresExtensionDetails, PostgresExtensionMember, PostgresExtensionDependency } from '@fouc/shared/database-admin-objects'
import { AdminObjectSource } from './source'
import styles from './admin-objects.module.css'

const yesNo = (value: boolean | null) => value === null ? '未知' : value ? '是' : '否'
function Coverage({ rows }: { rows: Pick<DatabaseAdminObjectRows<unknown>, 'items' | 'complete' | 'hasMore' | 'limit' | 'error'> }) {
  return <p className={styles.coverage} data-incomplete={!rows.complete}>
    {rows.error ? `此分区不可读取：${rows.error}` : rows.hasMore ? `仅展示前 ${rows.limit} 项，原生目录还有更多记录。` : rows.complete ? `已读取 ${rows.items.length} 项原生目录记录。` : '读取完整度未知。'}
  </p>
}
function MemberRows({ rows, dependencies = false }: { rows: DatabaseAdminObjectRows<PostgresExtensionMember | PostgresExtensionDependency>; dependencies?: boolean }) {
  return <>
    <Coverage rows={rows} />
    {rows.items.length ? <div className={styles.tableViewport}>
      <table className={styles.metadataTable}>
        <thead><tr>{dependencies && <th>关系</th>}<th>原生对象</th><th>类型 / Schema</th><th>目录标识</th></tr></thead>
        <tbody>{rows.items.map((row, position) => <tr key={`${row.catalog}:${row.oid}:${row.subId}:${position}`}>
          {dependencies && <td>{'direction' in row ? row.direction === 'requires' ? '扩展依赖' : '依赖此扩展' : '未知'}<small>{'dependencyType' in row ? row.dependencyType : ''}</small></td>}
          <td><code>{row.identity ?? row.name ?? '对象描述未知'}</code></td>
          <td>{row.objectType ?? '未知'}<small>{row.schema ?? '非 Schema 对象'}</small></td>
          <td><code>{row.catalog}</code><small>OID {row.oid}{row.subId ? ` · sub ${row.subId}` : ''}</small></td>
        </tr>)}</tbody>
      </table>
    </div> : !rows.error && <p className={styles.empty}>原生目录没有返回此类记录。</p>}
  </>
}

export function PostgresExtensionDetailsView({ details }: { details: PostgresExtensionDetails }) {
  const [tab, setTab] = useState<'overview' | 'versions' | 'members' | 'dependencies' | 'source'>('overview')
  const installed = details.installed
  return <>
    <header className={styles.detailHeader}>
      <div><span className={styles.kind}>POSTGRESQL EXTENSION</span><h3>{details.name}</h3><code>{installed?.schema ?? '当前数据库可安装目录'}</code></div>
      <span className={styles.status} data-tone={installed ? 'success' : 'neutral'}>{installed ? `已安装 ${installed.version}` : '未安装'}</span>
    </header>
    <nav className={styles.detailTabs} aria-label="扩展详情类型">
      {([['overview', '概览'], ['versions', '版本'], ['members', '安装成员'], ['dependencies', '原生依赖'], ['source', '元数据 SQL']] as const).map(([key, label]) =>
        <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}{key === 'versions' && <small>{details.versions.items.length}</small>}</button>)}
    </nav>
    <div className={styles.detailContent}>
      {tab === 'overview' && <>
        {details.comment && <p className={styles.comment}>{details.comment}</p>}
        <dl className={styles.properties}>
          {([
            ['已安装版本', installed?.version ?? '未安装'], ['默认可安装版本', details.defaultVersion],
            ['导出对象 Schema', installed?.schema ?? null], ['扩展所有者', installed?.owner ?? null],
            ['可迁移 Schema', installed ? yesNo(installed.relocatable) : '未安装'],
            ['原生扩展 OID', installed?.oid ?? null], ['当前角色', details.permissions.currentUser],
            ['角色是 superuser', yesNo(details.permissions.superuser)], ['数据库 CREATE 权限', yesNo(details.permissions.databaseCreate)],
          ] as Array<[string, string | null]>).map(([label, value]) => <div key={label}><dt>{label}</dt><dd data-unknown={value === null}>{value ?? '未知 / 未提供'}</dd></div>)}
        </dl>
        {details.permissions.error && <p className={styles.warning}><Warning size={14} />角色权限分区不可读取：{details.permissions.error}</p>}
        <p className={styles.scopeNote}>扩展名称在当前数据库内唯一。Schema 是扩展导出对象的位置，不把同目录的其他对象视为成员。</p>
      </>}
      {tab === 'versions' && <>
        <Coverage rows={details.versions} />
        {details.versions.items.length ? <div className={styles.tableViewport}>
          <table className={styles.metadataTable}>
            <thead><tr><th>版本</th><th>已安装</th><th>Trusted</th><th>需 Superuser</th><th>Relocatable</th><th>固定 Schema</th><th>要求的扩展</th></tr></thead>
            <tbody>{details.versions.items.map(version => <tr key={version.version}>
              <td><code>{version.version}</code>{version.version === details.defaultVersion && <small>默认</small>}</td>
              <td>{yesNo(version.installed)}</td><td>{yesNo(version.trusted)}</td><td>{yesNo(version.superuser)}</td>
              <td>{yesNo(version.relocatable)}</td><td>{version.requiredSchema ?? (details.versionColumns.includes('schema') ? '无固定要求' : '未知')}</td>
              <td><code>{version.requires === null ? '未知' : version.requires.length ? version.requires.join(', ') : '无'}</code></td>
            </tr>)}</tbody>
          </table>
        </div> : !details.versions.error && <p className={styles.empty}>服务器未提供此扩展的可安装版本控制文件。</p>}
      </>}
      {tab === 'members' && (installed ? <MemberRows rows={details.members} /> : <p className={styles.empty}>此扩展尚未安装，没有当前数据库的安装成员。</p>)}
      {tab === 'dependencies' && (installed ? <MemberRows rows={details.dependencies} dependencies /> : <p className={styles.empty}>此扩展尚未安装；版本要求可在“版本”中查看。</p>)}
      {tab === 'source' && <AdminObjectSource source={details.source} name={`${details.name}.metadata`} label="扩展元数据 SQL" provider="postgres" />}
      <div className={styles.notices}>{details.warnings.map(warning => <p key={warning}>{warning}</p>)}</div>
    </div>
  </>
}
