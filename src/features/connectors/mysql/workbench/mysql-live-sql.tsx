"use client"

import { useRef, useState } from "react"
import { Play } from "@phosphor-icons/react"
import type { EditorView } from "@codemirror/view"
import { mysqlQueryAtCursor, type DatabaseQueryResult, type MysqlReadOnlyQueryInput } from "@fouc/shared"

import { backendFetch } from "@/lib/backend"
import { databaseCellText } from "./mysql-live-format"
import { MysqlLiveSqlEditor } from "./mysql-live-sql-editor"

type Props = {
  sessionId: string
  database: string
  query: string
  onQueryChange: (query: string) => void
}

export function MysqlLiveSql({ sessionId, database, query, onQueryChange }: Props) {
  const editor = useRef<EditorView | null>(null)
  const runningRef = useRef(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<DatabaseQueryResult | null>(null)
  const [attemptedSql, setAttemptedSql] = useState("")
  const [error, setError] = useState("")

  async function run() {
    if (runningRef.current) return
    const view = editor.current
    const selection = view?.state.selection.main
    const selected = selection && !selection.empty ? view.state.sliceDoc(selection.from, selection.to).trim() : ""
    const source = view?.state.doc.toString() ?? query
    const statement = selected || mysqlQueryAtCursor(source, selection?.head ?? 0)?.sql || source.trim()
    if (!statement) { setError("请输入 SQL 后再运行"); return }
    runningRef.current = true
    setRunning(true)
    setAttemptedSql(statement)
    setError("")
    setResult(null)
    try {
      const input: MysqlReadOnlyQueryInput = { database: database || null, sql: statement, maxRows: 500 }
      const next = await backendFetch<DatabaseQueryResult>(`/api/database/mysql/sessions/${sessionId}/query`, {
        method: "POST", body: JSON.stringify(input),
      })
      setResult(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "查询失败")
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }

  return <div className="mw-sql-workspace mw-live-sql">
    <div className="mw-sql-toolbar">
      <button type="button" className="mw-run" disabled={running} onClick={() => void run()}><Play size={14} />{running ? "执行中…" : "运行"}</button>
      <span className="ml-2 text-[11px] text-[var(--muted-strong)]">只读查询 · Ctrl/⌘ + Enter 运行选中内容或光标所在语句</span>
      <span className="mw-sql-spacer" />
      <span className="mw-sql-select" title="当前数据库">{database || "未指定数据库"}</span>
    </div>
    <div className="mw-editor"><MysqlLiveSqlEditor value={query} onChange={onQueryChange} onRun={() => void run()} editorRef={editor} /></div>
    <div className="mw-result">
      <div className="mw-result-tabs"><div><span className="mw-live-result-title">查询结果</span></div><span>{result ? `${result.rows.length} 行 · ${result.executionTimeMs} ms${result.truncated ? " · 已截断" : ""}` : running ? "正在查询…" : ""}</span></div>
      {error ? <div role="alert" className="mw-result-error">{error}</div>
        : running ? <div className="p-4 text-[11px] text-[var(--muted-strong)]">正在执行只读查询…</div>
          : result ? <div className="mw-result-grid"><table><thead><tr><th>#</th>{result.columns.map((name, index) => <th key={`${name}-${index}`}>{name}<small>{result.columnTypes[index]}</small></th>)}</tr></thead><tbody>{result.rows.map((row, rowIndex) => <tr key={rowIndex}><td>{rowIndex + 1}</td>{row.map((cell, columnIndex) => <td key={columnIndex} title={databaseCellText(cell)}>{databaseCellText(cell)}</td>)}</tr>)}</tbody></table>{result.rows.length === 0 && <p className="p-4 text-[11px] text-[var(--muted-strong)]">查询成功，没有返回记录</p>}</div>
            : <div className="p-4 text-[11px] text-[var(--muted-strong)]">输入 SQL 并运行，结果会显示在这里。</div>}
      <div className="mw-result-footer"><span>{result ? `返回 ${result.rows.length} 行${result.hasMore ? "，后续行未加载" : ""}` : error ? "执行失败" : running ? "执行中" : "尚未运行"}</span><span className="mw-ellipsis" title={attemptedSql}>{attemptedSql || "服务端只读事务"}</span></div>
    </div>
  </div>
}
