'use client'
import { useState } from 'react'
import { FileArrowUp } from '@phosphor-icons/react'
import type { RelationalProvider, RelationalTablePage } from '@fouc/shared'
import { TableImportPanel } from './table-import'
import { SqlDialog } from './sql-library-dialog'
import styles from './data-tools.module.css'

export function TableImportAction({ base, sessionId, provider, schema, page, disabled, onImported }: {
  base: string; sessionId: string; provider: RelationalProvider; schema: string; page: RelationalTablePage | null; disabled: boolean; onImported: () => void
}) {
  const [source, setSource] = useState<{ schema: string; page: RelationalTablePage } | null>(null)
  return <><button type="button" aria-label="导入表数据" title={disabled ? '先解锁写入并完成暂存变更' : 'CSV、TSV、JSON 与 NDJSON 追加导入'} disabled={disabled || !page} onClick={() => page && setSource({ schema, page })}><FileArrowUp size={15} /><span>导入数据</span></button>
    {source && <SqlDialog title="导入表数据" className={styles.dialog} onClose={() => setSource(null)}><div className={styles.body}>
      <TableImportPanel provider={provider} sessionId={sessionId} base={base} schema={source.schema} table={source.page.table} columns={source.page.columns} onImported={onImported} onClose={() => setSource(null)} />
    </div></SqlDialog>}</>
}
