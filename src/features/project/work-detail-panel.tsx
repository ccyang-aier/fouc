"use client"

import { useState } from "react"
import {
  CaretDown,
  CaretLeft,
  Check,
  CheckCircle,
  Diamond,
  GitBranch,
  GithubLogo,
  InstagramLogo,
  LinkSimple,
  SpinnerGap,
  Target,
  X,
} from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { issueChecklist, workStatusMeta, type WorkItem, type WorkStatus } from "./project-work-data"
import { WorkAssigneeAvatar } from "./work-assignee"

export function WorkDetailPanel({ item, onClose, onStatusChange }: { item: WorkItem; onClose: () => void; onStatusChange: (status: WorkStatus) => void }) {
  const [checks, setChecks] = useState<boolean[]>(issueChecklist.map((_, index) => index < item.completed))
  const [roomOpen, setRoomOpen] = useState(false)

  const completed = checks.filter(Boolean).length

  return (
    <aside aria-label="工作详情" className="responsive-side-panel-surface flex h-full min-h-0 w-[292px] shrink-0 flex-col border-l border-[var(--line)] bg-panel max-[1060px]:absolute max-[1060px]:inset-y-0 max-[1060px]:right-0 max-[1060px]:z-30">
      <div className="flex h-[74px] shrink-0 items-center border-b border-[var(--line)] px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10.5px] font-medium text-[var(--ink-soft)]">项目上下文&nbsp; / &nbsp;{item.id}</p>
          <button type="button" className="mt-2 flex items-center gap-1 text-[9.5px] text-[var(--muted)] outline-none transition-colors hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><CaretLeft className="size-3" />返回项目上下文</button>
        </div>
        <button type="button" aria-label="关闭工作详情" onClick={onClose} className="flex size-8 items-center justify-center rounded-[7px] border border-[var(--line)] text-[var(--muted-strong)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><X className="size-4" /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <h2 className="text-[15px] font-semibold leading-6 tracking-[-0.02em]">{item.title}</h2>
        <div className="mt-3 flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-[5px] bg-[#f3f5f8] px-2 py-1 text-[8.5px] font-medium text-[var(--muted-strong)]"><Target className="size-3" />{item.id}</span>
          <span className="flex items-center gap-1 rounded-[5px] bg-[#fff0ef] px-2 py-1 text-[8.5px] font-medium text-[#d34b48]"><Diamond className="size-3" weight="fill" />高优先级</span>
        </div>

        <div className="mt-4 grid grid-cols-[72px_minmax(0,1fr)] gap-y-3.5 text-[10px]">
          <span className="text-[var(--muted-strong)]">目标</span><span className="leading-5 text-[var(--ink-soft)]">修复测试环境登录失败，恢复稳定访问</span>
          <span className="text-[var(--muted-strong)]">负责人</span><span className="flex items-center gap-2"><WorkAssigneeAvatar assignee={item.assignee} size="sm" />{item.assignee.name}<span className="text-[var(--muted)]">{item.assignee.handle}</span></span>
          <span className="text-[var(--muted-strong)]">当前 Agent</span><span className="flex items-center gap-2 text-[var(--ink-soft)]"><span className="flex size-[18px] items-center justify-center rounded-full bg-[#e7edff] text-[#5376dc]"><SpinnerGap className="size-3" weight="bold" /></span>Nova</span>
          <span className="text-[var(--muted-strong)]">阶段</span><span className="flex items-center gap-2 text-[var(--ink-soft)]"><SpinnerGap className="size-4 text-[#6d7990]" />实现与验证</span>
        </div>

        <DetailSection title="验收进度" trailing={`${completed} / ${issueChecklist.length}`}>
          <div className="mb-3 h-[3px] overflow-hidden rounded-full bg-[#e8eaf0]"><span className="block h-full rounded-full bg-[#5674b5] transition-[width] duration-300" style={{ width: `${(completed / issueChecklist.length) * 100}%` }} /></div>
          <div className="space-y-1">
            {issueChecklist.map((label, index) => (
              <button key={label} type="button" onClick={() => setChecks((value) => value.map((checked, itemIndex) => itemIndex === index ? !checked : checked))} className="group flex w-full items-center gap-2 rounded text-left text-[9.5px] text-[var(--muted-strong)] outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                <span className={cn("flex size-3.5 items-center justify-center rounded-full border transition-colors", checks[index] ? "border-[#8291aa] bg-[#8291aa] text-white" : "border-[#cbd0d8] bg-panel group-hover:border-[#8291aa]")}>{checks[index] ? <Check className="size-2.5" weight="bold" /> : null}</span>{label}
              </button>
            ))}
          </div>
        </DetailSection>

        <DetailSection title="阻塞项" compact>
          <button type="button" className="flex w-full items-center gap-2 rounded-[6px] px-1 py-1 text-left text-[9.5px] outline-none transition-colors hover:bg-[#fff5f4] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><span className="flex size-5 items-center justify-center rounded-[5px] bg-[#fff0ef] text-[#d34b48]"><Diamond className="size-3" weight="fill" /></span><span className="min-w-0"><span className="block font-medium text-[var(--ink-soft)]">未合并的配置变更</span><span className="mt-0.5 block text-[var(--muted)]">由 陈安 · 30 分钟前更新</span></span></button>
        </DetailSection>

        <DetailSection title="依赖 (1)" compact>
          <div className="flex items-center gap-2 text-[9px]"><LinkSimple className="size-3.5 text-[var(--muted)]" /><span className="text-[var(--muted-strong)]">TASK-132</span><span className="min-w-0 flex-1 truncate">设计项目权限模型</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><button type="button" className={cn("flex items-center gap-1 rounded-[5px] px-2 py-1 font-medium outline-none transition-colors hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", workStatusMeta[item.status].tint, workStatusMeta[item.status].accent)}>{workStatusMeta[item.status].label}<CaretDown className="size-3" /></button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">{(Object.keys(workStatusMeta) as WorkStatus[]).map((status) => <DropdownMenuCheckboxItem key={status} checked={item.status === status} onCheckedChange={() => onStatusChange(status)}>{workStatusMeta[status].label}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DetailSection>

        <DetailSection title="相关仓库" compact>
          <div className="space-y-1 rounded-[6px] border border-[var(--line)] px-2 py-1.5 text-[9.5px]"><p className="flex items-center gap-2"><GithubLogo className="size-4" weight="fill" />fouc-desktop</p><p className="flex items-center gap-2 text-[var(--muted-strong)]"><GitBranch className="size-4 text-[#e67f22]" />feature/fix-login-error<span className="ml-auto flex items-center gap-1 font-mono text-[#4776d7]"><GitBranch className="size-3" />a1b2c3d</span></p></div>
        </DetailSection>
      </div>

      <div className="shrink-0 border-t border-[var(--line)] p-3">
        <button type="button" onClick={() => setRoomOpen(true)} className={cn("flex h-9 w-full items-center justify-center gap-2 rounded-[7px] text-[10.5px] font-semibold text-white outline-none transition-[background-color,transform,box-shadow] hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", roomOpen ? "bg-[#4f866d] shadow-[0_5px_14px_rgba(54,112,84,0.18)]" : "bg-[#4f6da8] shadow-[0_5px_14px_rgba(58,84,140,0.22)]")}>
          {roomOpen ? <CheckCircle className="size-4" weight="fill" /> : <InstagramLogo className="size-4" />}{roomOpen ? "Work Room 已打开" : "打开 Work Room"}
        </button>
      </div>
    </aside>
  )
}

function DetailSection({ title, trailing, children, compact = false }: { title: string; trailing?: string; children: React.ReactNode; compact?: boolean }) {
  return <section className={cn("border-t border-[var(--line)]", compact ? "mt-2.5 pt-2" : "mt-3 pt-2.5")}><div className={cn("flex items-center justify-between", compact ? "mb-2" : "mb-2.5")}><h3 className="text-[10.5px] font-semibold">{title}</h3>{trailing ? <span className="text-[10.5px] font-semibold">{trailing}</span> : null}</div>{children}</section>
}
