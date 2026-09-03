"use client"

import { Fragment, useState } from "react"
import { ArrowUp, CaretDown, CheckCircle, FileCode, FileText, Folder, PaperPlaneTilt, WarningCircle, X } from "@phosphor-icons/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import type { WorkObjectDetail } from "./project-workobject-detail-data"

const panelTabs = [
  { id: "result", label: "结果" },
  { id: "diff", label: "Diff" },
  { id: "tests", label: "测试" },
  { id: "evidence", label: "证据" },
] as const

type PanelTab = (typeof panelTabs)[number]["id"]

const BLUE = "#4674ab"
const WARN_ORANGE = "#d98e42"

/** 工作对象详情页右侧结果面板：结果 / Diff / 测试 / 证据四个视图共用同一份执行数据 */
export function WorkObjectPanel({ detail, onClose }: { detail: WorkObjectDetail; onClose: () => void }) {
  const [tab, setTab] = useState<PanelTab>("result")
  const fileCount = detail.files.reduce((sum, group) => sum + group.files.length, 0)

  return (
    <aside aria-label="执行结果面板" className="flex h-full min-h-0 flex-col rounded-[10px] border border-[var(--line)] bg-panel">
      <div className="flex h-11 shrink-0 items-center border-b border-[var(--line)] pl-4 pr-1.5">
        <div role="tablist" aria-label="结果视图" className="flex h-full items-center gap-6">
          {panelTabs.map((item) => {
            const active = tab === item.id

            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative flex h-full items-center text-[13px] outline-none transition-colors after:absolute after:-inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#4674ab] after:transition-transform focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]",
                  active ? "font-semibold text-[#3d67a0] after:scale-x-100" : "text-[var(--muted-strong)] after:scale-x-0 hover:text-[var(--ink)]",
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          aria-label="关闭结果面板"
          onClick={onClose}
          className="ml-auto flex size-7 items-center justify-center rounded-[7px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <X className="size-4" />
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 pb-4">
          {tab === "result" || tab === "diff" ? (
            <PanelSection title={`变更文件 (${fileCount})`} action="查看 Diff">
              <FileTree detail={detail} />
            </PanelSection>
          ) : null}
          {tab === "result" ? <div className="border-t border-[var(--line)]" /> : null}
          {tab === "result" || tab === "tests" ? (
            <PanelSection title="验证摘要">
              <VerificationList detail={detail} />
            </PanelSection>
          ) : null}
          {tab === "result" ? (
            <>
              <div className="border-t border-[var(--line)]" />
              <PanelSection title="残余风险">
                <div className="flex items-start gap-2">
                  <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" color={WARN_ORANGE} />
                  <div className="min-w-0 text-[12px] leading-[20px]">
                    <p className="text-[13px] font-semibold text-[var(--ink)]">{detail.risk.level}</p>
                    <p className="mt-1 text-[var(--ink-soft)]">{detail.risk.note}</p>
                  </div>
                </div>
              </PanelSection>
              <div className="border-t border-[var(--line)]" />
            </>
          ) : null}
          {tab === "result" || tab === "evidence" ? (
            <PanelSection title="关键证据">
              <div className="space-y-3">
                {detail.evidence.map((item) => (
                  <div key={item.file} className="flex items-start gap-2">
                    <FileText className="mt-0.5 size-[15px] shrink-0 text-[var(--muted-strong)]" />
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium text-[var(--ink-soft)]">{item.label}</p>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{item.file}</p>
                    </div>
                  </div>
                ))}
              </div>
            </PanelSection>
          ) : null}
        </div>
      </ScrollArea>

      <div className="shrink-0 space-y-3 px-4 pb-4">
        <button
          type="button"
          className="flex h-[38px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#4674ab] text-[13px] font-semibold text-white outline-none transition-[background-color,transform] hover:bg-[#3d67a0] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-[0.99]"
        >
          <PaperPlaneTilt className="size-[15px]" weight="fill" />
          提交评审
        </button>
        <button
          type="button"
          className="flex h-[38px] w-full items-center justify-center rounded-[10px] border border-[var(--line)] bg-panel text-[12.5px] text-[var(--ink-soft)] outline-none transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          暂不提交
        </button>
      </div>
    </aside>
  )
}

function PanelSection({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="py-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[var(--ink)]">{title}</h3>
        {action ? (
          <button
            type="button"
            className="flex h-8 items-center rounded-[8px] border border-[var(--line)] bg-panel px-3 text-[12px] text-[var(--ink-soft)] outline-none transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            {action}
          </button>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function FileTree({ detail }: { detail: WorkObjectDetail }) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())

  function toggleDir(dir: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(dir)) next.delete(dir)
      else next.add(dir)
      return next
    })
  }

  return (
    <div className="space-y-0.5">
      {detail.files.map((group) => {
        const isCollapsed = collapsed.has(group.dir)

        return (
          <Fragment key={group.dir}>
            <button
              type="button"
              aria-expanded={!isCollapsed}
              onClick={() => toggleDir(group.dir)}
              className="flex h-8 w-full items-center gap-1.5 rounded text-left text-[12px] text-[var(--ink-soft)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <CaretDown className={cn("size-3 shrink-0 text-[var(--muted)] transition-transform", isCollapsed && "-rotate-90")} />
              <Folder className="size-[15px] shrink-0 text-[var(--muted-strong)]" weight="fill" />
              <span className="font-medium">{group.dir}</span>
            </button>
            {isCollapsed
              ? null
              : (
                  <div className="ml-[7px] border-l border-[var(--line)] pl-[18px]">
                    {group.files.map((file) => (
                      <div key={file.name} className="flex h-8 items-center gap-1.5 text-[12px]">
                        <FileCode className="size-[15px] shrink-0" color={BLUE} />
                        <span className="min-w-0 flex-1 truncate text-[var(--ink-soft)]">{file.name}</span>
                        <span className="shrink-0 font-medium text-[var(--ok-ink)]">+{file.add}</span>
                        <span className="ml-3 shrink-0 w-6 text-right font-medium text-[#d0564f]">-{file.del}</span>
                      </div>
                    ))}
                  </div>
                )}
          </Fragment>
        )
      })}
    </div>
  )
}

function VerificationList({ detail }: { detail: WorkObjectDetail }) {
  return (
    <div className="space-y-0.5">
      {detail.verification.map((row) => (
        <div key={row.label} className="flex h-8 items-center gap-2 text-[12px]">
          <CheckCircle className="size-[15px] shrink-0 text-[var(--muted-strong)]" />
          <span className="text-[var(--ink-soft)]">{row.label}</span>
          <span className="ml-auto flex items-center gap-1.5">
            {row.status ? <span className="font-medium text-[var(--ok-ink)]">{row.status}</span> : null}
            <span className="font-medium text-[var(--ink)]">{row.value}</span>
            {row.delta ? (
              <span className="flex items-center gap-0.5 font-medium text-[var(--ok-ink)]">
                <ArrowUp className="size-3" weight="bold" />
                {row.delta}
              </span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  )
}
