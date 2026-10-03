"use client"
import { useRef, useState } from "react"
import type { EditorView } from "@codemirror/view"
import { Play } from "@phosphor-icons/react"
import type { DatabaseQueryResult, RelationalSession } from "@fouc/shared"
import { backendFetch } from "@/lib/backend"
import { SqlEditor } from "./sql-editor"
import { SqlQueryResult } from "./query-result"

export function RelationalQuery({ session, schema }: { session: RelationalSession; schema: string }) {
  const [query, setQuery] = useState("SELECT 1 AS result;")
  const [result, setResult] = useState<DatabaseQueryResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const editor = useRef<EditorView | null>(null)
  const lock = useRef(false)
  async function run() {
    if (lock.current) return
    const view = editor.current
    const selection = view?.state.selection.main
    const sql =
      selection && !selection.empty
        ? view!.state.sliceDoc(selection.from, selection.to)
        : (view?.state.doc.toString() ?? query)
    lock.current = true
    setRunning(true)
    setError("")
    setResult(null)
    try {
      setResult(
        await backendFetch<DatabaseQueryResult>(
          `/api/database/workspaces/${encodeURIComponent(session.workspaceId)}/relational/sessions/${session.id}/query`,
          { method: "POST", body: JSON.stringify({ sql, schema: schema || null, maxRows: 500 }) }
        )
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "查询失败")
    } finally {
      lock.current = false
      setRunning(false)
    }
  }
  return (
    <div className="mw-sql-workspace mw-live-sql">
      <div className="mw-sql-toolbar">
        <button type="button" className="mw-run" disabled={running} onClick={() => void run()}>
          <Play size={14} />
          {running ? "执行中…" : "运行"}
        </button>
        <span className="ml-2 text-[11px] text-[var(--muted-strong)]">
          只读 · Ctrl/⌘ + Enter 运行选中内容或全部 SQL
        </span>
        <span className="mw-sql-spacer" />
        <span>{schema}</span>
      </div>
      <div className="mw-editor">
        <SqlEditor
          provider={session.provider}
          value={query}
          onChange={setQuery}
          onRun={() => void run()}
          editorRef={editor}
        />
      </div>
      <div className="mw-result">
        {error ? (
          <p className="mw-result-error" role="alert">
            {error}
          </p>
        ) : running ? (
          <p className="mw-live-result-empty" role="status">
            正在执行查询…
          </p>
        ) : result ? (
          <SqlQueryResult result={result} />
        ) : (
          <p className="mw-live-result-empty">运行 SQL 后在这里查看结果。</p>
        )}
      </div>
    </div>
  )
}
