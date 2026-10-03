"use client"

import { useState } from "react"
import { Copy, Check, PencilSimple, Trash, Plus, Clock, TextAa } from "@phosphor-icons/react"
import type { RedisBlob, RedisMutation, RedisValuePage } from "@fouc/shared"
import styles from "./redis.module.css"
import { RedisStreamGroupsView } from "./redis-stream-groups"
import { RedisJsonView } from './redis-json-view'
import { formatJsonSource } from '@fouc/shared'

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
  onNext,
  readOnly,
  onMutation,
  onEditString,
  base,
  onDraftChange
}: {
  value: RedisValuePage
  busy: boolean
  onNext: (cursor: string) => void
  readOnly: boolean
  onMutation: (mutation: RedisMutation) => void
  onEditString: () => void
  base: string
  onDraftChange: (dirty: boolean) => void
}) {
  const [format, setFormat] = useState<"text" | "json" | "base64">("text")
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState("")
  const [streamTab, setStreamTab] = useState<"entries" | "groups">("entries")
  const data = value.data
  const next = "nextCursor" in data ? data.nextCursor : null
  let columns: string[] = [],
    rows: RedisBlob[][] = []
  const actions: { edit?: RedisMutation; remove?: RedisMutation; expiry?: RedisMutation }[] = []
  const key = value.key.rawBase64
  const editable = !readOnly && Boolean(value.writeVersion) && !busy
  const text = (display: string): RedisBlob => ({ display, encoding: "utf8", rawBase64: "" })
  if (data.kind === "list") {
    columns = ["索引", "值"]
    rows = data.items.map((item) => [text(item.index), item.value])
    actions.push(...data.items.map((item) => ({
      edit: { kind: "list-set" as const, key, index: item.index, value: item.value.rawBase64 },
      remove: { kind: "list-remove" as const, key, index: item.index }
    })))
  }
  if (data.kind === "set") {
    columns = ["成员"]
    rows = data.items.map((item) => [item])
    actions.push(...data.items.map((item) => ({ remove: { kind: "set-remove" as const, key, member: item.rawBase64 } })))
  }
  if (data.kind === "hash") {
    columns = ["字段", "值", "字段 TTL"]
    rows = data.items.map((item) => [item.field, item.value, text(item.ttlMs === null ? "未知" : item.ttlMs === -2 ? "已过期" : item.ttlMs === -1 ? "永久" : `${item.ttlMs} ms`)])
    actions.push(...data.items.map((item) => ({
      edit: { kind: "hash-set" as const, key, field: item.field.rawBase64, destination: item.field.rawBase64, value: item.value.rawBase64 },
      remove: { kind: "hash-remove" as const, key, field: item.field.rawBase64 },
      ...(data.fieldExpiry.available && item.ttlMs !== null && item.ttlMs !== -2 ? { expiry: { kind: "hash-expiry" as const, key, field: item.field.rawBase64, mode: "persist" as const } } : {})
    })))
  }
  if (data.kind === "zset") {
    columns = ["成员", "分数"]
    rows = data.items.map((item) => [item.member, text(item.score)])
    actions.push(...data.items.map((item) => ({
      edit: { kind: "zset-set" as const, key, member: item.member.rawBase64, destination: item.member.rawBase64, score: item.score },
      remove: { kind: "zset-remove" as const, key, member: item.member.rawBase64 }
    })))
  }
  if (data.kind === "stream") {
    columns = ["消息 ID", "字段", "值"]
    rows = data.items.flatMap((item) => item.fields.map((field) => [text(item.id), field.field, field.value]))
    actions.push(...data.items.flatMap((item) => item.fields.map((_, index) => index === 0 ?
      { remove: { kind: "stream-remove" as const, key, entryId: item.id } } : {})))
  }
  function add() {
    if (data.kind === "list") onMutation({ kind: "list-push", key, side: "right", value: "" })
    else if (data.kind === "set") onMutation({ kind: "set-add", key, member: "" })
    else if (data.kind === "hash") onMutation({ kind: "hash-add", key, field: "", value: "" })
    else if (data.kind === "zset") onMutation({ kind: "zset-add", key, member: "", score: "0" })
    else if (data.kind === "stream") onMutation({ kind: "stream-add", key, entryId: "*", fields: [{ field: "", value: "" }] })
  }
  let content = data.kind === "string" ? data.content.display : ""
  let jsonError = ""
  if (data.kind === "string" && format === "base64") content = data.content.rawBase64
  if (data.kind === "string" && format === "json") {
    try {
      content = formatJsonSource(data.content.display, 2)
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
      {!readOnly && data.kind !== "none" && <>
        <div className={styles.mutationToolbar}>
          <div>
            {data.kind === "string" ? <button type="button" disabled={busy || !value.writeVersion} onClick={onEditString}><PencilSimple size={14} />编辑值</button> :
              data.kind !== "unsupported" && data.kind !== 'json' && <button type="button" disabled={!editable} onClick={add}><Plus size={14} />添加项</button>}
            <button type="button" disabled={!editable} onClick={() => onMutation({ kind: "expiry", key, mode: "persist" })}><Clock size={14} />过期时间</button>
            <button type="button" disabled={!editable} onClick={() => onMutation({ kind: "rename", key, destination: key })}><TextAa size={14} />重命名</button>
          </div>
          <button type="button" className={styles.dangerButton} disabled={!editable} onClick={() => onMutation({ kind: "delete", key })}><Trash size={14} />删除 Key</button>
        </div>
        {value.writeUnavailable && <p role="status" className={styles.notice}>{value.writeUnavailable}</p>}
      </>}
      {data.kind === "hash" && !data.fieldExpiry.available && data.fieldExpiry.reason && <p role="status" className={styles.notice}>字段 TTL 不可读取：{data.fieldExpiry.reason}</p>}
      {data.kind === "stream" && <div className={styles.valueToolbar}><div role="tablist" aria-label="Stream 视图">
        <button type="button" role="tab" aria-selected={streamTab === "entries"} onClick={() => setStreamTab("entries")}>消息</button>
        <button type="button" role="tab" aria-selected={streamTab === "groups"} onClick={() => setStreamTab("groups")}>消费组</button>
      </div></div>}
      {data.kind === "stream" && streamTab === "groups" ? <RedisStreamGroupsView base={base} rawKey={key} /> : data.kind === "none" ? (
        <div className={styles.empty}>Key 已过期或被删除，请刷新列表。</div>
      ) : data.kind === "unsupported" ? (
        <div className={styles.empty}>此 Redis 模块类型尚未开放值读取。</div>
      ) : data.kind === 'json' ? <RedisJsonView key={`${key}:${value.writeVersion ?? data.content}`} content={data.content} editable={editable} onDraftChange={onDraftChange} onPreview={(json) => onMutation({ kind: 'json-set', key, json })} /> : data.kind === "string" ? (
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
                {!readOnly && <th className={styles.rowActions}>操作</th>}
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
                  {!readOnly && <td className={styles.rowActions}>
                    {actions[index]?.expiry && <button type="button" aria-label={`设置第 ${index + 1} 项字段过期时间`} disabled={!editable} onClick={() => onMutation(actions[index]!.expiry!)}><Clock size={14} /></button>}
                    {actions[index]?.edit && <button type="button" aria-label={`编辑第 ${index + 1} 项`} disabled={!editable} onClick={() => onMutation(actions[index]!.edit!)}><PencilSimple size={14} /></button>}
                    {actions[index]?.remove && <button type="button" aria-label={`删除第 ${index + 1} 项`} disabled={!editable} onClick={() => onMutation(actions[index]!.remove!)}><Trash size={14} /></button>}
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className={styles.notice}>当前批次为空{next ? "，可继续扫描。" : "。"}</p>}
        </div>
      )}
      {next && !(data.kind === "stream" && streamTab === "groups") && (
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
