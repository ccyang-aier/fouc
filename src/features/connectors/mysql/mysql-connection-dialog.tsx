"use client"

import { useState, type FormEvent } from "react"
import Image from "next/image"
import { X } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

import type { MysqlConnection, MysqlConnectionEnvironment } from "./mysql-connections-data"

type MysqlConnectionDialogProps = {
  open: boolean
  onClose: () => void
  onCreate: (connection: MysqlConnection) => void
}

const INPUT_CLASS = "h-[34px] w-full rounded-[7px] border border-[var(--line)] bg-panel px-2.5 text-[11px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)]"

export function MysqlConnectionDialog({ open, onClose, onCreate }: MysqlConnectionDialogProps) {
  const [name, setName] = useState("")
  const [host, setHost] = useState("")
  const [port, setPort] = useState("3306")
  const [database, setDatabase] = useState("")
  const [environment, setEnvironment] = useState<MysqlConnectionEnvironment>("开发")

  if (!open) return null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedHost = host.trim()
    if (!trimmedName || !trimmedHost) return

    onCreate({
      id: `mysql-${Date.now()}`,
      name: trimmedName,
      description: "新建连接",
      project: "Fouc 桌面端 V1",
      environment,
      host: `${trimmedHost}:${port || "3306"}`,
      database: database.trim() || "—",
      status: "healthy",
      lastUsed: "刚刚",
      lastUsedOrder: -1,
      favorite: false,
    })
    setName("")
    setHost("")
    setPort("3306")
    setDatabase("")
    setEnvironment("开发")
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(22,27,36,0.22)] p-8 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form onSubmit={submit} className="w-full max-w-[480px] rounded-[12px] border border-[var(--line-strong)] bg-elevated shadow-[0_24px_70px_rgba(24,31,45,0.22)]">
        <header className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-[8px] border border-[var(--line)] bg-panel">
            <Image src="/connector-logos/mysql.svg" alt="" width={22} height={22} />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--ink)]">新建 MySQL 连接</h2>
            <p className="mt-0.5 text-[10px] text-[var(--muted)]">保存一个可在连接器内访问的数据库实例</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="ml-auto flex size-7 items-center justify-center rounded-[6px] text-[var(--muted)] outline-none hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
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
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--surface-subtle)] px-5 py-3.5">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button type="submit" size="sm">创建连接</Button>
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
