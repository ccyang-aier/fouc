"use client"

import { useState, type FormEvent } from "react"
import Image from "next/image"
import { X } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

import type { MysqlConnectionEnvironment } from "./mysql-connections-data"

export type MysqlConnectionDraft = {
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string
  environment: MysqlConnectionEnvironment
}

type MysqlConnectionDialogProps = {
  open: boolean
  onClose: () => void
  onCreate: (connection: MysqlConnectionDraft) => Promise<void>
}

const INPUT_CLASS = "h-[34px] w-full rounded-[7px] border border-[var(--line)] bg-panel px-2.5 text-[11px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)]"

export function MysqlConnectionDialog({ open, onClose, onCreate }: MysqlConnectionDialogProps) {
  const [name, setName] = useState("")
  const [host, setHost] = useState("")
  const [port, setPort] = useState("3306")
  const [database, setDatabase] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [environment, setEnvironment] = useState<MysqlConnectionEnvironment>("开发")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  if (!open) return null

  function close() {
    if (submitting) return
    setPassword("")
    setError("")
    onClose()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedHost = host.trim()
    const parsedPort = Number(port)
    if (!trimmedName || !trimmedHost || !username.trim() || !Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      setError("请填写有效的名称、主机、端口和用户")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      await onCreate({ name: trimmedName, host: trimmedHost, port: parsedPort, database: database.trim(), username: username.trim(), password, environment })
      setName("")
      setHost("")
      setPort("3306")
      setDatabase("")
      setUsername("")
      setPassword("")
      setEnvironment("开发")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "连接失败，请检查连接参数")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(22,27,36,0.22)] p-8 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
      <form onSubmit={submit} className="w-full max-w-[480px] rounded-[12px] border border-[var(--line-strong)] bg-elevated shadow-[0_24px_70px_rgba(24,31,45,0.22)]">
        <header className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-[8px] border border-[var(--line)] bg-panel">
            <Image src="/connector-logos/mysql.svg" alt="" width={22} height={22} />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--ink)]">新建 MySQL 连接</h2>
            <p className="mt-0.5 text-[10px] text-[var(--muted)]">连接数据库；本次会话结束后不会保留密码</p>
          </div>
          <button type="button" onClick={close} disabled={submitting} aria-label="关闭" className="ml-auto flex size-7 items-center justify-center rounded-[6px] text-[var(--muted)] outline-none hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            <X className="size-4" weight="bold" />
          </button>
        </header>

        <div className="grid grid-cols-2 gap-4 px-5 py-5">
          <Field label="连接名称" className="col-span-2">
            <input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：生产订单库" className={INPUT_CLASS} />
          </Field>
          <Field label="主机">
            <input required value={host} onChange={(event) => setHost(event.target.value)} placeholder="mysql.example.com" className={INPUT_CLASS} />
          </Field>
          <Field label="端口">
            <input inputMode="numeric" value={port} onChange={(event) => setPort(event.target.value)} className={INPUT_CLASS} />
          </Field>
          <Field label="数据库">
            <input value={database} onChange={(event) => setDatabase(event.target.value)} placeholder="可选" className={INPUT_CLASS} />
          </Field>
          <Field label="环境">
            <select value={environment} onChange={(event) => setEnvironment(event.target.value as MysqlConnectionEnvironment)} className={INPUT_CLASS}>
              <option>生产</option><option>分析</option><option>预发布</option><option>开发</option><option>其他</option>
            </select>
          </Field>
          <Field label="用户">
            <input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="MySQL 用户" className={INPUT_CLASS} />
          </Field>
          <Field label="密码">
            <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="可留空" className={INPUT_CLASS} />
          </Field>
          {error && <p role="alert" className="col-span-2 text-[11px] text-[var(--danger,#d44848)]">{error}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--surface-subtle)] px-5 py-3.5">
          <Button type="button" variant="outline" size="sm" onClick={close} disabled={submitting}>取消</Button>
          <Button type="submit" size="sm" disabled={submitting}>{submitting ? "连接中…" : "连接"}</Button>
        </footer>
      </form>
    </div>
  )
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[10px] font-medium text-[var(--muted-strong)]">{label}</span>
      {children}
    </label>
  )
}
