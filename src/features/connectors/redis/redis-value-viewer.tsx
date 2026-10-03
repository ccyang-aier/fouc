"use client"

import { useState } from "react"
import { Copy, Check } from "@phosphor-icons/react"
import type { RedisBlob, RedisValuePage } from "@fouc/shared"
import styles from "./redis.module.css"

export function redisTtl(ttl: number): string {
  return ttl === -2 ? "已过期" : ttl === -1 ? "永久" : `${ttl}s`
}
function BlobValue({ value }: { value: RedisBlob }) {
  return (
    <code title={value.encoding === "binary" ? "二进制 · 以十六进制展示" : undefined}>
      {value.display || "（空值）"}
    </code>
  )
}

export function RedisValueViewer({
  value,
  busy,
  onNext
}: {
  value: RedisValuePage
  busy: boolean
  onNext: (cursor: string) => void
}) {
  const [format, setFormat] = useState<"text" | "json" | "base64">("text")
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState("")
  const data = value.data
  const next = "nextCursor" in data ? data.nextCursor : null
  let columns: string[] = [],
    rows: RedisBlob[][] = []
  const text = (display: string): RedisBlob => ({ display, encoding: "utf8", rawBase64: "" })
  if (data.kind === "list") {
    columns = ["索引", "值"]
    rows = data.items.map((item) => [text(item.index), item.value])
  }
  if (data.kind === "set") {
    columns = ["成员"]
    rows = data.items.map((item) => [item])
  }
  if (data.kind === "hash") {
    columns = ["字段", "值"]
    rows = data.items.map((item) => [item.field, item.value])
  }
  if (data.kind === "zset") {
    columns = ["成员", "分数"]
    rows = data.items.map((item) => [item.member, text(item.score)])
  }
  if (data.kind === "stream") {
    columns = ["消息 ID", "字段", "值"]
    rows = data.items.flatMap((item) => item.fields.map((field) => [text(item.id), field.field, field.value]))
  }
  let content = data.kind === "string" ? data.content.display : ""
  let jsonError = ""
  if (data.kind === "string" && format === "base64") content = data.content.rawBase64
  if (data.kind === "string" && format === "json") {
    try {
      content = JSON.stringify(JSON.parse(data.content.display), null, 2)
    } catch {
      jsonError = "当前值不是有效 JSON，显示原始内容。"
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setCopyError("")
    } catch {
      setCopyError("复制失败，请手动选择内容复制。")
    }
  }
  return (
    <section className={styles.value} aria-label="Redis 值详情">
      <header className={styles.valueHead}>
        <div>
          <strong title={value.key.display}>{value.key.display || "（空 Key）"}</strong>
          <span className={styles.type}>{value.type.toUpperCase()}</span>
        </div>
        <small>
          TTL {redisTtl(value.ttl)} ·{" "}
          {"total" in data ? `${data.total} ${data.kind === "string" ? "字节" : "项"}` : ""}
        </small>
      </header>
      {data.kind === "none" ? (
        <div className={styles.empty}>Key 已过期或被删除，请刷新列表。</div>
      ) : data.kind === "unsupported" ? (
        <div className={styles.empty}>此 Redis 模块类型尚未开放值读取。</div>
      ) : data.kind === "string" ? (
        <>
          <div className={styles.valueToolbar}>
            <div role="tablist" aria-label="值显示方式">
              {(["text", "json", "base64"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={format === option}
                  onClick={() => {
                    setFormat(option)
                    setCopied(false)
                  }}
                >
                  {option === "text" ? "文本" : option.toUpperCase()}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => void copy()}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "已复制" : "复制当前内容"}
            </button>
          </div>
          {jsonError && (
            <p className={styles.notice} role="status">
              {jsonError}
            </p>
          )}
          {copyError && (
            <p className={styles.error} role="alert">
              {copyError}
            </p>
          )}
          <pre className={styles.content}>{content || "（空值）"}</pre>
          {data.truncated && <p className={styles.notice}>仅显示前 64 KB；当前读取内容不代表完整值。</p>}
        </>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, column) => (
                    <td key={column}>
                      <BlobValue value={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className={styles.notice}>当前批次为空{next ? "，可继续扫描。" : "。"}</p>}
        </div>
      )}
      {next && (
        <footer className={styles.footer}>
          <span>游标分页 · 集合变化可能产生重复项</span>
          <button type="button" disabled={busy} onClick={() => onNext(next)}>
            {busy ? "读取中…" : "下一批"}
          </button>
        </footer>
      )}
    </section>
  )
}
