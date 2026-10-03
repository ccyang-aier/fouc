"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { X, Database, CheckCircle } from "@phosphor-icons/react"
import type {
  RelationalConnectionConfig,
  RelationalProvider,
  RelationalSavedConnection,
  RelationalSession
} from "@fouc/shared"
import { backendFetch } from "@/lib/backend"
import styles from "./relational.module.css"

type Props = {
  workspaceId: string
  provider: RelationalProvider
  connection?: RelationalSavedConnection
  intent: "save" | "connect"
  onClose: () => void
  onSave: (name: string, config: RelationalConnectionConfig) => Promise<void>
  onConnect: (password: string) => Promise<void>
}

export function RelationalDialog({
  workspaceId,
  provider,
  connection,
  intent,
  onClose,
  onSave,
  onConnect
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(connection?.name ?? "")
  const previous = connection?.config
  const network = previous?.provider !== "sqlite" ? previous : undefined
  const [host, setHost] = useState(network?.host ?? "127.0.0.1")
  const [port, setPort] = useState(String(network?.port ?? (provider === "mysql" ? 3306 : 5432)))
  const [username, setUsername] = useState(network?.username ?? (provider === "mysql" ? "root" : "postgres"))
  const [database, setDatabase] = useState(network?.database ?? (provider === "mysql" ? "" : "postgres"))
  const [path, setPath] = useState(previous?.provider === "sqlite" ? previous.path : "")
  const [ssl, setSsl] = useState(network?.ssl ?? false)
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState("")
  const label = provider === "postgres" ? "PostgreSQL" : provider === "mysql" ? "MySQL" : "SQLite"
  const config: RelationalConnectionConfig =
    provider !== "sqlite"
      ? { provider, host, port: Number(port), username, database, ssl }
      : { provider, path }

  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  async function perform(action: "submit" | "test") {
    setBusy(true)
    setError("")
    setFeedback("")
    try {
      if (action === "test") {
        const base = `/api/database/workspaces/${encodeURIComponent(workspaceId)}/relational/sessions`
        const session = await backendFetch<RelationalSession>(base, {
          method: "POST",
          body: JSON.stringify({ ...config, password })
        })
        await backendFetch(`${base}/${session.id}`, { method: "DELETE" })
        setFeedback(`连接成功 · ${session.info.productName} · ${session.info.productVersion}`)
      } else if (intent === "connect") await onConnect(password)
      else await onSave(name, config)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "连接操作失败")
    } finally {
      setBusy(false)
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    void perform("submit")
  }
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="relational-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <form onSubmit={submit}>
        <header className={styles.dialogHead}>
          <div>
            <Database size={20} />
            <h2 id="relational-dialog-title">
              {intent === "connect"
                ? `打开 ${connection?.name}`
                : connection
                  ? `编辑 ${label} 连接`
                  : `新建 ${label} 连接`}
            </h2>
          </div>
          <button type="button" aria-label="关闭连接对话框" disabled={busy} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className={styles.formBody}>
          {intent === "save" && (
            <>
              <label>
                连接名称
                <input
                  autoFocus
                  required
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：本地开发数据库"
                />
              </label>
              {provider !== "sqlite" ? (
                <>
                  <div className={styles.formColumns}>
                    <label>
                      主机
                      <input required value={host} onChange={(event) => setHost(event.target.value)} />
                    </label>
                    <label>
                      端口
                      <input
                        required
                        type="number"
                        min={1}
                        max={65535}
                        value={port}
                        onChange={(event) => setPort(event.target.value)}
                      />
                    </label>
                  </div>
                  <label>
                    数据库
                    <input
                      required={provider === "postgres"}
                      placeholder={provider === "mysql" ? "可留空，在工作台选择数据库" : undefined}
                      value={database}
                      onChange={(event) => setDatabase(event.target.value)}
                    />
                  </label>
                  <label>
                    用户名
                    <input
                      required
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <label className={styles.checkbox}>
                    <input type="checkbox" checked={ssl} onChange={(event) => setSsl(event.target.checked)} />
                    使用 TLS 并验证服务器证书
                  </label>
                </>
              ) : (
                <label>
                  设备上的 SQLite 文件
                  <input
                    required
                    value={path}
                    onChange={(event) => setPath(event.target.value)}
                    placeholder="C:\\data\\application.db"
                  />
                  <small>使用绝对路径；文件须位于当前设备并已存在。</small>
                </label>
              )}
            </>
          )}
          {provider !== "sqlite" && (
            <label>
              密码
              <input
                type="password"
                autoFocus={intent === "connect"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="off"
              />
              <small>仅用于本次连接或测试，不会保存到连接配置。</small>
            </label>
          )}
          <p className={styles.hint}>使用只读会话浏览结构与执行查询。</p>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {feedback && (
            <p className={styles.success} role="status">
              <CheckCircle size={15} />
              {feedback}
            </p>
          )}
        </div>
        <footer className={styles.dialogFooter}>
          {intent === "save" && (
            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={() => void perform("test")}
            >
              测试连接
            </button>
          )}
          <span />
          <button type="button" className={styles.secondary} disabled={busy} onClick={onClose}>
            取消
          </button>
          <button type="submit" className={styles.primary} disabled={busy}>
            {busy ? "处理中…" : intent === "connect" ? "连接并打开" : "保存连接"}
          </button>
        </footer>
      </form>
    </dialog>
  )
}
