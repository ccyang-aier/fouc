"use client"

import { useEffect, useState } from "react"
import { Copy, Database, MagnifyingGlass, PencilSimple, Plus, Trash, ArrowRight } from "@phosphor-icons/react"
import type {
  RelationalConnectionConfig,
  RelationalProvider,
  RelationalSavedConnection,
  RelationalSession,
  RedisConnectionConfig,
  RedisSavedConnection,
  RedisSession
} from "@fouc/shared"
import { backendFetch } from "@/lib/backend"
import { useWorkspace } from "@/features/workspaces/workspace-provider"
import { ConnectorDetailHeader } from "../connector-detail-header"
import { RelationalDialog } from "./relational-dialog"
import { RelationalWorkbench } from "./relational-workbench"
import { RedisDialog } from "../redis/redis-dialog"
import { RedisWorkbench } from "../redis/redis-workbench"
import styles from "./relational.module.css"

type SavedConnection = RelationalSavedConnection | RedisSavedConnection

type Props = { provider: RelationalProvider | "redis"; onBack: () => void; onWorkbenchFocus?: () => void }
export function DatastoreConnections(props: Props) {
  const { activeSpace } = useWorkspace()
  const { onWorkbenchFocus } = props
  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) onWorkbenchFocus?.()
  }, [onWorkbenchFocus])
  return (
    <ConnectionDirectory
      key={`${activeSpace.id}:${props.provider}`}
      {...props}
      workspaceId={activeSpace.id}
    />
  )
}

function ConnectionDirectory({
  provider,
  workspaceId,
  onBack,
  onWorkbenchFocus
}: Props & { workspaceId: string }) {
  const label = provider === "postgres" ? "PostgreSQL" : provider === "redis" ? "Redis" : "SQLite"
  const base = `/api/database/workspaces/${encodeURIComponent(workspaceId)}/${provider === "redis" ? "redis" : "relational"}`
  const [connections, setConnections] = useState<SavedConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [revision, setRevision] = useState(0)
  const [dialog, setDialog] = useState<{
    intent: "save" | "connect"
    connection?: SavedConnection
  } | null>(null)
  const [removing, setRemoving] = useState<SavedConnection | null>(null)
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState<{
    connection: SavedConnection
    session: RelationalSession | RedisSession
  } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void backendFetch<SavedConnection[]>(`${base}/connections`, { signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted) {
          setConnections(items)
          setLoading(false)
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason.message)
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [base, revision])
  useEffect(() => {
    if (!active) return
    return () => {
      void backendFetch(`${base}/sessions/${active.session.id}`, { method: "DELETE" }).catch(() => undefined)
    }
  }, [active, base])
  async function save(name: string, config: RelationalConnectionConfig | RedisConnectionConfig) {
    const id = dialog?.connection?.id
    const item = await backendFetch<SavedConnection>(`${base}/connections${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify({ name, config })
    })
    setConnections((current) => [...current.filter((entry) => entry.id !== item.id), item])
    setDialog(null)
  }
  async function open(connection: SavedConnection, password = "") {
    const session = await backendFetch<RelationalSession | RedisSession>(
      `${base}/connections/${connection.id}/connect`,
      {
        method: "POST",
        body: JSON.stringify({ password })
      }
    )
    setDialog(null)
    setActive({ connection, session })
    onWorkbenchFocus?.()
  }
  async function copy(connection: SavedConnection) {
    setError("")
    try {
      const item = await backendFetch<SavedConnection>(`${base}/connections`, {
        method: "POST",
        body: JSON.stringify({ name: `${connection.name} 副本`, config: connection.config })
      })
      setConnections((current) => [...current, item])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "复制失败")
    }
  }
  async function remove() {
    if (!removing) return
    setBusy(true)
    setError("")
    try {
      await backendFetch(`${base}/connections/${removing.id}`, { method: "DELETE" })
      setConnections((items) => items.filter((item) => item.id !== removing.id))
      setRemoving(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除失败")
    } finally {
      setBusy(false)
    }
  }
  if (active?.session.provider === "redis")
    return (
      <RedisWorkbench session={active.session} name={active.connection.name} onBack={() => setActive(null)} />
    )
  if (active)
    return (
      <RelationalWorkbench
        session={active.session}
        name={active.connection.name}
        onBack={() => setActive(null)}
      />
    )
  const visible = connections.filter(
    (item) =>
      item.config.provider === provider &&
      `${item.name} ${JSON.stringify(item.config)}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase())
  )
  return (
    <section aria-label={`${label} 连接列表`} className={styles.directory}>
      <ConnectorDetailHeader name={label} onBack={onBack} />
      <div className={styles.directoryHead}>
        <div>
          <h1>{label} 连接</h1>
          <p>管理当前工作空间的数据库连接，在工作台中浏览与查询。</p>
        </div>
        <button className={styles.primary} type="button" onClick={() => setDialog({ intent: "save" })}>
          <Plus size={15} />
          新建连接
        </button>
      </div>
      <div className={styles.directoryToolbar}>
        <label className={styles.search}>
          <MagnifyingGlass size={15} />
          <input
            aria-label="搜索连接"
            placeholder="搜索名称或连接地址"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <span>{visible.length} 个连接</span>
      </div>
      {error && (
        <div className={styles.error} role="alert">
          {error}
          <button
            type="button"
            onClick={() => {
              setError("")
              setLoading(true)
              setRevision((value) => value + 1)
            }}
          >
            重试
          </button>
        </div>
      )}
      {removing && (
        <div className={styles.confirm} role="alertdialog" aria-label="删除连接确认">
          <span>删除「{removing.name}」的连接配置？数据库内容保持不变。</span>
          <button
            disabled={busy}
            type="button"
            className={styles.secondary}
            onClick={() => setRemoving(null)}
          >
            取消
          </button>
          <button disabled={busy} type="button" className={styles.danger} onClick={() => void remove()}>
            确认删除
          </button>
        </div>
      )}
      <div className={styles.directoryBody}>
        {loading ? (
          <p className={styles.empty} role="status">
            正在读取连接…
          </p>
        ) : !visible.length ? (
          <div className={styles.empty}>
            <Database size={32} />
            <strong>{search ? "没有匹配的连接" : "连接你的第一个数据库"}</strong>
            <span>{search ? "试试其他名称或地址。" : "连接配置保存在当前设备，并按工作空间隔离。"}</span>
            {!search && (
              <button
                className={styles.secondary}
                type="button"
                onClick={() => setDialog({ intent: "save" })}
              >
                新建连接
              </button>
            )}
          </div>
        ) : (
          <table className={styles.connections}>
            <thead>
              <tr>
                <th>连接名称</th>
                <th>地址 / 文件</th>
                <th>数据库</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Database size={17} />
                    <strong>{item.name}</strong>
                    <small>只读</small>
                  </td>
                  <td title={item.config.provider !== "sqlite" ? item.config.host : item.config.path}>
                    {item.config.provider !== "sqlite"
                      ? `${item.config.host}:${item.config.port}`
                      : item.config.path}
                  </td>
                  <td>{item.config.provider !== "sqlite" ? item.config.database : "main"}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.open}
                      onClick={() => setDialog({ intent: "connect", connection: item })}
                    >
                      打开工作台
                      <ArrowRight size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label={`编辑 ${item.name}`}
                      onClick={() => setDialog({ intent: "save", connection: item })}
                    >
                      <PencilSimple size={15} />
                    </button>
                    <button type="button" aria-label={`复制 ${item.name}`} onClick={() => void copy(item)}>
                      <Copy size={15} />
                    </button>
                    <button type="button" aria-label={`删除 ${item.name}`} onClick={() => setRemoving(item)}>
                      <Trash size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {dialog && provider === "redis" ? (
        <RedisDialog
          workspaceId={workspaceId}
          connection={dialog.connection as RedisSavedConnection | undefined}
          intent={dialog.intent}
          onClose={() => setDialog(null)}
          onSave={save}
          onConnect={(password) => open(dialog.connection!, password)}
        />
      ) : (
        dialog &&
        provider !== "redis" && (
          <RelationalDialog
            key={`${dialog.intent}:${dialog.connection?.id ?? "new"}`}
            workspaceId={workspaceId}
            provider={provider}
            connection={dialog.connection as RelationalSavedConnection | undefined}
            intent={dialog.intent}
            onClose={() => setDialog(null)}
            onSave={save}
            onConnect={(password) => open(dialog.connection!, password)}
          />
        )
      )}
    </section>
  )
}
