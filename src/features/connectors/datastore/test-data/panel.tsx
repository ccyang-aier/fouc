'use client';

import { useMemo, useState } from 'react';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { LockOpen } from '@phosphor-icons/react/dist/csr/LockOpen';
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap';
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import type { RelationalTableStructure } from '@fouc/shared';
import { defaultTestDataConfig, generateTestDataPreview, validateTestDataConfig, TEST_DATA_LIMITS, type TestDataConfig, type TestDataPreview } from '@fouc/shared/test-data';
import { TableImportPreviewGrid } from '../table-import/preview-grid';
import { TestDataColumnEditor } from './column-editor';
import { useTestDataPlan } from './use-test-data-plan';
import styles from './test-data.module.css';

export interface TestDataPanelProps {
  base: string;
  structure: RelationalTableStructure;
  writable: boolean;
  onUnlock: () => Promise<void>;
  onBusyChange: (value: boolean) => void;
  onImported: () => void;
  onClose: () => void;
}

export function TestDataPanel(props: TestDataPanelProps) {
  const { structure, writable, onUnlock, onBusyChange, onClose } = props;
  const [config, setConfig] = useState<TestDataConfig>(() => defaultTestDataConfig(structure));
  const [selected, setSelected] = useState(() => config.columns.find(item => item.enabled)?.column ?? config.columns[0]?.column ?? '');
  const [sample, setSample] = useState<TestDataPreview | null>(null);
  const [sampleError, setSampleError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const validation = useMemo(() => validateTestDataConfig(structure, config), [structure, config]);
  const workflow = useTestDataPlan(props);
  const step = workflow.summary ? 2 : workflow.plan ? 1 : 0;

  function change(value: TestDataConfig) {
    setConfig(value);
    setSample(null);
    setSampleError('');
    setConfirmed(false);
  }

  function preview() {
    setSampleError('');
    try { setSample(generateTestDataPreview(structure, config)); }
    catch (reason) { setSampleError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function unlock() {
    setUnlocking(true);
    onBusyChange(true);
    setSampleError('');
    try { await onUnlock(); }
    catch (reason) { setSampleError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setUnlocking(false); onBusyChange(false); }
  }

  return <section className={styles.panel} aria-label="生成测试数据" aria-busy={!!workflow.busy || unlocking}>
    <header className={styles.heading}>
      <div><h2>{structure.table}</h2><p><span>{structure.provider.toUpperCase()}</span><ArrowRight size={10}/><span>{structure.schema}</span><span className={styles.badge}>只追加 · 保留原表</span></p></div>
      <div className={styles.limits}>最多 {TEST_DATA_LIMITS.rows.toLocaleString()} 行<strong>5 MiB / 100,000 单元格</strong></div>
    </header>
    <ol className={styles.steps} aria-label="测试数据生成进度">
      {['配置与样本', '原生审查', '追加完成'].map((label, index) => <li key={label} data-active={index === step} data-complete={index < step} aria-current={index === step ? 'step' : undefined}><span>{index < step ? <Check size={12}/> : index + 1}</span>{label}</li>)}
    </ol>
    <div className={styles.content}>
      {(workflow.error || sampleError) && <div className={styles.error} role="alert"><WarningCircle size={16}/><span>{workflow.error || sampleError}</span></div>}
      {workflow.summary ? <div className={styles.success} role="status">
        <span><Check size={27}/></span><h3>测试数据已追加</h3>
        <p>原生事务返回 <strong>{workflow.summary.rowsImported.toLocaleString()} 行</strong>已导入。</p>
        <small>{workflow.summary.elapsedMs.toLocaleString()} ms · {structure.schema}.{structure.table}</small>
        <p>目标表已刷新；原表结构和已有记录保持保留。</p>
      </div> : workflow.plan ? <>
        <div className={styles.reviewHeading}><span><Check size={20}/></span><div><h3>原生预览已完成，等待确认</h3><p>此步骤没有发起写入。一次性计划绑定当前工作空间、会话、目标表和真实字段结构。</p></div></div>
        <div className={styles.stats}>
          <div><span>待追加行数</span><strong>{workflow.plan.review.rowsToImport.toLocaleString()}</strong></div>
          <div><span>映射字段</span><strong>{workflow.plan.review.validation.mappedColumns.length}</strong></div>
          <div><span>生成源大小</span><strong>{(workflow.plan.review.parsed.sizeBytes / 1024).toFixed(1)}<small> KiB</small></strong></div>
        </div>
        <div className={styles.mapping}>{workflow.plan.review.mappings.map(mapping => <span key={mapping.sourceColumn}>{mapping.sourceColumn}<ArrowRight size={11}/>{mapping.targetColumn}</span>)}</div>
        <TableImportPreviewGrid parsed={workflow.plan.review.parsed}/>
        <div className={styles.warnings}>{[...new Set([...validation.warnings, ...workflow.plan.review.validation.warnings])].map(warning => <p key={warning}><WarningCircle size={12}/>{warning}</p>)}</div>
        <label className={styles.confirmation}><input type="checkbox" aria-label="确认追加生成的测试数据" checked={confirmed} disabled={!!workflow.busy} onChange={event => setConfirmed(event.target.checked)}/><span>我确认向 <strong>{structure.schema}.{structure.table}</strong> 追加 {workflow.plan.review.rowsToImport} 行测试数据，接受当前约束与触发器的原生行为。</span></label>
        {!writable && <div className={styles.error} role="alert">写入权限已锁定。请返回配置，明确解锁后重新准备计划。</div>}
      </> : <>
        <fieldset className={styles.configuration} disabled={!!workflow.busy || unlocking}>
          <div className={styles.tableOptions}>
            <label>生成行数<input aria-label="测试数据行数" type="number" min={1} max={TEST_DATA_LIMITS.rows} value={config.rowCount} onChange={event => change({ ...config, rowCount: Number(event.target.value) })}/></label>
            <label>可重现种子<input aria-label="测试数据种子" value={config.seed} maxLength={200} onChange={event => change({ ...config, seed: event.target.value })}/></label>
            <p>同一结构、种子和字段配置得到相同值。<br/>样本仅生成前 {TEST_DATA_LIMITS.sampleRows} 行，不读写目标数据。</p>
          </div>
          <TestDataColumnEditor structure={structure} config={config} selected={selected} onSelect={setSelected} onChange={change}/>
        </fieldset>
        {validation.errors.length > 0 && <div className={styles.issues} role="alert"><strong>请先修正配置</strong><ul>{validation.errors.slice(0, 12).map((issue, index) => <li key={index}>{issue.column && <code>{issue.column}：</code>}{issue.message}</li>)}</ul>{validation.errors.length > 12 && <span>另有 {validation.errors.length - 12} 项问题。</span>}</div>}
        <div className={styles.sampleBar}><div><strong>本地只读样本</strong><span>最多展示前 20 行，整批按相同配置生成后再由服务端审查。</span></div><button type="button" className={styles.secondary} disabled={!validation.valid || !!workflow.busy || unlocking} onClick={preview}>{sample ? '重新生成样本' : '查看样本'}</button></div>
        {sample && <TableImportPreviewGrid parsed={sample.parsed}/>}
        <details className={styles.boundaries}><summary>生成范围与约束</summary>{validation.warnings.map(warning => <p key={warning}>{warning}</p>)}<p>当前为单表有界追加。不提供外键采样、正则生成、跨表联动或全库批量写入；自增、序列、生成列由数据库处理。</p></details>
      </>}
    </div>
    <footer className={styles.footer}>
      <span>{workflow.busy ? <><SpinnerGap className={styles.spinner} size={14}/>{workflow.busy === 'generate' ? `本地生成 ${workflow.progress} / ${config.rowCount}` : workflow.busy === 'preview' ? '原生字段与类型审查…' : '原生追加事务执行中…'}</> : writable ? <><LockOpen size={13}/>写入已解锁 · 提交仍需明确确认</> : '只读状态 · 可查看本地样本'}</span>
      <div>
        {workflow.busy ? <button type="button" className={styles.secondary} onClick={workflow.cancel}>取消请求</button> : workflow.summary ? <><button type="button" className={styles.secondary} onClick={() => { workflow.back(); setConfirmed(false); }}>继续配置</button><button type="button" className={styles.primary} onClick={onClose}>完成</button></> : workflow.plan ? <>
          <button type="button" className={styles.secondary} onClick={() => { workflow.back(); setConfirmed(false); }}>返回配置</button>
          <button type="button" className={styles.primary} disabled={!confirmed || !writable} onClick={() => void workflow.append(confirmed)}>确认追加 {workflow.plan.review.rowsToImport} 行</button>
        </> : <>
          <button type="button" className={styles.secondary} disabled={unlocking} onClick={onClose}>关闭</button>
          {!writable ? <button type="button" className={styles.primary} disabled={!validation.valid || unlocking} onClick={() => void unlock()}><LockOpen size={14}/>{unlocking ? '解锁中…' : '解锁本次会话写入'}</button> : <button type="button" className={styles.primary} disabled={!validation.valid || unlocking} onClick={() => void workflow.prepare(config)}>生成整批并审查<ArrowRight size={13}/></button>}
        </>}
      </div>
    </footer>
  </section>;
}
