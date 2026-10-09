"use client"

import { useEffect, useState, type RefObject } from "react"
import { createPortal } from "react-dom"
import { Plus, PencilSimple, Trash, FileCode, X, ArrowCounterClockwise } from "@phosphor-icons/react"
import type {
  DatabaseTablePage,
  RelationalRowChange,
  RelationalSavePreview,
  RelationalSaveResult
} from "@fouc/shared"
import { backendFetch } from "@/lib/backend"
import { RowEditDialog } from "./row-edit-dialog"
import { SavePreviewDialog } from "./save-preview-dialog"
import styles from "./table-editing.module.css"
import common from "./relational.module.css"

import { GridEditingActions, useGridDraftHistory, type GridEditDraft as Draft, type GridEditCell, type GridEditSelection } from './grid-editing'
export function TableEditing({
  base,
  schema,
  page,
  selectedRow,
  provider, selection, activeCell, shortcutTarget, onDraftsChange,
  writable,
  disabled,
  onPending,
  onSaved,
  toolbarTarget,
  toolsTarget
}: {
  base: string
  schema: string
  page: DatabaseTablePage
  selectedRow: number | null
  provider: import('@fouc/shared').RelationalProvider
  selection: GridEditSelection | null
  activeCell: GridEditCell | null
  shortcutTarget: RefObject<HTMLElement | null>
  onDraftsChange: (drafts: Draft[]) => void
  writable: boolean
  disabled: boolean
  onPending: (pending: boolean) => void
  onSaved: (message: string) => void
  toolbarTarget?: HTMLElement | null
  toolsTarget?: HTMLElement | null
}) {
  const history = useGridDraftHistory()
  const { drafts } = history
  useEffect(() => { onPending(drafts.length > 0); onDraftsChange(drafts) }, [drafts, onPending, onDraftsChange])
  const [editing, setEditing] = useState<{ row: number | null } | null>(null)
  const [preview, setPreview] = useState<RelationalSavePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const selected = selectedRow === null ? null : page.rows[selectedRow]
  const identifiable = page.columns.some((column) => column.isPrimaryKey || column.isUnique)
  function update(next: Draft[]) {
    history.apply(next)
    setError("")
  }
  function stage(change: RelationalRowChange, row: number | null) {
    const existing = row === null ? undefined : drafts.find((draft) => draft.row === row)
    update([
      ...drafts.filter((draft) => draft !== existing),
      { id: existing?.id ?? crypto.randomUUID(), row, change }
    ])
    setEditing(null)
  }
  async function prepare() {
    setBusy(true)
    setError("")
    try {
      setPreview(
        await backendFetch<RelationalSavePreview>(`${base}/save-plans`, {
          method: "POST",
          body: JSON.stringify({ schema, table: page.table, changes: drafts.map((draft) => draft.change) })
        })
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法生成预览")
    } finally {
      setBusy(false)
    }
  }
  function closePreview() {
    if (preview) void backendFetch(`${base}/save-plans/${preview.id}`, { method: "DELETE" }).catch(() => {})
    setPreview(null)
    setError("")
  }
  async function commit() {
    if (!preview) return
    setBusy(true)
    setError("")
    try {
      const result = await backendFetch<RelationalSaveResult>(`${base}/save-plans/${preview.id}/commit`, {
        method: "POST",
        body: JSON.stringify({ confirm: true })
      })
      history.reset()
      setPreview(null)
      onSaved(`已提交 ${result.affectedRows} 项变更 · ${result.executionTimeMs} ms`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "提交失败，请刷新后检查数据")
    } finally {
      setBusy(false)
    }
  }
  const prior =
    editing?.row == null
      ? undefined
      : drafts.find((draft) => draft.row === editing.row && draft.change.kind === "update")?.change
  const toolbar = <div className={toolbarTarget ? styles.nativeToolbar : styles.toolbar}>
    <button type="button" disabled={!writable || disabled || busy} onClick={() => setEditing({ row: null })}><Plus size={14} />新增行</button>
    <button type="button" disabled={!writable || disabled || busy || !selected || !identifiable} onClick={() => setEditing({ row: selectedRow })}><PencilSimple size={14} />编辑行</button>
    <button type="button" className="fouc-action" data-variant="destructive" disabled={!writable || disabled || busy || !selected || !identifiable} onClick={() => selected && stage({ kind: "delete", original: selected }, selectedRow)}><Trash size={14} />删除行</button>
    <button type="button" className={styles.submit} disabled={!drafts.length || busy || disabled} onClick={() => void prepare()}><FileCode size={14} />提交</button>
    <button type="button" disabled={!drafts.length || busy} onClick={() => { history.reset(); setError("") }}><ArrowCounterClockwise size={14} />回滚</button>
  </div>
  return (
    <div className={styles.editing}>
      {toolbarTarget ? createPortal(toolbar, toolbarTarget) : toolbar}
      <GridEditingActions page={page} provider={provider} selection={selection} activeCell={activeCell} shortcutTarget={shortcutTarget} writable={writable} disabled={disabled || busy || !!preview || !!editing} history={history} toolbarTarget={toolsTarget} />
      {drafts.length > 0 && (
        <div className={styles.drafts}>
          <div className={styles.draftHead}>
            <strong>{drafts.length} 项待提交变更</strong>
            <button type="button" disabled={busy} onClick={() => update([])}>
              放弃全部
            </button>
            <button
              type="button"
              className={common.primary}
              disabled={busy || disabled}
              onClick={() => void prepare()}
            >
              <FileCode size={14} />
              {busy ? "生成预览…" : "预览并提交"}
            </button>
          </div>
          <div className={styles.draftList}>
            {drafts.map((draft) => (
              <span key={draft.id}>
                <b>
                  {draft.change.kind === "insert"
                    ? "新增记录"
                    : draft.change.kind === "delete"
                      ? "删除"
                      : "修改"}
                </b>
                {draft.row === null ? "" : `第 ${page.offset + draft.row + 1} 行`}
                <button
                  type="button"
                  aria-label={`移除变更 ${drafts.indexOf(draft) + 1}`}
                  disabled={busy}
                  onClick={() => update(drafts.filter((item) => item.id !== draft.id))}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      {error && !preview && (
        <p className={common.error} role="alert">
          {error}
        </p>
      )}
      {editing && (
        <RowEditDialog
          columns={page.columns}
          original={editing.row === null ? undefined : page.rows[editing.row]}
          values={prior?.kind === "update" ? prior.values : undefined}
          onClose={() => setEditing(null)}
          onStage={(change) => stage(change, editing.row)}
        />
      )}
      {preview && (
        <SavePreviewDialog
          preview={preview}
          busy={busy}
          error={error}
          onClose={closePreview}
          onCommit={() => void commit()}
        />
      )}
    </div>
  )
}
