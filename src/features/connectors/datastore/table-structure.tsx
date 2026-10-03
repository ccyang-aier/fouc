"use client"

import { useEffect, useRef, useState } from "react"
import type { EditorView } from "@codemirror/view"
import {
  ArrowsClockwise,
  Check,
  Copy,
  DownloadSimple,
  MagnifyingGlass
} from "@phosphor-icons/react"
import type { RelationalTableStructure } from "@fouc/shared"
import { backendFetch } from "@/lib/backend"
import { StructureMetadata, type StructureTab } from "./structure-metadata"
import { SqlEditor } from "./sql-editor"
import styles from "./table-structure.module.css"

const tabs: { key: StructureTab; label: string }[] = [
  { key: "columns", label: "字段" },
  { key: "indexes", label: "索引" },
  { key: "foreignKeys", label: "外键" },
  { key: "constraints", label: "约束" },
  { key: "triggers", label: "触发器" },
  { key: "ddl", label: "DDL" }
]
const propertyLabels: Record<string, string> = {
  owner: "所有者",
  comment: "注释",
  persistence: "持久类型",
  accessMethod: "访问方法",
  tablespace: "表空间",
  options: "选项",
  engine: "引擎",
  collation: "排序规则",
  rowFormat: "行格式",
  withoutRowid: "WITHOUT ROWID",
  strict: "STRICT",
  generatedColumns: "生成字段"
}

export function TableStructure({
  base,
  schema,
  table,
  revision,
  pending,
  onOpenTable
}: {
  base: string
  schema: string
  table: string
  revision: number
  pending: boolean
  onOpenTable: (schema: string, table: string) => void
}) {
  const [structure, setStructure] = useState<RelationalTableStructure | null>(null)
  const [tab, setTab] = useState<StructureTab>("columns")
  const [search, setSearch] = useState("")
  const [loadedKey, setLoadedKey] = useState("")
  const [error, setError] = useState("")
  const [reload, setReload] = useState(0)
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState("")
  const sourceEditor = useRef<EditorView | null>(null)
  const requestKey = `${base}:${schema}:${table}:${revision}:${reload}`
  const loading = loadedKey !== requestKey
  useEffect(() => {
    const controller = new AbortController()
    void backendFetch<RelationalTableStructure>(
      `${base}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/structure`,
      { signal: controller.signal }
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setStructure(value)
          setError("")
          setLoadedKey(requestKey)
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "读取结构失败")
          setLoadedKey(requestKey)
        }
      })
    return () => controller.abort()
  }, [base, schema, table, requestKey])
  async function copyDdl() {
    if (!structure) return
    try {
      await navigator.clipboard.writeText(structure.definition.sql)
      setCopied(true)
      setFeedback("DDL 已复制")
    } catch {
      setFeedback("无法访问剪贴板，请选中 DDL 手动复制")
    }
  }
  function downloadDdl() {
    if (!structure) return
    const url = URL.createObjectURL(
      new Blob([structure.definition.sql], { type: "text/plain;charset=utf-8" })
    )
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${schema}.${table}.sql`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setFeedback("DDL 文件已生成")
  }
  return (
    <section className={styles.root} aria-label="表结构浏览">
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="结构类型">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => {
                setTab(item.key)
                setSearch("")
                setFeedback("")
              }}
            >
              {item.label}
              {structure && item.key !== "ddl" && <small>{structure[item.key].length}</small>}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="刷新表结构"
          disabled={loading || pending}
          onClick={() => {
            setError("")
            setCopied(false)
            setFeedback("")
            setReload((value) => value + 1)
          }}
        >
          <ArrowsClockwise size={14} />
        </button>
      </div>
      {loading ? (
        <p className={styles.empty} role="status">
          正在读取数据库结构…
        </p>
      ) : error ? (
        <div className={styles.error} role="alert">
          <strong>无法读取对象结构</strong>
          <p>{error}</p>
        </div>
      ) : (
        structure && (
          <>
            <div className={styles.properties}>
              {Object.entries(structure.properties)
                .filter(([, value]) => value !== null && value !== "")
                .map(([key, value]) => (
                  <span key={key}>
                    <small>{propertyLabels[key] ?? key}</small>
                    {value}
                  </span>
                ))}
            </div>
            {tab === "ddl" ? (
              <>
                <div className={styles.sourceToolbar}>
                  <span>
                    {structure.definition.origin === "native"
                      ? "数据库原始 DDL"
                      : "根据数据库目录重建的 DDL"}
                  </span>
                  <button type="button" onClick={() => void copyDdl()}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "已复制" : "复制 DDL"}
                  </button>
                  <button type="button" onClick={downloadDdl}>
                    <DownloadSimple size={13} />
                    下载 SQL
                  </button>
                </div>
                <div className={styles.ddl} role="tabpanel" aria-label="对象 DDL">
                  <SqlEditor
                    value={structure.definition.sql}
                    onChange={() => {}}
                    onRun={() => {}}
                    editorRef={sourceEditor}
                    provider={structure.provider}
                    readOnly
                    label="对象 DDL 源码"
                  />
                </div>
              </>
            ) : (
              <>
                <label className={styles.search}>
                  <MagnifyingGlass size={13} />
                  <input
                    aria-label="搜索当前结构"
                    value={search}
                    placeholder="按名称、字段或定义搜索"
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <div
                  className={styles.content}
                  role="tabpanel"
                  aria-label={`结构 ${tabs.find((item) => item.key === tab)?.label}`}
                >
                  <StructureMetadata
                    structure={structure}
                    tab={tab}
                    search={search}
                    pending={pending}
                    onOpenTable={onOpenTable}
                  />
                </div>
              </>
            )}
            <footer className={styles.footer}>
              {structure.definition.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
              {feedback && <p role="status">{feedback}</p>}
            </footer>
          </>
        )
      )}
    </section>
  )
}
