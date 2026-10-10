"use client"

import { useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { Table, Copy } from '@phosphor-icons/react'
import type { RelationalProvider, RelationalTableStructure } from '@fouc/shared'
import { Button } from '@/components/ui/button'
import { useAppAlert } from '@/components/app-alert-provider'
import { SqlDialog } from './sql-library-dialog'
import { SqlEditor } from './sql-editor'
import { useSqlResource } from './use-sql-resource'
import { sqlResultSource } from './sql-result-label'
import styles from './query-result.module.css'

export type SqlResultQueryContext = { base: string; sql: string; schema: string | null }
export function SqlResultDdlAction({ context, provider }: { context: SqlResultQueryContext | undefined; provider: RelationalProvider }) {
  const source = context ? sqlResultSource(context.sql, provider, context.schema) : null
  const [open, setOpen] = useState(false), [revision, setRevision] = useState(0)
  const editor = useRef<EditorView | null>(null), { notify } = useAppAlert()
  const resource = useSqlResource<RelationalTableStructure>(open && source && context ? `${context.base}/schemas/${encodeURIComponent(source.schema)}/tables/${encodeURIComponent(source.table)}/structure` : null, undefined, revision)
  return <>
    <Button variant="ghost" size="sm" aria-label="查看结果来源 DDL" disabled={!source} loading={open && resource.busy} title={source ? `查看 ${source.schema}.${source.table} 的 DDL` : '当前结果的来源无法唯一确定'} onClick={() => setOpen(true)}><Table weight="bold" /><span>DDL</span></Button>
    {open && source && <SqlDialog title={`${source.schema}.${source.table} · DDL`} className={styles.ddlDialog} onClose={() => setOpen(false)}>
      {resource.busy ? <p className={styles.ddlState} role="status">正在读取对象 DDL…</p> : resource.error ? <div className={styles.ddlState} role="alert"><p>{resource.error}</p><Button variant="outline" size="sm" onClick={() => setRevision(value => value + 1)}>重试</Button></div> : resource.data && <>
        <div className={styles.ddlCaption}>{resource.data.definition.origin === 'native' ? '数据库原始 DDL' : '根据数据库目录重建的 DDL'}</div>
        {resource.data.definition.warnings.map((warning, index) => <p key={index} className={styles.ddlCaption} role="status">{warning}</p>)}
        <div className={styles.ddlEditor}><SqlEditor provider={provider} value={resource.data.definition.sql} readOnly label="对象 DDL 源码" editorRef={editor} onChange={() => {}} onRun={() => {}} /></div>
      </>}
      <footer className={styles.ddlFooter}><span>只读查看</span><Button variant="ghost" size="sm" disabled={!resource.data || resource.busy} onClick={async () => { try { await navigator.clipboard.writeText(resource.data!.definition.sql); notify('success', '已复制 DDL') } catch { notify('error', '复制失败，请检查剪贴板权限') } }}><Copy />复制 DDL</Button></footer>
    </SqlDialog>}
  </>
}
