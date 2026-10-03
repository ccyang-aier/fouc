"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { CheckCircle, Database, X } from "@phosphor-icons/react"
import type { RedisConnectionConfig, RedisSavedConnection, RedisSession } from "@fouc/shared"
import { backendFetch } from "@/lib/backend"
import styles from "../datastore/relational.module.css"

export function RedisDialog({
  workspaceId,
  connection,
  intent,
  onClose,
  onSave,
  onConnect
}: {
  workspaceId: string
  connection?: RedisSavedConnection
  intent: "save" | "connect"
  onClose: () => void
  onSave: (name: string, config: RedisConnectionConfig) => Promise<void>
  onConnect: (password: string) => Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const previous = connection?.config
  const [name, setName] = useState(connection?.name ?? "")
  const [host, setHost] = useState(previous?.host ?? "127.0.0.1")
  const [port, setPort] = useState(String(previous?.port ?? 6379))
  const [username, setUsername] = useState(previous?.username ?? "")
  const [database, setDatabase] = useState(String(previous?.database ?? 0))
  const [tls, setTls] = useState(previous?.tls ?? false)
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState("")
  const config: RedisConnectionConfig = {
    provider: "redis",
    host,
    port: Number(port),
    username,
    database: Number(database),
    tls
  }
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  async function perform(test = false) {
    setBusy(true)
    setError("")
    setFeedback("")
    try {
      if (test) {
        const base = `/api/database/workspaces/${encodeURIComponent(workspaceId)}/redis/sessions`
        const session = await backendFetch<RedisSession>(base, {
          method: "POST",
          body: JSON.stringify({ ...config, password })
        })
        await backendFetch(`${base}/${session.id}`, { method: "DELETE" })
        setFeedback(`连接成功 · Redis ${session.version ?? "版本未知"} · DB ${session.database}`)
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
    void perform()
  }
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="redis-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <form onSubmit={submit}>
        <header className={styles.dialogHead}>
          <div>
            <Database size={20} />
            <h2 id="redis-dialog-title">
              {intent === "connect"
                ? `打开 ${connection?.name}`
                : connection
                  ? "编辑 Redis 连接"
                  : "新建 Redis 连接"}
            </h2>
          </div>
          <button type="button" aria-label="关闭连接对话框" disabled={busy} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className={styles.formBody}>
          {intent === "save" ? (
            <>
              <label>
                连接名称
                <input
                  required
                  autoFocus
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
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
              <div className={styles.formColumns}>
                <label>
                  ACL 用户名
                  <input
                    placeholder="默认用户可留空"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </label>
                <label>
                  数据库编号
                  <input
                    required
                    type="number"
                    min={0}
                    max={1023}
                    value={database}
                    onChange={(event) => setDatabase(event.target.value)}
                  />
                </label>
              </div>
              <label className={styles.checkbox}>
                <input type="checkbox" checked={tls} onChange={(event) => setTls(event.target.checked)} />
                启用 TLS 并验证服务器证书
              </label>
            </>
          ) : (
            <p className={styles.hint}>
              {connection?.config.host}:{connection?.config.port} · DB {connection?.config.database}
            </p>
          )}
          <label>
            密码
            <input
              autoFocus={intent === "connect"}
              type="password"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <p className={styles.hint}>
            支持 Standalone 连接。密码仅用于本次测试或会话，连接配置按工作空间保存在当前设备。
          </p>
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
          {feedback && (
            <div className={styles.success} role="status">
              <CheckCircle size={16} />
              {feedback}
            </div>
          )}
        </div>
        <footer className={styles.dialogFooter}>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={() => void perform(true)}
          >
            测试连接
          </button>
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
