"use client"

import { useEffect, useRef } from "react"
import { X, FileCode } from "@phosphor-icons/react"
import type { RelationalSavePreview } from "@fouc/shared"
import styles from "./table-editing.module.css"
import common from "./relational.module.css"

export function SavePreviewDialog({
  preview,
  busy,
  error,
  onClose,
  onCommit
}: {
  preview: RelationalSavePreview
  busy: boolean
  error: string
  onClose: () => void
  onCommit: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  return (
    <dialog
      ref={dialog}
      className={`${common.dialog} ${styles.previewDialog}`}
      aria-labelledby="save-preview-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <header className={common.dialogHead}>
        <div>
          <FileCode size={18} />
          <h2 id="save-preview-title">确认数据库变更</h2>
        </div>
        <button type="button" aria-label="关闭变更预览" disabled={busy} onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className={styles.previewBody}>
        <div className={styles.summary}>
          <strong>
            {preview.schema}.{preview.table}
          </strong>
          <span>{preview.statements.length} 项变更 · 单个事务</span>
        </div>
        <p className={common.hint}>确认后提交全部变更。若目标记录已变化或任一语句失败，本批次全部回滚。</p>
        {preview.statements.map((statement, index) => (
          <article className={styles.statement} key={index}>
            <header>
              <b>{index + 1}</b>
              <span>
                {statement.kind === "insert" ? "新增" : statement.kind === "update" ? "修改" : "删除"}
              </span>
            </header>
            <pre>{statement.sql}</pre>
            <small>绑定参数</small>
            <pre>{JSON.stringify(statement.parameters, null, 2)}</pre>
          </article>
        ))}
        {error && (
          <p role="alert" className={common.error}>
            {error}
          </p>
        )}
        {busy && (
          <p role="status" className={common.hint}>
            正在提交事务，请等待结果…
          </p>
        )}
      </div>
      <footer className={common.dialogFooter}>
        <button type="button" className={common.secondary} disabled={busy} onClick={onClose}>
          {error ? "返回编辑" : "取消"}
        </button>
        <span />
        <button type="button" className={common.primary} disabled={busy || Boolean(error)} onClick={onCommit}>
          {busy ? "提交中…" : "确认提交"}
        </button>
      </footer>
    </dialog>
  )
}
