'use client';
import { useMemo, useRef, useState } from 'react';
import { CheckCircle, Code, Copy, DownloadSimple, PencilSimple, Plus, Stack, Trash, Warning } from '@phosphor-icons/react';
import type { RelationalTableStructure } from '@fouc/shared';
import type { StructureEditCommitResult, StructureEditInput, StructureEditPreview } from '@fouc/shared/relational-structure-edit';
import { StructureColumnForm } from './column-form';
import { StructureIndexForm } from './index-form';
import { createStructureEditorDraft, newStructureColumn, newStructureIndex, structureDraftInput, validateStructureDraft, type StructureEditorDraft } from './draft';
import styles from './structure-edit.module.css';

export interface TableStructureEditorPanelProps {
  structure: RelationalTableStructure; className?: string;
  onPreview: (input: StructureEditInput) => Promise<StructureEditPreview>;
  onCommit: (preview: StructureEditPreview) => Promise<StructureEditCommitResult>;
  onCommitted?: (result: StructureEditCommitResult) => void; onClose?: () => void;
}
export function TableStructureEditorPanel(props: TableStructureEditorPanelProps) {
  return <StructureEditor key={`${props.structure.connectionId}/${props.structure.schema}/${props.structure.table}`} {...props} />;
}
function StructureEditor({ structure, className = '', onPreview, onCommit, onCommitted, onClose }: TableStructureEditorPanelProps) {
  const [initial] = useState(structure);
  const [draft, setDraft] = useState(() => createStructureEditorDraft(initial));
  const [tab, setTab] = useState<'columns' | 'indexes' | 'primary' | 'preview'>('columns');
  const [selected, setSelected] = useState(draft.columns[0]?.id ?? '');
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<StructureEditPreview | null>(null), [result, setResult] = useState<StructureEditCommitResult | null>(null), [acknowledged, setAcknowledged] = useState(false);
  const sequence = useRef(0);
  const input = useMemo(() => structureDraftInput(initial, draft), [initial, draft]);
  const validation = useMemo(() => validateStructureDraft(initial, draft), [initial, draft]);
  const stale = structure !== initial && JSON.stringify(structure) !== JSON.stringify(initial);
  const frozen = Boolean(busy || stale || result && ['partial', 'unknown', 'committed'].includes(result.outcome));
  const activeColumn = draft.columns.find((column) => column.id === selected), activeIndex = draft.indexes.find((index) => index.id === selected);
  const names = draft.columns.filter((column) => !column.dropped).map((column) => column.value.name).filter(Boolean);
  const changed = input.operations.length;
  function update(next: StructureEditorDraft) { sequence.current++; setDraft(next); setPreview(null); setResult(null); setAcknowledged(false); setError(''); setNotice(''); }
  function addColumn() {
    const id = `new-column-${crypto.randomUUID()}`;
    update({ ...draft, columns: [...draft.columns, { id, originalName: null, value: newStructureColumn(initial.provider), dropped: false }] }); setSelected(id); setTab('columns');
  }
  function addIndex() {
    const id = `new-index-${crypto.randomUUID()}`;
    update({ ...draft, indexes: [...draft.indexes, { id, originalName: null, value: newStructureIndex(), dropped: false, protected: false }] }); setSelected(id); setTab('indexes');
  }
  async function review() {
    const version = sequence.current; setBusy('preview'); setError(''); setNotice('');
    try { const next = await onPreview(input); if (version === sequence.current) { setPreview(next); setAcknowledged(false); setTab('preview'); } }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(null); }
  }
  async function commit() {
    if (!preview?.executable || !acknowledged) return;
    setBusy('commit'); setError('');
    try { const next = await onCommit(preview); setResult(next); if (next.outcome === 'committed') onCommitted?.(next); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(null); }
  }
  async function copy() { try { await navigator.clipboard.writeText(preview!.script); setNotice('变更脚本已复制'); } catch { setError('复制失败，请重试或下载 SQL'); } }
  function download() {
    const url = URL.createObjectURL(new Blob([preview!.script], { type: 'application/sql;charset=utf-8' })), link = document.createElement('a');
    link.href = url; link.download = `${initial.table.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')}-structure.sql`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('变更脚本已下载');
  }
  const summary = preview ? preview.issues.filter((issue) => issue.severity !== 'warning') : [];
  return <section className={`${styles.panel} ${className}`} aria-label="原生表结构编辑" aria-busy={Boolean(busy)}>
    <header className={styles.header}><div className={styles.title}><div className={styles.icon}><Stack size={22} /></div><div><h2>编辑表结构</h2><p><span>{initial.provider.toUpperCase()}</span>{initial.schema}.{initial.table}</p></div></div><div className={styles.headerActions}><span className={changed ? styles.dirty : styles.clean}>{changed ? `${changed} 项待审查` : '已同步'}</span>{onClose && <button type="button" disabled={Boolean(busy)} onClick={onClose}>关闭</button>}</div></header>
    <nav className={styles.tabs} aria-label="表结构编辑页"><button type="button" aria-current={tab === 'columns' ? 'page' : undefined} onClick={() => { setTab('columns'); if (!draft.columns.some((column) => column.id === selected)) setSelected(draft.columns[0]?.id ?? ''); }}><PencilSimple size={15} />字段 <span>{draft.columns.filter((column) => !column.dropped).length}</span></button><button type="button" aria-current={tab === 'indexes' ? 'page' : undefined} onClick={() => { setTab('indexes'); if (!draft.indexes.some((index) => index.id === selected)) setSelected(draft.indexes[0]?.id ?? ''); }}>索引与唯一性 <span>{draft.indexes.filter((index) => !index.dropped).length}</span></button><button type="button" aria-current={tab === 'primary' ? 'page' : undefined} onClick={() => setTab('primary')}>主键</button><button type="button" aria-current={tab === 'preview' ? 'page' : undefined} onClick={() => setTab('preview')}><Code size={15} />变更审查</button></nav>
    {stale && <div className={styles.alert} role="alert">表结构已经更新。当前草稿保留，请关闭并重新打开后基于最新元数据编辑。</div>}
    <fieldset className={styles.body} disabled={frozen}>
      {(tab === 'columns' || tab === 'indexes') && <><aside className={styles.list}><div className={styles.listHead}><span>{tab === 'columns' ? '字段清单' : '索引清单'}</span><button type="button" onClick={tab === 'columns' ? addColumn : addIndex}><Plus size={14} />新增</button></div>
        {tab === 'columns' ? draft.columns.map((column) => <button type="button" key={column.id} className={`${styles.object} ${selected === column.id ? styles.active : ''} ${column.dropped ? styles.dropped : ''}`} onClick={() => setSelected(column.id)}><span><b>{column.value.name || '未命名字段'}</b><small>{column.value.dataType}</small></span><em>{column.dropped ? '删除' : column.originalName ? input.operations.some((op) => op.id === column.id) ? '修改' : '' : '新增'}</em></button>) : draft.indexes.map((index) => <button type="button" key={index.id} className={`${styles.object} ${selected === index.id ? styles.active : ''} ${index.dropped ? styles.dropped : ''}`} onClick={() => setSelected(index.id)}><span><b>{index.value.name || '未命名索引'}</b><small>{index.value.unique ? 'UNIQUE · ' : ''}{index.value.method.toUpperCase()}</small></span><em>{index.dropped ? '删除' : index.originalName ? '' : '新增'}</em></button>)}
        {tab === 'indexes' && !draft.indexes.length && <p className={styles.emptySmall}>尚无普通索引。主键可在主键页调整。</p>}
      </aside><div className={styles.inspector}>
        {tab === 'columns' && activeColumn && <><div className={styles.inspectorHead}><h3>{activeColumn.originalName ? activeColumn.originalName : '新增字段'}</h3><button type="button" className={activeColumn.dropped ? styles.subtle : styles.danger} onClick={() => update({ ...draft, columns: draft.columns.map((column) => column.id === selected ? { ...column, dropped: !column.dropped } : column) })}><Trash size={14} />{activeColumn.dropped ? '恢复字段' : activeColumn.originalName ? '标记删除' : '取消新增'}</button></div>{activeColumn.dropped ? <div className={styles.empty}><Warning size={28} /><h3>已标记删除</h3><p>预览会标明数据丢失和依赖影响；提交前仍可恢复。</p></div> : <StructureColumnForm value={activeColumn.value} provider={initial.provider} onChange={(value) => update({ ...draft, columns: draft.columns.map((column) => column.id === selected ? { ...column, value } : column) })} />}</>}
        {tab === 'indexes' && activeIndex && <><div className={styles.inspectorHead}><h3>{activeIndex.originalName || '新增索引'}</h3><button type="button" className={activeIndex.dropped ? styles.subtle : styles.danger} disabled={activeIndex.protected} onClick={() => update({ ...draft, indexes: draft.indexes.map((index) => index.id === selected ? { ...index, dropped: !index.dropped } : index) })}><Trash size={14} />{activeIndex.dropped ? '恢复索引' : '标记删除'}</button></div>
          {activeIndex.dropped ? <div className={styles.empty}><Warning size={28} /><h3>索引将被删除</h3><p>删除唯一索引会取消唯一性保护；外键依赖会在服务端拦截。</p></div> : activeIndex.originalName ? <div className={styles.existingIndex}><p>{activeIndex.protected ? '此索引由约束管理，不能直接删除。' : '已有索引保持原生定义。变更请显式删除后新增，以便审查完整影响。'}</p><pre>{initial.indexes.find((index) => index.name === activeIndex.originalName)?.definition || initial.indexes.find((index) => index.name === activeIndex.originalName)?.parts.map((part) => part.column || part.expression).join(', ')}</pre><dl><dt>唯一性</dt><dd>{activeIndex.value.unique ? '唯一' : '普通'}</dd><dt>条件</dt><dd>{activeIndex.value.predicate || '无'}</dd><dt>备注</dt><dd>{activeIndex.value.comment || '无'}</dd></dl></div> : <StructureIndexForm value={activeIndex.value} provider={initial.provider} columns={names} onChange={(value) => update({ ...draft, indexes: draft.indexes.map((index) => index.id === selected ? { ...index, value } : index) })} />}</>}
        {!(tab === 'columns' ? activeColumn : activeIndex) && <div className={styles.empty}><Stack size={28} /><p>选择一个对象或新增。</p></div>}
      </div></>}
      {tab === 'primary' && <div className={styles.primary}><h3>主键与顺序</h3><p>选中字段按点击顺序排列。主键要求唯一、非空；已有外键可能阻止变更。</p><div className={styles.chips}>{names.map((name) => <label key={name}><input type="checkbox" checked={draft.primaryKey.includes(name)} onChange={(event) => update({ ...draft, primaryKey: event.target.checked ? [...draft.primaryKey, name] : draft.primaryKey.filter((column) => column !== name) })} />{name}{draft.primaryKey.includes(name) && <b>{draft.primaryKey.indexOf(name) + 1}</b>}</label>)}</div><div className={styles.keyPreview}>PRIMARY KEY ({draft.primaryKey.length ? draft.primaryKey.join(', ') : '无'})</div>{initial.provider === 'sqlite' && <p className={styles.hint}>SQLite 主键变更会生成手工重建提示，直接提交不会执行此类变化。</p>}</div>}
    </fieldset>
    {tab === 'preview' && <div className={styles.review}>{preview ? <><div className={styles.reviewHead}><div><h3>{preview.executable ? '变更脚本已准备' : '需要调整或手工审查'}</h3><p>{preview.steps.length} 个步骤 · {preview.transaction === 'implicit-commit' ? 'MySQL 逐步隐式提交' : '单个事务'}</p></div><button type="button" onClick={() => void copy()}><Copy size={14} />复制</button><button type="button" onClick={download}><DownloadSimple size={14} />下载</button></div>
      <div className={styles.reviewGrid}><pre aria-label="表结构变更脚本">{preview.script}</pre><aside><h4>影响与限制</h4>{preview.issues.map((issue, index) => <p key={index} className={issue.severity === 'warning' ? styles.warning : styles.blocking}><Warning size={14} /><span>{issue.message}</span></p>)}</aside></div>
      {preview.executable && !result && <label className={styles.acknowledge}><input type="checkbox" checked={acknowledged} disabled={Boolean(busy)} onChange={(event) => setAcknowledged(event.target.checked)} />我已审查脚本和影响{preview.transaction === 'implicit-commit' ? '，理解成功 DDL 无法回滚' : '，确认可以提交这些变化'}</label>}
      {result && <div role="status" className={result.outcome === 'committed' ? styles.success : styles.alert}><h4>{result.outcome === 'committed' ? '结构变更已提交' : result.outcome === 'rolled-back' ? '提交失败，事务已请求回滚' : result.outcome === 'partial' ? '部分步骤已提交，请重新读取结构' : result.outcome === 'unknown' ? '提交结果不确定，请重新读取结构' : '变更未提交'}</h4>{result.error && <p>{result.error}</p>}<ul>{result.steps.map((step) => <li key={step.id}>{preview.steps.find((entry) => entry.id === step.id)?.label} · {statusText(step.status)}{step.error ? ` · ${step.error}` : ''}</li>)}</ul></div>}
    </> : <div className={styles.empty}><Code size={32} /><h3>先完成草稿，再审查 DDL</h3><p>预览由服务端基于当前原生元数据生成，尚未写入数据库。</p></div>}</div>}
    {validation.length > 0 && <div className={styles.validation} role="alert">{validation.slice(0, 4).map((message) => <p key={message}>{message}</p>)}{validation.length > 4 && <p>另有 {validation.length - 4} 项待修正</p>}</div>}{error && <div role="alert" className={styles.alert}>{error}</div>}{notice && <p role="status" className={styles.notice}><CheckCircle size={14} />{notice}</p>}
    <footer className={styles.footer}><span>{busy === 'preview' ? '正在生成原生预览…' : busy === 'commit' ? '正在提交，请保持页面打开…' : summary.length ? `${summary.length} 项需要调整` : changed ? '草稿尚未写入数据库' : '修改字段、索引或主键后生成预览'}</span><button type="button" disabled={frozen || !changed} onClick={() => { update(createStructureEditorDraft(initial)); setSelected(initial.columns[0] ? 'column-0' : ''); }}>重置草稿</button><button type="button" className={styles.secondary} disabled={frozen || !changed || Boolean(validation.length)} onClick={() => void review()}>生成预览</button><button type="button" className={styles.commit} disabled={frozen || !preview?.executable || !acknowledged || Boolean(result)} onClick={() => void commit()}>{busy === 'commit' ? '提交中…' : '提交已审查变更'}</button></footer>
  </section>;
}
function statusText(status: StructureEditCommitResult['steps'][number]['status']): string { return ({ committed: '已提交', 'rolled-back': '已请求回滚', failed: '失败', unattempted: '未执行', unknown: '待确认' })[status]; }
