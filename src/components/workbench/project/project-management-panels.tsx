"use client"

import { useState } from "react"
import Image from "next/image"
import {
  ArrowRight,
  ArrowsClockwise,
  At,
  BellSimple,
  BookOpen,
  CaretRight,
  Check,
  CheckCircle,
  CheckSquare,
  Chat,
  Cube,
  FileText,
  GitBranch,
  Link,
  Lightning,
  MagnifyingGlass,
  PaperPlaneTilt,
  Plus,
  Robot,
  SlidersHorizontal,
  UserPlus,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

import { presenceMeta, type RailMember } from "./project-management-model"

const conversations = [
  { id: "release", title: "V1 发布准备", meta: "Nova · 8 分钟前", unread: 3 },
  { id: "permission", title: "权限模型评审", meta: "林默 · 42 分钟前", unread: 0 },
  { id: "issue", title: "Issue-128 回归", meta: "陈安 · 昨天", unread: 0 },
]

const mentions = [
  { id: "m1", author: "周欣", context: "通知服务接口变更说明", copy: "@林默 请确认兼容范围，我已补充风险说明。", time: "12 分钟前" },
  { id: "m2", author: "苏晴", context: "工作台交互规范", copy: "这里需要你确认管理面板的默认展开策略。", time: "1 小时前" },
  { id: "m3", author: "Nova", context: "权限模型评审", copy: "检测到 2 项规则冲突，等待项目负责人决策。", time: "昨天" },
]

const notifications = [
  { id: "n1", title: "权限模型等待评审", detail: "12 个角色、38 条权限受影响", time: "刚刚", unread: true },
  { id: "n2", title: "回归测试已完成", detail: "32 / 38 项用例通过", time: "18 分钟前", unread: true },
  { id: "n3", title: "设计文档已同步", detail: "苏晴更新了交互规范", time: "2 小时前", unread: false },
]

const aiAssets = [
  { id: "product", title: "产品知识库", detail: "产品定位、功能与用例", count: "24 条", icon: BookOpen },
  { id: "technical", title: "技术栈与方案", detail: "项目技术选型与方案要点", count: "18 条", icon: Cube },
  { id: "design", title: "设计系统", detail: "组件库、样式规范与设计原则", count: "32 条", icon: SlidersHorizontal },
  { id: "code", title: "代码规范", detail: "编码约定与最佳实践", count: "15 条", icon: CheckSquare },
]

const rules = [
  { title: "项目目标与范围", detail: "目标、边界与交付物" },
  { title: "角色与职责", detail: "团队角色定义与职责说明" },
  { title: "开发流程", detail: "分支策略、PR 规范与发布流程" },
  { title: "安全与合规", detail: "安全要求与合规约束" },
]

const projectAssets = [
  { id: "repo", title: "fouc / desktop", detail: "main · 2 分钟前同步", tag: "代码仓", icon: GitBranch },
  { id: "api", title: "Fouc API contracts", detail: "shared/ · 18 分钟前同步", tag: "代码仓", icon: Link },
  { id: "prd", title: "桌面端 V1 产品说明", detail: "27 页 · 今天 09:42 更新", tag: "文档", icon: FileText },
  { id: "design", title: "工作台交互规范", detail: "12 个章节 · 昨天更新", tag: "文档", icon: BookOpen },
]

const tasks = [
  { id: "ISSUE-128", title: "修复测试环境登录失败", status: "进行中", progress: "3 / 5" },
  { id: "ISSUE-130", title: "优化启动性能", status: "待处理", progress: "0 / 5" },
  { id: "FEATURE-120", title: "项目概览数据看板", status: "已完成", progress: "5 / 5" },
  { id: "DOC-116", title: "更新权限模型文档", status: "评审中", progress: "4 / 4" },
]

export function ProjectSummaryPanel() {
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 gap-2">
        <Metric label="进行中任务" value="4 项" />
        <Metric label="待评审" value="2 项" />
        <Metric label="项目成员" value="9 人" />
        <Metric label="AI 资产" value="10 项" />
      </div>
      <PanelSection title="当前状态" meta="今天 10:32">
        <div className="divide-y divide-[var(--line)]">
          <ManagementRow icon={CheckSquare} title="V1 核心开发" detail="里程碑 M3 · 已完成 68%" meta="进行中" />
          <ManagementRow icon={CheckCircle} title="项目健康度" detail="2 项风险需要负责人确认" meta="需关注" />
          <ManagementRow icon={Cube} title="上下文完整度" detail="代码、文档与规则保持同步" meta="良好" />
        </div>
      </PanelSection>
      <PanelSection title="本周协作">
        <TimelineItem title="完成 18 次任务状态更新" time="团队成员" />
        <TimelineItem title="Nova 执行 7 次项目自动化" time="项目 Agent" />
        <TimelineItem title="新增 3 份评审与测试产物" time="项目资产" />
      </PanelSection>
    </div>
  )
}

export function ChatPanel() {
  const [active, setActive] = useState(conversations[0].id)
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState(false)

  function sendMessage() {
    if (!message.trim()) return
    setMessage("")
    setSent(true)
  }

  return (
    <div className="space-y-6">
      <PanelSection title="最近会话" action={<IconAction label="新建项目会话"><Plus /></IconAction>}>
        <div className="space-y-1">
          {conversations.map((item) => (
            <button key={item.id} type="button" onClick={() => { setActive(item.id); setSent(false) }} className={rowClass(active === item.id)}>
              <span className={iconBoxClass(active === item.id)}><Chat className="size-4" /></span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[11.5px] font-medium text-[var(--ink)]">{item.title}</span>
                <span className="mt-0.5 block truncate text-[9.5px] text-[var(--muted)]">{item.meta}</span>
              </span>
              {item.unread ? <span className="flex size-4 items-center justify-center rounded-full bg-[var(--accent)] text-[8px] font-semibold text-white">{item.unread}</span> : <CaretRight className="size-3.5 text-[var(--muted)]" />}
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="快速回复">
        <div className="rounded-[10px] border border-[var(--line)] bg-[var(--surface-subtle)] p-3">
          <textarea value={message} onChange={(event) => { setMessage(event.target.value); setSent(false) }} placeholder="向项目成员发送消息…" aria-label="项目会话消息" className="min-h-20 w-full resize-none bg-transparent text-[11px] leading-5 outline-none placeholder:text-[var(--muted)]" />
          <div className="mt-2 flex items-center justify-between border-t border-[var(--line)] pt-2">
            <span className={cn("text-[9.5px]", sent ? "text-[var(--ok-ink)]" : "text-[var(--muted)]")}>{sent ? "消息已加入会话" : "发送到当前项目会话"}</span>
            <button type="button" disabled={!message.trim()} onClick={sendMessage} className="flex size-7 items-center justify-center rounded-[7px] bg-[var(--accent)] text-white outline-none transition-[background-color,transform,opacity] hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"><PaperPlaneTilt className="size-3.5" weight="fill" /></button>
          </div>
        </div>
      </PanelSection>
    </div>
  )
}

export function MentionsPanel() {
  const [resolved, setResolved] = useState<string[]>([])

  return (
    <PanelSection title="待处理提及" meta={`${mentions.length - resolved.length} 条`}>
      <div className="space-y-2">
        {mentions.map((item) => {
          const done = resolved.includes(item.id)
          return (
            <article key={item.id} className={cn("rounded-[10px] border p-3 transition-colors", done ? "border-[var(--line)] bg-[var(--surface-subtle)] opacity-60" : "border-[var(--line-strong)] bg-panel")}>
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-[8px] bg-[var(--accent-soft)] text-[var(--accent-ink)]"><At className="size-3.5" /></span>
                <div className="min-w-0 flex-1"><p className="text-[10.5px] font-semibold">{item.author}</p><p className="truncate text-[9px] text-[var(--muted)]">{item.context} · {item.time}</p></div>
              </div>
              <p className="mt-2.5 text-[10.5px] leading-[1.65] text-[var(--ink-soft)]">{item.copy}</p>
              <button type="button" onClick={() => setResolved((current) => done ? current.filter((id) => id !== item.id) : [...current, item.id])} className="mt-2.5 flex items-center gap-1.5 text-[9.5px] font-medium text-[var(--accent-ink)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Check className="size-3" />{done ? "恢复待处理" : "标记为已处理"}</button>
            </article>
          )
        })}
      </div>
    </PanelSection>
  )
}

export function NotificationsPanel() {
  const [items, setItems] = useState(notifications)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const visible = unreadOnly ? items.filter((item) => item.unread) : items

  return (
    <PanelSection title="通知" action={<button type="button" onClick={() => setItems((current) => current.map((item) => ({ ...item, unread: false })))} className="text-[9.5px] font-medium text-[var(--accent-ink)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">全部已读</button>}>
      <button type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly((value) => !value)} className={cn("mb-3 flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[9.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", unreadOnly ? "border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "border-[var(--line)] text-[var(--muted-strong)] hover:bg-[var(--surface-hover)]")}><BellSimple className="size-3.5" />只看未读</button>
      <div className="divide-y divide-[var(--line)]">
        {visible.length ? visible.map((item) => (
          <button key={item.id} type="button" onClick={() => setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, unread: false } : candidate))} className="group flex w-full items-start gap-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]">
            <span className={cn("mt-1 size-1.5 shrink-0 rounded-full", item.unread ? "bg-[var(--accent)]" : "bg-[var(--line-strong)]")} />
            <span className="min-w-0 flex-1"><span className="block text-[10.5px] font-medium">{item.title}</span><span className="mt-1 block text-[9.5px] leading-4 text-[var(--muted)]">{item.detail}</span><span className="mt-1.5 block text-[9px] text-[var(--muted)]">{item.time}</span></span>
            <CaretRight className="mt-1 size-3 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
          </button>
        )) : <EmptyState icon={CheckCircle} title="没有未读通知" detail="项目的新动态会出现在这里。" />}
      </div>
    </PanelSection>
  )
}

export function AiAssetsPanel() {
  const [selected, setSelected] = useState(aiAssets[0].id)
  const [adding, setAdding] = useState(false)
  const [synced, setSynced] = useState(true)

  return (
    <div className="space-y-7">
      <PanelSection title="Skills" meta="4 个" action={<button type="button" onClick={() => setAdding((value) => !value)} className="flex items-center gap-1 text-[9.5px] font-medium text-[var(--accent-ink)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Plus className="size-3" />新增</button>}>
        {adding ? <div className="mb-2 flex items-center gap-2 rounded-[8px] border border-dashed border-[var(--accent-soft-line)] bg-[var(--accent-soft)] px-3 py-2 text-[9.5px] text-[var(--accent-ink)]"><Plus className="size-3.5" />选择 Skill 模板或从目录导入</div> : null}
        <div className="divide-y divide-[var(--line)]">
          {aiAssets.map((item) => <ManagementRow key={item.id} icon={item.icon} title={item.title} detail={item.detail} meta={item.count} active={selected === item.id} onClick={() => setSelected(item.id)} />)}
        </div>
      </PanelSection>

      <PanelSection title="项目规则" meta="6 条" action={<button type="button" onClick={() => setSynced((value) => !value)} className="flex items-center gap-1.5 text-[9px] text-[var(--muted-strong)] outline-none hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><ArrowsClockwise className={cn("size-3", !synced && "animate-spin")} />{synced ? "已同步 · 刚刚" : "同步中…"}</button>}>
        <div className="divide-y divide-[var(--line)]">
          {rules.map((rule) => <ManagementRow key={rule.title} icon={FileText} title={rule.title} detail={rule.detail} />)}
        </div>
      </PanelSection>

      <PanelSection title="连接与自动化" action={<IconAction label="新增连接"><Plus /></IconAction>}>
        <div className="divide-y divide-[var(--line)]">
          <ManagementRow icon={Link} title="MCP 连接" detail="GitHub、Linear、Figma" meta="3 个" />
          <ManagementRow icon={Lightning} title="自动化规则" detail="任务、评审与同步流程" meta="5 条" />
        </div>
      </PanelSection>
    </div>
  )
}

export function ProjectAssetsPanel() {
  const [query, setQuery] = useState("")
  const [syncing, setSyncing] = useState<string | null>(null)
  const visible = projectAssets.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="space-y-5">
      <label className="flex h-9 items-center gap-2 rounded-[8px] border border-[var(--line)] bg-[var(--surface-subtle)] px-3 focus-within:border-[var(--accent-soft-line)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
        <MagnifyingGlass className="size-3.5 text-[var(--muted)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索代码仓与文档" className="min-w-0 flex-1 bg-transparent text-[10.5px] outline-none placeholder:text-[var(--muted)]" />
      </label>
      <PanelSection title="已关联资产" meta={`${visible.length} 项`} action={<IconAction label="关联新资产"><Plus /></IconAction>}>
        <div className="divide-y divide-[var(--line)]">
          {visible.map((item) => <ManagementRow key={item.id} icon={item.icon} title={item.title} detail={syncing === item.id ? "正在同步最新内容…" : item.detail} meta={item.tag} trailing={<button type="button" aria-label={`同步${item.title}`} onClick={(event) => { event.stopPropagation(); setSyncing(syncing === item.id ? null : item.id) }} className="flex size-6 items-center justify-center rounded-md text-[var(--muted)] outline-none hover:bg-[var(--surface-hover)] hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><ArrowsClockwise className={cn("size-3.5", syncing === item.id && "animate-spin")} /></button>} />)}
        </div>
      </PanelSection>
      <div className="rounded-[10px] bg-[var(--accent-soft)] px-3.5 py-3 text-[9.5px] leading-4 text-[var(--accent-ink)]">Agent 仅会读取已授权的目录和文档范围。代码仓默认跟随主分支，每 15 分钟检查一次变更。</div>
    </div>
  )
}

export function TasksPanel({ onOpenWork }: { onOpenWork: () => void }) {
  const [filter, setFilter] = useState<"all" | "active">("all")
  const visible = filter === "active" ? tasks.filter((task) => task.status !== "已完成") : tasks

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 divide-x divide-[var(--line)] rounded-[10px] bg-[var(--surface-subtle)] px-2 py-3">
        {[{ label: "全部", value: "12" }, { label: "进行中", value: "4" }, { label: "待评审", value: "2" }].map((item) => <div key={item.label} className="text-center"><p className="text-[15px] font-semibold tabular-nums">{item.value}</p><p className="mt-0.5 text-[8.5px] text-[var(--muted)]">{item.label}</p></div>)}
      </div>
      <PanelSection title="项目任务" action={<div className="flex gap-1"><button type="button" onClick={() => setFilter("all")} className={filterButtonClass(filter === "all")}>全部</button><button type="button" onClick={() => setFilter("active")} className={filterButtonClass(filter === "active")}>活跃</button></div>}>
        <div className="divide-y divide-[var(--line)]">
          {visible.map((task) => <button key={task.id} type="button" onClick={onOpenWork} className="group flex w-full items-center gap-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"><span className="flex size-8 items-center justify-center rounded-[8px] bg-[var(--surface-subtle)] text-[var(--muted-strong)]"><CheckSquare className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-[8.5px] font-medium tracking-[0.04em] text-[var(--muted)]">{task.id}</span><span className="mt-0.5 block truncate text-[10.5px] font-medium">{task.title}</span><span className="mt-1 block text-[9px] text-[var(--muted)]">{task.status}</span></span><span className="text-[9px] tabular-nums text-[var(--muted-strong)]">{task.progress}</span><CaretRight className="size-3 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" /></button>)}
        </div>
      </PanelSection>
      <button type="button" onClick={onOpenWork} className="flex h-9 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--accent)] text-[10.5px] font-medium text-white outline-none transition-[background-color,transform] hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-[0.99]">打开完整任务视图<ArrowRight className="size-3.5" /></button>
    </div>
  )
}

export function AgentPanel() {
  const [paused, setPaused] = useState(false)
  const [expanded, setExpanded] = useState("context")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-[11px] bg-[var(--surface-subtle)] p-3.5">
        <span className="flex size-10 items-center justify-center rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent-ink)]"><Robot className="size-5" weight="fill" /></span>
        <div className="min-w-0 flex-1"><p className="text-[12px] font-semibold">Nova</p><p className="mt-1 text-[9.5px] text-[var(--muted)]">项目 Agent · 已继承 10 项项目资产</p></div>
        <span className={cn("size-2 rounded-full", paused ? "bg-[var(--muted)]" : "bg-[#31b777]")} />
      </div>
      <PanelSection title="当前能力">
        <div className="divide-y divide-[var(--line)]">
          {[{ id: "context", title: "项目上下文", detail: "代码、文档与规则已加载" }, { id: "tools", title: "可用工具", detail: "GitHub、Linear、Figma" }, { id: "approval", title: "执行权限", detail: "写入操作需人工确认" }].map((item) => <ManagementRow key={item.id} icon={item.id === "context" ? Cube : item.id === "tools" ? Lightning : CheckCircle} title={item.title} detail={item.detail} active={expanded === item.id} onClick={() => setExpanded(item.id)} />)}
        </div>
      </PanelSection>
      <PanelSection title="最近动作" meta="今天">
        <TimelineItem title="汇总权限模型差异" time="10:24" />
        <TimelineItem title="同步 Issue-128 回归结果" time="09:51" />
        <TimelineItem title="更新项目上下文索引" time="09:36" />
      </PanelSection>
      <button type="button" aria-pressed={paused} onClick={() => setPaused((value) => !value)} className={cn("flex h-9 w-full items-center justify-center rounded-[8px] border text-[10.5px] font-medium outline-none transition-[background-color,color,transform] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-[0.99]", paused ? "border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "border-[var(--line)] hover:bg-[var(--surface-hover)]")}>{paused ? "恢复自动协作" : "暂停自动协作"}</button>
    </div>
  )
}

export function MemberPanel({ member }: { member: RailMember }) {
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState(false)
  const presence = presenceMeta[member.presence]

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center border-b border-[var(--line)] pb-6 text-center">
        <span className="relative"><Image src={member.avatar} alt={`${member.name}的头像`} width={144} height={144} className="size-[72px] rounded-full object-cover" /><span className="absolute bottom-0.5 right-0.5 size-3 rounded-full border-2 border-panel" style={{ backgroundColor: presence.color }} /></span>
        <h3 className="mt-3 text-[14px] font-semibold">{member.name}</h3>
        <p className="mt-1 text-[9.5px] text-[var(--muted)]">{member.role} · {presence.label}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="当前任务" value={`${member.tasks} 项`} />
        <Metric label="本周贡献" value="18 次" />
      </div>
      <PanelSection title="正在推进"><ManagementRow icon={CheckSquare} title={member.focus} detail="最近更新于 26 分钟前" /></PanelSection>
      <PanelSection title="发送消息">
        <div className="rounded-[9px] border border-[var(--line)] p-2.5 focus-within:border-[var(--accent-soft-line)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
          <textarea aria-label={`给${member.name}发送消息`} value={message} onChange={(event) => { setMessage(event.target.value); setSent(false) }} placeholder={`给 ${member.name} 留言…`} className="min-h-16 w-full resize-none bg-transparent text-[10.5px] leading-5 outline-none placeholder:text-[var(--muted)]" />
          <div className="flex items-center justify-between border-t border-[var(--line)] pt-2"><span className={cn("text-[9px]", sent ? "text-[var(--ok-ink)]" : "text-[var(--muted)]")}>{sent ? "消息已发送" : "项目内消息"}</span><button type="button" disabled={!message.trim()} onClick={() => { if (message.trim()) { setMessage(""); setSent(true) } }} className="flex h-7 items-center gap-1.5 rounded-[7px] bg-[var(--accent)] px-2.5 text-[9.5px] font-medium text-white outline-none hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-35"><PaperPlaneTilt className="size-3" />发送</button></div>
        </div>
      </PanelSection>
    </div>
  )
}

export function InvitePanel() {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("成员")
  const [sent, setSent] = useState(false)
  const valid = /^\S+@\S+\.\S+$/.test(email)

  return (
    <form onSubmit={(event) => { event.preventDefault(); if (valid) setSent(true) }} className="space-y-5">
      <div className="flex size-11 items-center justify-center rounded-[11px] bg-[var(--accent-soft)] text-[var(--accent-ink)]"><UserPlus className="size-5" /></div>
      <div><label htmlFor="invite-email" className="text-[10px] font-medium">邮箱地址</label><input id="invite-email" value={email} onChange={(event) => { setEmail(event.target.value); setSent(false) }} placeholder="name@company.com" className="mt-2 h-9 w-full rounded-[8px] border border-[var(--line)] bg-[var(--surface-subtle)] px-3 text-[10.5px] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--muted)] focus:border-[var(--accent-soft-line)] focus:ring-2 focus:ring-[var(--focus-ring)]" /></div>
      <fieldset><legend className="text-[10px] font-medium">项目角色</legend><div className="mt-2 grid grid-cols-3 gap-1.5">{["访客", "成员", "管理员"].map((item) => <button key={item} type="button" aria-pressed={role === item} onClick={() => setRole(item)} className={filterButtonClass(role === item, "h-8")}>{item}</button>)}</div></fieldset>
      <div className="rounded-[9px] bg-[var(--surface-subtle)] p-3 text-[9.5px] leading-[1.65] text-[var(--muted-strong)]">{role === "访客" ? "可查看项目任务与公开资产。" : role === "管理员" ? "可管理成员、资产、规则与项目配置。" : "可创建任务、参与会话并使用项目资产。"}</div>
      <button type="submit" disabled={!valid} className="flex h-9 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--accent)] text-[10.5px] font-medium text-white outline-none transition-[background-color,transform,opacity] hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35"><UserPlus className="size-3.5" />发送邀请</button>
      {sent ? <p role="status" className="flex items-center gap-2 text-[9.5px] text-[var(--ok-ink)]"><CheckCircle className="size-3.5" weight="fill" />邀请已准备好，等待后端连接后发送。</p> : null}
    </form>
  )
}

export function SettingsPanel() {
  const [discoverable, setDiscoverable] = useState(true)
  const [taskDigest, setTaskDigest] = useState(true)
  const [agentWrites, setAgentWrites] = useState(false)
  const [saved, setSaved] = useState(false)

  return (
    <div className="space-y-7">
      <PanelSection title="项目信息">
        <label className="block"><span className="text-[9.5px] font-medium text-[var(--muted-strong)]">项目名称</span><input defaultValue="Fouc 桌面端 V1" className="mt-2 h-9 w-full rounded-[8px] border border-[var(--line)] bg-[var(--surface-subtle)] px-3 text-[10.5px] outline-none focus:border-[var(--accent-soft-line)] focus:ring-2 focus:ring-[var(--focus-ring)]" /></label>
        <label className="mt-3 block"><span className="text-[9.5px] font-medium text-[var(--muted-strong)]">项目说明</span><textarea defaultValue="构建面向人与 Agent 协作的桌面工作台。" className="mt-2 min-h-20 w-full resize-none rounded-[8px] border border-[var(--line)] bg-[var(--surface-subtle)] p-3 text-[10.5px] leading-5 outline-none focus:border-[var(--accent-soft-line)] focus:ring-2 focus:ring-[var(--focus-ring)]" /></label>
      </PanelSection>
      <PanelSection title="协作与权限">
        <SettingToggle label="允许空间成员发现此项目" detail="成员可搜索并申请加入" checked={discoverable} onChange={(checked) => { setDiscoverable(checked); setSaved(false) }} />
        <SettingToggle label="每周任务摘要" detail="周五汇总项目进展与风险" checked={taskDigest} onChange={(checked) => { setTaskDigest(checked); setSaved(false) }} />
        <SettingToggle label="允许 Agent 直接写入" detail="关闭时所有写入都需要确认" checked={agentWrites} onChange={(checked) => { setAgentWrites(checked); setSaved(false) }} />
      </PanelSection>
      <button type="button" onClick={() => setSaved(true)} className="h-9 w-full rounded-[8px] border border-[var(--line)] text-[10.5px] font-medium outline-none transition-[background-color,transform] hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-[0.99]">保存项目配置</button>
      {saved ? <p role="status" className="flex items-center justify-center gap-1.5 text-[9.5px] text-[var(--ok-ink)]"><CheckCircle className="size-3.5" weight="fill" />项目配置已保存</p> : null}
    </div>
  )
}

function PanelSection({ title, meta, action, children }: { title: string; meta?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section><div className="mb-2.5 flex min-h-6 items-center"><h3 className="text-[11.5px] font-semibold tracking-[-0.01em]">{title}</h3>{meta ? <span className="ml-2 text-[9px] tabular-nums text-[var(--muted)]">{meta}</span> : null}<div className="ml-auto">{action}</div></div>{children}</section>
}

function ManagementRow({ icon: Icon, title, detail, meta, active, onClick, trailing }: { icon: typeof Cube; title: string; detail: string; meta?: string; active?: boolean; onClick?: () => void; trailing?: React.ReactNode }) {
  const content = <><span className={iconBoxClass(active)}><Icon className="size-4" /></span><span className="min-w-0 flex-1 text-left"><span className="block truncate text-[10.5px] font-medium text-[var(--ink)]">{title}</span><span className="mt-0.5 block truncate text-[9px] text-[var(--muted)]">{detail}</span></span>{meta ? <span className="text-[8.5px] text-[var(--muted-strong)]">{meta}</span> : null}{trailing ?? <CaretRight className="size-3 text-[var(--muted)]" />}</>
  return onClick ? <button type="button" aria-pressed={active} onClick={onClick} className={rowClass(active)}>{content}</button> : <div className="flex min-h-[52px] items-center gap-2.5 py-2">{content}</div>
}

function TimelineItem({ title, time }: { title: string; time: string }) {
  return <div className="relative flex gap-3 pb-4 last:pb-0 before:absolute before:left-[3px] before:top-3 before:h-[calc(100%-8px)] before:w-px before:bg-[var(--line)] last:before:hidden"><span className="relative mt-1.5 size-[7px] shrink-0 rounded-full border-2 border-panel bg-[var(--accent)] ring-1 ring-[var(--accent-soft-line)]" /><div className="min-w-0 flex-1"><p className="truncate text-[10px] text-[var(--ink-soft)]">{title}</p><p className="mt-1 text-[8.5px] text-[var(--muted)]">{time}</p></div></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[9px] bg-[var(--surface-subtle)] p-3"><p className="text-[9px] text-[var(--muted)]">{label}</p><p className="mt-1.5 text-[12px] font-semibold tabular-nums">{value}</p></div>
}

function SettingToggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-center gap-3 border-b border-[var(--line)] py-3 last:border-0"><span className="min-w-0 flex-1"><span className="block text-[10.5px] font-medium">{label}</span><span className="mt-1 block text-[9px] text-[var(--muted)]">{detail}</span></span><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn("relative h-[18px] w-8 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", checked ? "bg-[var(--accent)]" : "bg-[var(--switch-off)]")}><span className={cn("absolute top-[2px] size-3.5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-[16px]" : "translate-x-[2px]")} /></button></label>
}

function IconAction({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return <button type="button" aria-label={label} className="flex size-6 items-center justify-center rounded-[6px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">{children}</button>
}

function EmptyState({ icon: Icon, title, detail }: { icon: typeof CheckCircle; title: string; detail: string }) {
  return <div className="flex flex-col items-center py-10 text-center"><span className="flex size-9 items-center justify-center rounded-[10px] bg-[var(--surface-subtle)] text-[var(--muted-strong)]"><Icon className="size-4" /></span><p className="mt-3 text-[10.5px] font-medium">{title}</p><p className="mt-1 text-[9px] text-[var(--muted)]">{detail}</p></div>
}

function rowClass(active?: boolean) {
  return cn("group flex min-h-[52px] w-full items-center gap-2.5 rounded-[8px] px-2 py-2 outline-none transition-[background-color,transform] hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-[0.995]", active && "bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]")
}

function iconBoxClass(active?: boolean) {
  return cn("flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-[var(--line)] bg-panel text-[var(--muted-strong)] transition-colors", active && "border-[var(--accent-soft-line)] text-[var(--accent-ink)]")
}

function filterButtonClass(active: boolean, extra?: string) {
  return cn("rounded-[7px] border px-2 text-[9px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", active ? "border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-hover)]", extra)
}
