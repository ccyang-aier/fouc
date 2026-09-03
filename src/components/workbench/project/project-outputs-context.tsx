"use client"

import { useState } from "react"
import { ArrowLineRight, CheckCircle, FileText, Paperclip, PencilSimple, Record } from "@phosphor-icons/react"

import { ScrollArea } from "@/components/ui/scroll-area"

import type { OutputEntry, OutputPerson } from "./project-outputs-data"
import { WorkAssigneeAvatar } from "./work-assignee"

const contextActions = [
  { label: "编辑产物", icon: PencilSimple },
  { label: "发起评审", icon: Record },
  { label: "添加证据", icon: Paperclip },
] as const

type OutputsContextPanelProps = {
  groupId: string | null
  output: OutputEntry | null
  onClose: () => void
}

/** 产物页右侧「项目上下文」：当前选中产物的评审、验证与证据总览 */
export function OutputsContextPanel({ groupId, output, onClose }: OutputsContextPanelProps) {
  return (
    <aside aria-label="产物项目上下文" className="flex h-full min-h-0 flex-col border-l border-[var(--line)] bg-panel max-[1120px]:hidden">
      <div className="flex h-[72px] shrink-0 items-center justify-between pl-8 pr-2.5">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">项目上下文</h2>
        <button
          type="button"
          aria-label="收起项目上下文面板"
          onClick={onClose}
          className="flex size-[30px] items-center justify-center rounded-[8px] bg-[#4674ab] text-white outline-none transition-[background-color,transform] hover:bg-[#3d67a0] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95"
        >
          <ArrowLineRight className="size-4" weight="bold" />
        </button>
      </div>

      {output ? (
        <ContextBody key={output.id} groupId={groupId} output={output} />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-8 text-center text-[12px] leading-5 text-[var(--muted)]">
          在左侧选择一个产物，查看它的评审与验证上下文
        </div>
      )}
    </aside>
  )
}

function ContextBody({ groupId, output }: { groupId: string | null; output: OutputEntry }) {
  const { detail } = output
  const [checks, setChecks] = useState(() => detail.checklist.map((item) => item.done))

  function toggleCheck(index: number) {
    setChecks((current) => current.map((done, i) => (i === index ? !done : done)))
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="pb-6">
        <nav aria-label="上下文位置" className="flex items-center gap-1.5 px-8 text-[11px] leading-[18px] text-[var(--muted-strong)]">
          <span>项目上下文</span>
          <CrumbSlash />
          <span>{groupId}</span>
          <CrumbSlash />
          <span className="font-medium text-[var(--ink-soft)]">{output.name}</span>
        </nav>

        <div className="mt-[15px] flex items-start gap-3 px-8">
          <FileText className="mt-0.5 size-[22px] shrink-0 text-[#4674ab]" />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="truncate text-[13px] font-semibold text-[var(--ink)]">{output.name}</h3>
              <span className="shrink-0 text-[11px] text-[var(--muted)]">{output.version}</span>
            </div>
            <p className="mt-[3px] text-[11.5px] text-[var(--muted)]">{detail.summary}</p>
          </div>
        </div>

        <div className="mt-[18px] grid gap-y-4 px-8">
          <ContextRow label="来源">本项目产物</ContextRow>
          <ContextRow label="创建者">
            <span className="flex items-center gap-2">
              <WorkAssigneeAvatar assignee={detail.creator} size="sm" />
              {detail.creator.name}
            </span>
            <p className="mt-1 pl-[26px] text-[var(--muted-strong)]">{detail.creator.at}</p>
          </ContextRow>
          <ContextRow label="关联工作任务">
            <button
              type="button"
              className="flex items-center gap-2 rounded text-left text-[#4674ab] outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <span>{detail.relatedTask.id}</span>
              <span>{detail.relatedTask.title}</span>
            </button>
          </ContextRow>
          <ContextRow label="更新时间">{output.updated}</ContextRow>
        </div>

        <div className="mt-5 border-t border-[var(--line)]" />

        <div className="grid gap-y-4 px-8 pt-[18px]">
          <ContextRow label="评审状态">
            <span className="flex items-center justify-between">
              <span>{detail.review.status}</span>
              <span className="text-[var(--muted-strong)]">{detail.review.approved}/{detail.review.total}</span>
            </span>
          </ContextRow>

          <ContextRow label="评审人">
            <div className="space-y-[10px]">
              {detail.review.reviewers.map((reviewer) => (
                <ReviewerRow key={reviewer.name} reviewer={reviewer} />
              ))}
            </div>
          </ContextRow>

          <ContextRow label="验证清单">
            <div className="space-y-[10px]">
              {detail.checklist.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={checks[index]}
                  onClick={() => toggleCheck(index)}
                  className="group flex w-full items-center gap-2 rounded text-left text-[12px] text-[var(--ink-soft)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  {checks[index] ? (
                    <CheckCircle className="size-[15px] shrink-0 text-[#4674ab] transition-opacity group-hover:opacity-80" />
                  ) : (
                    <span className="size-[15px] shrink-0 rounded-[4px] border border-[#c9ced6] bg-panel transition-colors group-hover:border-[#a9b4c4]" />
                  )}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </ContextRow>

          <ContextRow label={`证据链接 (${detail.evidence.length})`}>
            <div className="space-y-2">
              {detail.evidence.map((item) => (
                <p key={item.file} className="flex items-center gap-2.5">
                  <span className="text-[var(--muted-strong)]">{item.label}</span>
                  <button
                    type="button"
                    className="rounded text-left text-[#4674ab] outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    {item.file}
                  </button>
                </p>
              ))}
            </div>
          </ContextRow>

          <ContextRow label="残余风险">
            <span className="grid size-[28px] place-items-center rounded-[9px] bg-[#eef3fa] text-[13px] font-medium text-[#4674ab]">
              {detail.risk.level}
            </span>
            <p className="mt-[7px]">{detail.risk.note}</p>
          </ContextRow>
        </div>

        <div className="mt-5 border-t border-[var(--line)]" />

        <div className="px-8 pt-[14px]">
          <h3 className="text-[13px] font-semibold text-[var(--ink)]">操作</h3>
          <div className="mt-2 space-y-1">
            {contextActions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="flex h-[30px] w-full items-center gap-2.5 rounded-[6px] px-1 text-[12.5px] font-medium text-[#4674ab] outline-none transition-colors hover:bg-[#f5f8fc] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <action.icon className="size-4" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}

function CrumbSlash() {
  return <span aria-hidden className="text-[var(--muted)]">/</span>
}

function ReviewerRow({ reviewer }: { reviewer: OutputPerson & { chair?: boolean } }) {
  return (
    <p className="flex items-center gap-2">
      <WorkAssigneeAvatar assignee={reviewer} size="sm" />
      <span>
        {reviewer.name}
        {reviewer.chair ? "（主持）" : ""}
      </span>
    </p>
  )
}

function ContextRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start text-[12px] leading-[20px]">
      <span className="w-[88px] shrink-0 text-[var(--muted-strong)]">{label}</span>
      <div className="min-w-0 flex-1 text-[var(--ink-soft)]">{children}</div>
    </div>
  )
}
