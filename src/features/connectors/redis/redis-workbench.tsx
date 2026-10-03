"use client"
import { useEffect, useState } from "react"
import {
  ArrowLeft,
  ArrowsClockwise,
  Database,
  Key,
  MagnifyingGlass,
  TerminalWindow
} from "@phosphor-icons/react"
import type { RedisKeyInfo, RedisScanPage, RedisSession, RedisValuePage } from "@fouc/shared"
import { backendFetch } from "@/lib/backend"
import { RedisValueViewer, redisTtl } from "./redis-value-viewer"
import { RedisConsole } from "./redis-console"
import styles from "./redis.module.css"

export function RedisWorkbench({
  session,
  name,
  onBack
}: {
  session: RedisSession
  name: string
  onBack: () => void
}) {
  const base = `/api/database/workspaces/${encodeURIComponent(session.workspaceId)}/redis/sessions/${session.id}`
  const [pattern, setPattern] = useState("*")
  const [applied, setApplied] = useState("*")
  const [scan, setScan] = useState<RedisScanPage | null>(null)
  const [keys, setKeys] = useState<RedisKeyInfo[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [value, setValue] = useState<RedisValuePage | null>(null)
  const [mode, setMode] = useState<"keys" | "console">("keys")
  const [scanBusy, setScanBusy] = useState(true)
  const [valueBusy, setValueBusy] = useState(false)
  const [scanError, setScanError] = useState("")
  const [valueError, setValueError] = useState("")
  const [scanRequest, setScanRequest] = useState({ cursor: "0", revision: 0 })
  const [valueRequest, setValueRequest] = useState({ cursor: "0", revision: 0 })
  useEffect(() => {
    const controller = new AbortController()
    void backendFetch<RedisScanPage>(`${base}/scan`, {
      method: "POST",
      body: JSON.stringify({ cursor: scanRequest.cursor, pattern: applied }),
      signal: controller.signal
    })
      .then((page) => {
        if (!controller.signal.aborted) {
          setScan(page)
          setKeys((current) =>
            scanRequest.cursor === "0"
              ? page.keys
              : [...new Map([...current, ...page.keys].map((key) => [key.key.rawBase64, key])).values()]
          )
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setScanError(reason.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setScanBusy(false)
      })
    return () => controller.abort()
  }, [base, applied, scanRequest])
  useEffect(() => {
    if (selected === null) return
    const controller = new AbortController()
    void backendFetch<RedisValuePage>(`${base}/value`, {
      method: "POST",
      body: JSON.stringify({ key: selected, cursor: valueRequest.cursor }),
      signal: controller.signal
    })
      .then((page) => {
        if (!controller.signal.aborted) setValue(page)
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setValueError(reason.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setValueBusy(false)
      })
    return () => controller.abort()
  }, [base, selected, valueRequest])
  function requestScan(cursor = "0") {
    setScanBusy(true)
    setScanError("")
    setScanRequest((current) => ({ cursor, revision: current.revision + 1 }))
  }
  function requestValue(cursor = "0") {
    setValueBusy(true)
    setValueError("")
    setValueRequest((current) => ({ cursor, revision: current.revision + 1 }))
  }
  function refresh() {
    requestScan()
    if (selected !== null) requestValue()
  }
  return (
    <section className={styles.workbench} aria-label="Redis 工作台">
      <header className={styles.header}>
        <button type="button" aria-label="返回数据库连接列表" onClick={onBack}>
          <ArrowLeft size={17} />
        </button>
        <Database size={17} />
        <strong>{name}</strong>
        <span>
          Redis {session.version ?? ""} · DB {session.database}
        </span>
        <small>只读</small>
        <button type="button" aria-label="刷新 Redis 数据" onClick={refresh} disabled={scanBusy || valueBusy}>
          <ArrowsClockwise size={16} />
        </button>
      </header>
      <nav className={styles.tabs} aria-label="Redis 工作台视图">
        <button
          type="button"
          aria-current={mode === "keys" ? "page" : undefined}
          onClick={() => setMode("keys")}
        >
          <Key size={14} />
          Key 浏览
        </button>
        <button
          type="button"
          aria-current={mode === "console" ? "page" : undefined}
          onClick={() => setMode("console")}
        >
          <TerminalWindow size={14} />
          命令台
        </button>
      </nav>
      {mode === "console" ? (
        <RedisConsole base={base} />
      ) : (
        <div className={styles.body}>
          <aside className={styles.keyPanel} aria-label="Redis Key 列表">
            <form
              className={styles.search}
              onSubmit={(event) => {
                event.preventDefault()
                setApplied(pattern || "*")
                requestScan()
                setSelected(null)
                setValue(null)
                setValueBusy(false)
                setValueError("")
                setKeys([])
              }}
            >
              <MagnifyingGlass size={14} />
              <input
                aria-label="Key 匹配规则"
                value={pattern}
                onChange={(event) => setPattern(event.target.value)}
                placeholder="前缀:*"
              />
              <button type="submit" disabled={scanBusy}>
                搜索
              </button>
            </form>
            <div className={styles.keyCount}>
              DB {session.database} · {scan?.totalKeys ?? "…"} 个 Key · 已加载 {keys.length}
            </div>
            {scanError && (
              <div role="alert" className={styles.error}>
                {scanError}
                <button
                  type="button"
                  onClick={() => requestScan(scanRequest.cursor)}
                >
                  重试
                </button>
              </div>
            )}
            <div className={styles.keyList}>
              {keys.map((key) => (
                <button
                  key={key.key.rawBase64}
                  type="button"
                  aria-pressed={selected === key.key.rawBase64}
                  onClick={() => {
                    setSelected(key.key.rawBase64)
                    setValue(null)
                    requestValue()
                  }}
                >
                  <div>
                    <Key size={13} />
                    <span title={key.key.display}>{key.key.display || "（空 Key）"}</span>
                  </div>
                  <small>
                    <span className={styles.type}>{key.type}</span>
                    <span>{redisTtl(key.ttl)}</span>
                  </small>
                </button>
              ))}
              {scanBusy && (
                <div className={styles.notice} role="status">
                  扫描中…
                </div>
              )}
              {!scanBusy && !keys.length && !scanError && (
                <div className={styles.empty}>
                  当前批次没有匹配的 Key{scan?.cursor !== "0" ? "，可继续扫描。" : "。"}
                </div>
              )}
            </div>
            {scan && scan.cursor !== "0" && (
              <button
                type="button"
                className={styles.loadMore}
                disabled={scanBusy}
                onClick={() => requestScan(scan.cursor)}
              >
                继续扫描
              </button>
            )}
          </aside>
          <main className={styles.main}>
            {valueError && (
              <div role="alert" className={styles.error}>
                {valueError}
                <button
                  type="button"
                  onClick={() => requestValue(valueRequest.cursor)}
                >
                  重试
                </button>
              </div>
            )}
            {valueBusy && (
              <p className={styles.notice} role="status">
                读取 Key 内容…
              </p>
            )}
            {value ? (
              <RedisValueViewer
                key={`${selected}:${valueRequest.cursor}`}
                value={value}
                busy={valueBusy}
                onNext={requestValue}
              />
            ) : (
              !valueBusy &&
              !valueError && (
                <div className={styles.empty}>
                  <Key size={30} />
                  <strong>选择一个 Key</strong>
                  <span>查看原始值、集合成员与过期时间。</span>
                </div>
              )
            )}
          </main>
        </div>
      )}
      <footer className={styles.status}>
        Standalone · 当前设备 · Key 与值保留原始字节 · 扫描期间数据可能变化
      </footer>
    </section>
  )
}
