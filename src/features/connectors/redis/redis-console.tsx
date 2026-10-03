"use client"
import { useState, type FormEvent } from "react"
import { Play, TerminalWindow } from "@phosphor-icons/react"
import type { RedisCommandResult } from "@fouc/shared"
import { backendFetch } from "@/lib/backend"
import styles from "./redis.module.css"

export function RedisConsole({ base }: { base: string }) {
  const [command, setCommand] = useState("PING")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RedisCommandResult | null>(null)
  const [error, setError] = useState("")
  async function run(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setResult(null)
    try {
      setResult(
        await backendFetch<RedisCommandResult>(`${base}/command`, {
          method: "POST",
          body: JSON.stringify({ command })
        })
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "执行失败")
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className={styles.console} aria-label="Redis 命令台">
      <form onSubmit={(event) => void run(event)}>
        <label>
          <TerminalWindow size={16} />
          <input
            aria-label="Redis 命令"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            spellCheck={false}
          />
        </label>
        <button type="submit" disabled={busy || !command.trim()}>
          <Play size={13} />
          {busy ? "执行中…" : "运行命令"}
        </button>
      </form>
      <p className={styles.notice}>
        只读：PING · DBSIZE · TYPE · TTL / PTTL · STRLEN · LLEN · SCARD · HLEN · ZCARD · XLEN · EXISTS · INFO
        单个分区
      </p>
      {error && (
        <div role="alert" className={styles.error}>
          {error}
        </div>
      )}
      {result && (
        <>
          <div className={styles.commandStatus}>
            {result.command} · {result.executionTimeMs} ms
          </div>
          <pre className={styles.content}>
            {typeof result.result === "string" ? result.result : JSON.stringify(result.result, null, 2)}
          </pre>
        </>
      )}
    </section>
  )
}
