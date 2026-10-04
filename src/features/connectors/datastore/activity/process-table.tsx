'use client';

import { useMemo, useState } from 'react';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { X } from '@phosphor-icons/react/dist/csr/X';
import type { DatabaseActivityProcess, DatabaseActivitySnapshot } from '@fouc/shared/database-activity';
import styles from './activity.module.css';

type SortKey = 'id' | 'user' | 'database' | 'state' | 'ageSeconds';

function compareValues(a: string | null, b: string | null, numeric: boolean): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (numeric && /^-?\d+$/.test(a) && /^-?\d+$/.test(b)) return BigInt(a) < BigInt(b) ? -1 : 1;
  return a.localeCompare(b);
}

export function ActivityProcesses({ snapshot }: { snapshot: DatabaseActivitySnapshot }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'ageSeconds', desc: true });
  const [selected, setSelected] = useState<DatabaseActivityProcess | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const rows = useMemo(() => {
    const needle = search.toLocaleLowerCase();
    const filtered = snapshot.processes.filter(row => !needle || [row.id, row.user, row.database, row.client, row.application, row.backendType, row.command, row.state, row.wait, row.query].some(value => value?.toLocaleLowerCase().includes(needle)));
    return filtered.sort((a, b) => {
      if (a[sort.key] === null || b[sort.key] === null) return compareValues(a[sort.key], b[sort.key], false);
      return compareValues(a[sort.key], b[sort.key], sort.key === 'id' || sort.key === 'ageSeconds') * (sort.desc ? -1 : 1);
    });
  }, [snapshot.processes, search, sort]);

  function order(key: SortKey) { setSort(current => ({ key, desc: current.key === key ? !current.desc : key === 'ageSeconds' })); }
  async function copy() {
    try { await navigator.clipboard.writeText(selected?.query ?? ''); setCopyMessage('已复制当前快照的 SQL 文本'); }
    catch (reason) { setCopyMessage(reason instanceof Error ? reason.message : '复制失败，请选中文本手动复制'); }
  }

  if (!snapshot.processesSupported) return <div className={styles.unsupported}><strong>SQLite 不提供服务器会话目录</strong><p>文件与连接概览来自真实 PRAGMA，不展示推测的进程、连接数量或运行 SQL。</p></div>;
  return <section className={styles.processSection} aria-label="原生活动会话">
    <div className={styles.sectionHead}><div><h3>活动会话</h3><p>{snapshot.sources.processes} · {snapshot.processes.length}{snapshot.processesTruncated ? '+' : ''} 条可见记录</p></div><input aria-label="筛选活动会话" placeholder="筛选用户、数据库、状态、SQL…" value={search} onChange={event => setSearch(event.target.value)}/></div>
    {snapshot.processesTruncated && <p className={styles.notice}>已达到 500 行采样上限，当前记录数只是下界，不代表完整目录。</p>}
    <div className={styles.tableScroll}><table><thead><tr>
      {([['id', '会话 ID'], ['user', '用户'], ['database', '数据库'], ['state', '状态'], ['ageSeconds', '年龄 / 秒']] as const).map(([key, label]) => <th key={key} aria-sort={sort.key === key ? sort.desc ? 'descending' : 'ascending' : 'none'}><button type="button" onClick={() => order(key)}>{label}{sort.key === key ? sort.desc ? ' ↓' : ' ↑' : ''}</button></th>)}
      <th>客户端 / 等待</th><th>SQL / 信息</th><th>详情</th>
    </tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.id ?? 'unknown'}:${index}`} data-own={row.own} data-masked={row.masked}>
      <td>{row.id ?? '未知'}{row.own && <span className={styles.own}>采样连接</span>}</td>
      <td>{row.user ?? '未知'}</td><td>{row.database ?? '—'}</td>
      <td><span className={styles.state} data-active={row.state === 'active' || row.command === 'Query'}>{row.state ?? row.command ?? row.backendType ?? '未知'}{row.masked ? ' · 权限遮蔽' : ''}</span></td>
      <td>{row.ageSeconds ?? '未知'}</td><td title={row.wait ?? undefined}>{row.client ?? '—'}<small>{row.wait ?? row.application ?? ''}</small></td>
      <td className={styles.sqlCell}><span title={row.query?.slice(0, 512)}>{row.query ?? '未提供'}</span></td>
      <td><button type="button" className={styles.detailButton} aria-label={`查看会话 ${row.id ?? index} 详情`} onClick={() => { setSelected({ ...row }); setCopyMessage(''); }}>查看</button></td>
    </tr>)}</tbody></table>{!rows.length && <div className={styles.empty}>当前样本没有匹配会话。原生权限或筛选可能限制可见范围。</div>}</div>
    {selected && <aside className={styles.detail} aria-label="活动会话快照详情">
      <header><div><h3>会话 {selected.id ?? '未知'}</h3><p>冻结的快照 · 后续刷新不会替换当前详情</p></div><button type="button" aria-label="关闭活动会话详情" onClick={() => setSelected(null)}><X size={16}/></button></header>
      <dl>{([['用户', selected.user], ['数据库', selected.database], ['客户端', selected.client], ['应用', selected.application], ['原生后台类型', selected.backendType], ['命令', selected.command], ['状态', selected.state], ['等待事件', selected.wait], ['年龄 / 秒', selected.ageSeconds]]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '未知'}</dd></div>)}</dl>
      <div className={styles.detailSqlHead}><strong>SQL / 原生信息</strong><button type="button" disabled={!selected.query || selected.masked} onClick={() => void copy()}><Copy size={13}/>复制 SQL</button></div>
      <pre tabIndex={0}>{selected.query ?? '当前账号未取得 SQL 文本。'}</pre>
      {(selected.queryTruncated || snapshot.provider === 'postgres') && <p className={styles.notice}>此文本受客户端 65,536 字符与数据库原生采样长度限制，不保证是完整原始语句。</p>}
      {copyMessage && <p role="status" className={styles.copyMessage}>{copyMessage}</p>}
    </aside>}
  </section>;
}
