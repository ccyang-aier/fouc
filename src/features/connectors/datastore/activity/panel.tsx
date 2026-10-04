'use client';

import { useState } from 'react';
import { Pulse } from '@phosphor-icons/react/dist/csr/Pulse';
import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { Pause } from '@phosphor-icons/react/dist/csr/Pause';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap';
import type { RelationalProvider } from '@fouc/shared';
import { databaseActivityMetrics, formatDatabaseActivityMetric } from '@fouc/shared/database-activity';
import { ActivityProcesses } from './process-table';
import { ActivityTrend } from './trend';
import { useDatabaseActivity } from './use-activity';
import styles from './activity.module.css';

export function DatabaseActivityPanel(props: { base: string; provider: RelationalProvider; database: string; blocked: boolean }) {
  return <ActivityPanel key={props.base} {...props}/>;
}

function ActivityPanel({ base, provider, database, blocked }: { base: string; provider: RelationalProvider; database: string; blocked: boolean }) {
  const activity = useDatabaseActivity(base, blocked);
  const [statusSearch, setStatusSearch] = useState('');
  const latest = activity.latest;
  const previous = activity.samples.at(-2);
  const metrics = latest ? databaseActivityMetrics(latest, previous) : [];
  return <section className={styles.panel} aria-label="数据库活动监控" aria-busy={activity.busy}>
    <header className={styles.toolbar}>
      <div className={styles.identity}><span><Pulse size={18}/></span><div><h2>{provider === 'sqlite' ? '文件与连接概览' : '实例 Dashboard'}</h2><p>{provider.toUpperCase()} · {database || '当前连接'} · 只读采样</p></div></div>
      <div className={styles.controls}>
        <label>刷新间隔<select aria-label="监控刷新间隔" value={activity.interval} onChange={event => activity.setIntervalSeconds(Number(event.target.value))}>{[5, 10, 30, 60].map(seconds => <option key={seconds} value={seconds}>{seconds} 秒</option>)}</select></label>
        <button type="button" className={styles.secondary} aria-label={activity.paused ? '恢复自动监控' : '暂停自动监控'} onClick={() => activity.pause(!activity.paused)}>{activity.paused ? <Play size={13}/> : <Pause size={13}/>}<span>{activity.paused ? '恢复' : '暂停'}</span></button>
        <button type="button" className={styles.secondary} aria-label="刷新监控快照" disabled={activity.busy || blocked} onClick={() => void activity.refresh()}>{activity.busy ? <SpinnerGap size={13} className={styles.spinner}/> : <ArrowClockwise size={13}/>}<span>刷新</span></button>
      </div>
    </header>
    <div className={styles.meta}><span className={styles.live} data-paused={activity.paused || blocked}/><span>{blocked ? '会话有待提交或正在写入，自动采样暂缓' : activity.paused ? '已暂停 · 保留最后快照' : `每 ${activity.interval} 秒采样 · 页面不可见时暂缓`}</span><span>{latest ? `${new Date(latest.capturedAt).toLocaleTimeString()} · ${latest.durationMs} ms · ${activity.samples.length}/60 样本` : '等待原生样本'}</span></div>
    <div className={styles.content}>
      {activity.error && <div className={styles.error} role="alert">{activity.error}<button type="button" disabled={activity.busy || blocked} onClick={() => void activity.refresh()}>重试</button></div>}
      {latest?.issues.map(issue => <div className={styles.error} role="alert" key={issue.section}><strong>{issue.section === 'status' ? '指标读取失败' : issue.section === 'settings' ? '设置读取失败' : '会话目录读取失败'}</strong><span>{issue.message}{issue.code ? ` (${issue.code})` : ''}</span><small>该区域保持未知，其他成功区域仍可查看。</small></div>)}
      {!latest && !activity.error && <div className={styles.empty} role="status">正在读取数据库原生状态与目录…</div>}
      {latest && <>
        <div className={styles.metrics}>{metrics.map(metric => <article key={metric.id} className={styles.metric} title={`${metric.source}${metric.counter === null ? '' : '\n原始累计值：' + metric.counter}`}>
          <span>{metric.label}</span><strong>{formatDatabaseActivityMetric(metric)}</strong><small>{metric.value === null ? '未知 / 等待有效样本' : metric.unit === 'count' ? '原生计数' : metric.unit === '%' ? '累计计数比例' : metric.unit === 's' ? '秒 → 时长' : metric.unit}</small>
        </article>)}</div>
        <div className={styles.scope}><strong>{latest.metricScope === 'file' ? '当前 SQLite 文件' : '实例范围 · 当前账号原生可见'}</strong><span>{latest.sources.status}。各区域依次读取，快照不保证同一瞬间一致。</span></div>
        {provider !== 'sqlite' && <div className={styles.charts}><ActivityTrend samples={activity.samples} metricId="throughput" label={provider === 'mysql' ? '查询吞吐 QPS' : '事务吞吐 TPS'}/><ActivityTrend samples={activity.samples} metricId={provider === 'mysql' ? 'sent' : 'inserts'} label={provider === 'mysql' ? '发送流量 B/s' : '插入行数 /s'}/></div>}
        <ActivityProcesses snapshot={latest}/>
        <details className={styles.raw}><summary>原始状态与设置 · 保留数据库原始数值</summary>
          <div className={styles.rawHead}><span>没有值的字段保持未知；版本 {latest.settings.version ?? '未知'} · 最大连接数 {latest.settings.max_connections ?? '未知'}</span><input aria-label="筛选原始监控状态" value={statusSearch} placeholder="筛选指标名或原始值…" onChange={event => setStatusSearch(event.target.value)}/></div>
          <div className={styles.rawTable}><table><thead><tr><th>区域 / 来源</th><th>字段</th><th>原始值</th></tr></thead><tbody>{(['counters', 'settings'] as const).flatMap(group => Object.entries(latest[group]).sort(([a], [b]) => a.localeCompare(b)).filter(([name, value]) => !statusSearch || `${name} ${value ?? ''}`.toLocaleLowerCase().includes(statusSearch.toLocaleLowerCase())).map(([name, value]) => <tr key={`${group}:${name}`}><td>{group === 'counters' ? '原生状态' : '原生设置'}</td><td>{name}</td><td>{value ?? '未知'}</td></tr>))}</tbody></table></div>
        </details>
        <details className={styles.limitations}><summary>来源、权限与监控限制</summary>{latest.warnings.map(warning => <p key={warning}>{warning}</p>)}<p>关闭监控页或切换工作空间后停止本页采样；不提供终止进程、取消其他会话或修改数据库参数的操作。</p></details>
      </>}
    </div>
  </section>;
}
