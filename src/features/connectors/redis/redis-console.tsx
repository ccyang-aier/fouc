"use client"
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { Play, TerminalWindow, ClockCounterClockwise, Trash, ArrowBendUpLeft, Copy, Check } from "@phosphor-icons/react"
import type { RedisCommandResult, RedisHistoryPage } from "@fouc/shared"
import { backendFetch } from "@/lib/backend"
import styles from "./redis.module.css"
import historyStyles from "./redis-history.module.css"
import { isRedisMonitorCommand } from './redis-monitor-model'
import { useRedisMonitor } from './use-redis-monitor'
import { RedisMonitorOutput } from './redis-monitor-output'

export function RedisConsole({ base, database, onBusyChange }: { base: string; database: number; onBusyChange: (busy: boolean) => void }) {
  const [command, setCommand] = useState("PING")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RedisCommandResult | null>(null)
  const [error, setError] = useState("")
  const [history, setHistory] = useState<RedisHistoryPage | null>(null)
  const [historyError, setHistoryError] = useState("")
  const [historyBusy, setHistoryBusy] = useState(true)
  const [historyRevision, setHistoryRevision] = useState(0)
  const [historyVisible, setHistoryVisible] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [scope, setScope] = useState<"current" | "all">("current")
  const [confirmClear, setConfirmClear] = useState(false)
  const [copied, setCopied] = useState(false)
  const [recallIndex, setRecallIndex] = useState(-1)
  const draft = useRef("")
  const commandInput = useRef<HTMLInputElement>(null)
  const monitor = useRedisMonitor(base)
  const monitoring = monitor.state.status === 'connecting' || monitor.state.status === 'listening'
  const monitorVisible = monitor.state.status !== 'idle'
  const executing = busy || monitoring
  useEffect(() => {
    const controller = new AbortController()
    void backendFetch<RedisHistoryPage>(`${base}/history`, { signal: controller.signal })
      .then((page) => { if (!controller.signal.aborted) setHistory(page) })
      .catch((reason) => { if (!controller.signal.aborted) setHistoryError(reason.message) })
      .finally(() => { if (!controller.signal.aborted) setHistoryBusy(false) })
    return () => controller.abort()
  }, [base, historyRevision])
  function refreshHistory() { setHistoryBusy(true); setHistoryError(""); setHistoryRevision((current) => current + 1) }
  async function run(event: FormEvent) {
    event.preventDefault()
    if (executing || !command.trim()) return
    if (isRedisMonitorCommand(command)) {
      setResult(null); setSelected(null); setError(''); setCopied(false)
      void monitor.start(); return
    }
    monitor.clear()
    setBusy(true)
    onBusyChange(true)
    setError("")
    setResult(null)
    setSelected(null)
    setCopied(false)
    setRecallIndex(-1)
    try {
      setResult(await backendFetch<RedisCommandResult>(`${base}/command`, { method: "POST", body: JSON.stringify({ command }) }))
    } catch (reason) { setError(reason instanceof Error ? reason.message : "执行失败") }
    finally { setBusy(false); onBusyChange(false); refreshHistory() }
  }
  const entries = history?.entries.filter((entry) => scope === "all" || entry.database === database) ?? []
  const historical = history?.entries.find((entry) => entry.id === selected)
  const output = historical?.output ?? (result ? typeof result.result === "string" ? result.result : JSON.stringify(result.result, null, 2) : "")
  function recall(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
    if (!entries.length) return
    event.preventDefault()
    if (event.key === "ArrowUp") {
      if (recallIndex === -1) draft.current = command
      const next = Math.min(recallIndex + 1, entries.length - 1)
      setRecallIndex(next); setCommand(entries[next]!.command)
    } else if (recallIndex >= 0) {
      const next = recallIndex - 1
      setRecallIndex(next); setCommand(next === -1 ? draft.current : entries[next]!.command)
    }
  }
  async function clearHistory() {
    setHistoryBusy(true)
    setHistoryError("")
    try {
      await backendFetch(`${base}/history`, { method: "DELETE" })
      setHistory((current) => current ? { ...current, entries: [] } : current)
      setSelected(null); setConfirmClear(false); setRecallIndex(-1)
    } catch (reason) { setHistoryError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setHistoryBusy(false) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(output); setCopied(true) }
    catch { setError("复制失败，请手动选择内容复制。") }
  }
  return <section className={styles.console} aria-label="Redis 命令台">
    <form onSubmit={(event) => void run(event)}>
      <label><TerminalWindow size={16} /><input ref={commandInput} aria-label="Redis 命令" value={command} disabled={executing}
        onChange={(event) => { setCommand(event.target.value); setRecallIndex(-1) }} onKeyDown={recall} spellCheck={false} /></label>
      <button type="submit" disabled={executing || !command.trim()}><Play size={13} />{executing ? "执行中…" : "运行命令"}</button>
    </form>
    <div className={historyStyles.toolbar}><span>DB {database} · 只读命令 · ↑ ↓ 召回历史草稿</span>
      <button type="button" aria-pressed={historyVisible && !monitorVisible} disabled={monitoring} onClick={() => { if (monitorVisible) { monitor.clear(); setHistoryVisible(true) } else setHistoryVisible((current) => !current) }}><ClockCounterClockwise size={14} />历史</button></div>
    <p className={styles.notice}>PING · DBSIZE · TYPE · TTL / PTTL · STRLEN · LLEN · SCARD · HLEN · ZCARD · XLEN · EXISTS · INFO 单个分区 · MONITOR。MONITOR 监听整个实例的所有 DB，有性能成本；停止或关闭命令台会释放监听连接。监听内容不存入历史。</p>
    <div className={historyStyles.body}>
      <main className={historyStyles.output}>
        {monitorVisible && <RedisMonitorOutput state={monitor.state} onStop={monitor.stop} />}
        {busy && <p role="status" className={styles.notice}>正在 DB {database} 执行只读命令…</p>}
        {error && <div role="alert" className={styles.error}>{error}</div>}
        {(result || historical) && <>
          <div className={historyStyles.resultHead}><span>{historical ? `DB ${historical.database} · ${historical.command} · ${historical.executionTimeMs} ms` : `${result!.command} · ${result!.executionTimeMs} ms`}</span>
            <button type="button" onClick={() => void copy()}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "已复制" : "复制输出"}</button></div>
          {result?.historyWarning && <p role="status" className={styles.notice}>{result.historyWarning}</p>}
          {historical && !historical.success && <p role="alert" className={styles.error}>此条历史执行失败</p>}
          <pre className={styles.content}>{output}</pre>
          {historical?.outputTruncated && <p className={styles.notice}>历史仅保留前 16 KiB 输出；重用命令可重新查询当前结果。</p>}
        </>}
        {!busy && !monitorVisible && !result && !historical && !error && <div className={styles.empty}><TerminalWindow size={26} /><strong>运行一个只读命令</strong><span>结果显示在此处，也可查看本连接的历史输出。</span></div>}
      </main>
      {historyVisible && !monitorVisible && <aside className={historyStyles.history} aria-label="Redis 命令历史">
        <header><strong>最近 {history?.limit ?? 100} 条</strong><button type="button" aria-label="清空命令历史" disabled={busy || historyBusy || !history?.entries.length} onClick={() => setConfirmClear(true)}><Trash size={14} /></button></header>
        <div className={historyStyles.filter}><select aria-label="历史数据库范围" value={scope} onChange={(event) => { setScope(event.target.value as typeof scope); setRecallIndex(-1) }}><option value="current">当前 DB {database}</option><option value="all">本连接全部 DB</option></select>
          <small>{history?.persistent ? "保存在当前设备与工作空间" : "临时会话 · 断开后清除"}</small></div>
        {confirmClear && <div className={historyStyles.confirm}><span>清空本连接所有 DB 的历史？</span><div>
          <button type="button" disabled={historyBusy} onClick={() => void clearHistory()}>确认清空</button><button type="button" disabled={historyBusy} onClick={() => setConfirmClear(false)}>取消</button>
        </div></div>}
        {historyError && <div role="alert" className={styles.error}>{historyError}<button type="button" onClick={refreshHistory}>重试</button></div>}
        <div className={historyStyles.list}>
          {entries.map((entry) => <article key={entry.id} data-selected={selected === entry.id}>
            <button type="button" className={historyStyles.entry} aria-pressed={selected === entry.id} onClick={() => { setSelected(entry.id); setResult(null); setError(""); setCopied(false) }}>
              <strong title={entry.command}>{entry.command}</strong><small><span>DB {entry.database} · {new Date(entry.executedAt).toLocaleTimeString()}</span><span data-failed={!entry.success}>{entry.success ? "成功" : "失败"}</span></small>
            </button>
            <button type="button" aria-label={`重用命令 ${entry.command}`} disabled={busy} className={historyStyles.reuse} onClick={() => { setCommand(entry.command); setRecallIndex(-1); commandInput.current?.focus() }}><ArrowBendUpLeft size={14} /></button>
          </article>)}
          {historyBusy && <p role="status" className={styles.notice}>正在读取历史…</p>}
          {!historyBusy && !entries.length && !historyError && <p className={styles.notice}>此范围没有命令历史。</p>}
        </div>
      </aside>}
    </div>
  </section>
}
