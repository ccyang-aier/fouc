"use client"

import { useEffect, useRef, useState, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import { TreeStructure } from '@phosphor-icons/react'
import { inspectSqlTemplate, resolveSqlExecutionTarget, sqlVariableContext, type DatabaseQueryResult, type RelationalProvider, type SqlParameterDescriptor, type SqlParameterInput } from '@fouc/shared'
import { backendFetch } from '@/lib/backend'
import { ExplainPlanViewer } from './explain'
import { SqlDialog } from './sql-library-dialog'
import { SqlParameterDialog, rememberSqlParameters, type SqlParameterRecents } from './sql-parameter-dialog'
import common from './relational.module.css'
import styles from './sql-explain-action.module.css'

type Statement = { sql: string; declarationSql: string; descriptors: SqlParameterDescriptor[]; parameters?: Record<string, SqlParameterInput> }
type Props = { base: string; provider: RelationalProvider; schema: string | null; targetLabel: string; editorRef: RefObject<EditorView | null>; disabled: boolean; contextIssue?: string; onNotice: (message: string) => void }

/** Estimated plans reuse the document's parameters and native scoped session. */
export function SqlExplainAction({ base, provider, schema, targetLabel, editorRef, disabled, contextIssue, onNotice }: Props) {
  const [statement, setStatement] = useState<Statement | null>(null), [parameters, setParameters] = useState<Statement | null>(null)
  const [result, setResult] = useState<DatabaseQueryResult | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('')
  const request = useRef<AbortController | null>(null), [history] = useState<SqlParameterRecents>(() => new Map())
  useEffect(() => () => { request.current?.abort(); request.current = null }, [base])
  async function load(source: Statement) {
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    setStatement(source); setResult(null); setError(''); setLoading(true)
    try {
      const response = await backendFetch<DatabaseQueryResult>(`${base}/explain`, { method: 'POST', signal: controller.signal,
        body: JSON.stringify({ sql: source.sql, schema, declarationSql: source.declarationSql, parameters: source.parameters }) })
      if (request.current === controller && !controller.signal.aborted) setResult(response)
    } catch (reason) {
      if (request.current === controller && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason))
    } finally { if (request.current === controller && !controller.signal.aborted) setLoading(false) }
  }
  function close() { request.current?.abort(); request.current = null; setStatement(null); setLoading(false); editorRef.current?.focus() }
  function open() {
    if (contextIssue) { onNotice(contextIssue); return }
    const view = editorRef.current
    if (!view || disabled) return
    const document = view.state.doc.toString(), target = resolveSqlExecutionTarget(document, provider, 'current', view.state.selection.main)
    if (!target) { onNotice('请选择一条 SELECT / WITH 查询，或将光标移到查询内。'); return }
    try {
      const declarationSql = sqlVariableContext(document.slice(0, target.to), provider), inspected = inspectSqlTemplate(target.sql, provider, declarationSql)
      const source = { sql: target.sql, declarationSql, descriptors: inspected.descriptors }
      if (source.descriptors.length > 128) throw new Error('执行计划最多支持 128 个参数。')
      if (source.descriptors.length) setParameters(source)
      else void load(source)
    } catch (reason) { onNotice(reason instanceof Error ? reason.message : String(reason)) }
  }
  return <>
    <button type="button" className="fouc-action" aria-label="查看执行计划" title="选区或当前查询 · 仅生成估算计划" disabled={disabled} onClick={open}><TreeStructure size={16} /><span>执行计划</span></button>
    {parameters && <SqlParameterDialog action="explain" sql={parameters.sql} declarationSql={parameters.declarationSql} provider={provider} descriptors={parameters.descriptors} history={history} targetLabel={targetLabel} onClose={() => { setParameters(null); editorRef.current?.focus() }} onExecute={(values) => {
      rememberSqlParameters(history, values); const source = { ...parameters, parameters: values }; setParameters(null); void load(source)
    }} />}
    {statement && <SqlDialog title="SQL 执行计划" className={styles.dialog} onClose={close}>
      <div className={styles.context}><span><TreeStructure size={16} />{targetLabel}</span><small>EXPLAIN · 估算计划 · 未实际运行查询</small></div>
      <details className={styles.source}><summary>查看本次查询</summary><pre>{statement.sql}</pre></details>
      <div className={styles.body}><ExplainPlanViewer provider={provider} result={result} loading={loading} error={error} onRetry={() => void load(statement)} /></div>
      <footer className={`${common.dialogFooter} ${styles.footer}`}><small>{loading ? '正在读取原生执行计划…' : result ? `${result.executionTimeMs} ms · 优化器估算不代表实际耗时` : '查询内容保留，可关闭后修改并重试'}</small><button type="button" className={common.secondary} onClick={close}>{loading ? '取消并关闭' : '关闭'}</button></footer>
    </SqlDialog>}
  </>
}
