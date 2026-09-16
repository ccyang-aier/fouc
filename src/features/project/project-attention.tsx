"use client"

import { useState } from "react"
import { Bug, CaretDown, CaretUp, Lightbulb, ShieldWarning } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AttentionState = "idle" | "running" | "done"

export function ProjectAttention() {
  const [permissionState, setPermissionState] = useState<AttentionState>("idle")
  const [issueState, setIssueState] = useState<AttentionState>("idle")
  const [evidenceOpen, setEvidenceOpen] = useState(false)

  function runPermissionReview() {
    setPermissionState("running")
    window.setTimeout(() => setPermissionState("done"), 900)
  }

  function confirmIssue() {
    setIssueState("running")
    window.setTimeout(() => setIssueState("done"), 650)
  }

  return (
    <section aria-labelledby="attention-title">
      <h2 id="attention-title" className="mb-3 text-[13px] font-semibold text-[var(--ink)]">现在需要你</h2>
      <div className="overflow-hidden rounded-[8px] border border-[var(--line)] bg-panel">
        <AttentionRow
          icon={ShieldWarning}
          tone="warning"
          title={permissionState === "done" ? "权限模型评审已完成" : "评审权限模型变更"}
          badge="权限模型 v1.2"
          description="为什么需要你：影响审批与访问控制的边界，需要项目负责人确认并签署。"
          detail="影响范围：12 个角色 · 38 条权限"
          evidence="依据：8 份文档"
          deadline="6月5日（剩余 3 天）"
          actionLabel={permissionState === "running" ? "评审中…" : permissionState === "done" ? "已完成" : "开始评审"}
          actionDisabled={permissionState !== "idle"}
          onAction={runPermissionReview}
          onSecondary={() => setEvidenceOpen((open) => !open)}
          secondaryLabel="查看依据"
        />
        {evidenceOpen ? (
          <div className="mx-4 -mt-1 mb-2.5 flex items-center gap-2 rounded-[6px] bg-[var(--surface-subtle)] px-3 py-2 text-[10.5px] text-[var(--muted-strong)] animate-in fade-in-0 slide-in-from-top-1">
            {evidenceOpen ? <CaretUp className="size-3.5" /> : <CaretDown className="size-3.5" />}
            已关联《权限边界说明》《角色矩阵》及 6 份决策记录
          </div>
        ) : null}
        <div className="mx-4 h-px bg-[var(--line)]" />
        <AttentionRow
          icon={Bug}
          tone="danger"
          title={issueState === "done" ? "Issue-128 结果已确认" : "确认 Issue-128 回归结果"}
          badge="回归测试 #128"
          description="测试摘要：已通过 32 / 38 项用例，覆盖核心流程。"
          detail="剩余风险：6 项用例未通过"
          deadline="6月6日（剩余 4 天）"
          actionLabel={issueState === "running" ? "确认中…" : issueState === "done" ? "已确认" : "确认结果"}
          actionDisabled={issueState !== "idle"}
          onAction={confirmIssue}
          onSecondary={() => setEvidenceOpen(true)}
          secondaryLabel="查看详情"
        />
        <div className="mx-4 flex h-[48px] items-center gap-2 border-t border-[var(--line)] text-[10.5px] text-[var(--muted-strong)]">
          <Lightbulb className="size-4 shrink-0 text-[#c78a2d]" weight="fill" />
          <span>系统建议：建议在确认权限模型后触发自动化回归测试，以降低回归风险。</span>
          <button type="button" onClick={() => setEvidenceOpen(true)} className="ml-1 shrink-0 font-medium text-[var(--accent-ink)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">了解更多</button>
        </div>
      </div>
    </section>
  )
}

function AttentionRow({
  icon: Icon,
  tone,
  title,
  badge,
  description,
  detail,
  evidence,
  deadline,
  actionLabel,
  actionDisabled,
  onAction,
  onSecondary,
  secondaryLabel,
}: {
  icon: typeof Bug
  tone: "warning" | "danger"
  title: string
  badge: string
  description: string
  detail: string
  evidence?: string
  deadline: string
  actionLabel: string
  actionDisabled: boolean
  onAction: () => void
  onSecondary: () => void
  secondaryLabel: string
}) {
  return (
    <div className="grid min-h-[88px] grid-cols-[36px_minmax(235px,1.75fr)_minmax(150px,1fr)_120px_174px] items-center gap-3 px-4 py-2.5 max-[1200px]:grid-cols-[36px_minmax(220px,1fr)_120px_166px] max-[760px]:grid-cols-[36px_minmax(0,1fr)]">
      <span className={cn("flex size-9 items-center justify-center rounded-full", tone === "warning" ? "bg-[#fff1e8] text-[#dc7042]" : "bg-[#fdeceb] text-[#d95b55]") }>
        <Icon className="size-[19px]" weight="bold" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[12px] font-semibold text-[var(--ink)]">{title}</h3>
          <span className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[9.5px] text-[var(--muted)]">{badge}</span>
        </div>
        <p className="mt-1 truncate text-[10px] text-[var(--muted)]">{description}</p>
      </div>
      <div className="min-w-0 text-[9.5px] leading-5 text-[var(--muted)] max-[1200px]:hidden">
        <p className="truncate">{detail}</p>
        {evidence ? <p className="truncate">{evidence}</p> : null}
      </div>
      <div className="text-[9.5px] text-[var(--muted)] max-[760px]:hidden">
        <p>截止日期</p>
        <p className="mt-0.5 font-medium text-[#ef6a3c]">{deadline}</p>
      </div>
      <div className="flex justify-end gap-2 max-[760px]:col-span-2">
        <Button type="button" variant="outline" size="sm" onClick={onSecondary} className="h-8 rounded-[7px] px-3 text-[10.5px]">{secondaryLabel}</Button>
        <Button type="button" size="sm" disabled={actionDisabled} onClick={onAction} className="h-8 min-w-[78px] rounded-[7px] px-3 text-[10.5px]">{actionLabel}</Button>
      </div>
    </div>
  )
}
