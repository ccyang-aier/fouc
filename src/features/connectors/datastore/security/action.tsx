'use client';

import { useState } from 'react';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap';
import type { RelationalSession } from '@fouc/shared';
import { SqlDialog } from '../sql-library-dialog';
import { DatabasePrincipalDetail } from './detail';
import { useDatabaseSecurity } from './use-security';
import styles from './security.module.css';

export function DatabaseSecurityAction(props: { base: string; session: RelationalSession; schema: string; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  if (props.session.provider === 'sqlite') return null;
  return <><button type="button" className={styles.trigger} disabled={props.disabled} aria-label="查看数据库用户与角色" onClick={() => setOpen(true)}><ShieldCheck size={14}/><span>用户与角色</span></button>{open && <SecurityDialog key={props.base} {...props} onClose={() => setOpen(false)}/>}</>;
}

function SecurityDialog({ base, session, schema, onClose }: { base: string; session: RelationalSession; schema: string; onClose: () => void }) {
  const flow = useDatabaseSecurity(base, schema);
  const [search, setSearch] = useState(''), [notice, setNotice] = useState('');
  const directory = flow.directory;
  const principal = directory?.principals.find(item => item.id === flow.principalId);
  const visible = directory?.principals.filter(item => `${item.name} ${item.host ?? ''} ${item.authentication ?? ''}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  function download() {
    if (!directory) return;
    const blob = new Blob([JSON.stringify({ directory, detail: flow.detail }, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = `database-security-${directory.provider}-${directory.capturedAt}.json`;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('原生目录快照已下载。');
  }
  return <SqlDialog title="数据库用户与角色" className={styles.dialog} onClose={onClose}>
    <div className={styles.overview}><span className={styles.mark}><ShieldCheck size={21}/></span><div><h3>账户与访问目录</h3><p>{session.info.productName} · {schema || session.database} · 只读</p></div><button type="button" disabled={flow.busy || flow.detailBusy} aria-label="刷新数据库用户目录" onClick={flow.refresh}>{flow.busy ? <SpinnerGap size={14} className="mw-spin"/> : <ArrowClockwise size={14}/>}<span>刷新</span></button></div>
    {directory && <div className={styles.identity}><span>当前角色 <strong>{directory.identity.current ?? '未知'}</strong></span><span>已认证 <strong>{directory.identity.authenticated ?? '未知'}</strong></span><span>{directory.coverage === 'current-account' ? '仅当前账户可见' : '原生账户目录'} · {directory.principals.length}{directory.principalsTruncated ? '+' : ''} 项</span></div>}
    <div className={styles.layout}>
      <aside className={styles.directory}><label className={styles.search}>账户目录<input aria-label="搜索数据库账户" value={search} autoFocus placeholder="账户、Host 或认证方式…" onChange={event => setSearch(event.target.value)}/></label><div className={styles.accountList}>{flow.busy && <p className={styles.empty} role="status">正在读取当前连接目录…</p>}{flow.error && <p className={styles.error} role="alert">{flow.error}</p>}{visible.map(item => <button type="button" key={item.id} aria-pressed={flow.principalId === item.id} disabled={flow.busy} onClick={() => { flow.setPrincipalId(item.id); setNotice(''); }}><span className={styles.accountAvatar}>{item.name.slice(0, 1).toUpperCase() || '@'}</span><span><strong>{item.name || '匿名账户'}</strong><small>{item.host !== null ? `@${item.host}` : item.flags.login ? 'LOGIN' : 'ROLE'}</small></span>{item.flags.superuser && <span className={styles.tag}>SUPER</span>}{item.flags.locked && <span className={styles.tag}>锁定</span>}</button>)}{directory && !visible.length && !flow.busy && <p className={styles.empty}>没有匹配的可见账户。</p>}</div></aside>
      {principal && directory ? <DatabasePrincipalDetail key={principal.id} principal={principal} directory={directory} detail={flow.detail} busy={flow.detailBusy} error={flow.detailError}/> : <section className={styles.detail}><p className={styles.empty}>选择账户查看公开属性、角色关系和可见授权。</p></section>}
    </div>
    {directory && <details className={styles.sources}><summary>目录来源与权限范围{directory.issues.length ? ` · ${directory.issues.length} 项未完整读取` : ''}</summary>{directory.issues.map((issue, index) => <p key={index}>{issue.section}：{issue.message}</p>)}{directory.warnings.map(message => <p key={message}>{message}</p>)}</details>}
    <footer className={styles.footer}><small role="status">{notice || (directory ? `${new Date(directory.capturedAt).toLocaleTimeString()} · ${directory.durationMs} ms` : '当前连接原生可见范围')}</small><button type="button" disabled={!directory || flow.busy || flow.detailBusy} onClick={download}><DownloadSimple size={14}/>下载目录快照</button><button type="button" onClick={onClose}>关闭</button></footer>
  </SqlDialog>;
}
