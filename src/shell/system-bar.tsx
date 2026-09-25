"use client"

/** 主区系统栏：macOS 风格全局搜索、通知/任务快捷面板与桌面窗口控制。 */

import { useEffect, useMemo, useRef, useState } from "react"
import {
  BellSimple,
  BellRinging,
  ArrowRight,
  CheckCircle,
  Circle,
  ClipboardText,
  Clock,
  ListChecks,
  MagnifyingGlass,
  Minus,
  Square,
  X,
} from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { performWindowAction } from "@/lib/tauri-window"
import { cn } from "@/lib/utils"

import type { WorkbenchView } from "./navigation-sidebar"

const SEARCH_ITEMS: Array<{ label: string; detail: string; view: WorkbenchView }> = [
  { label: "新对话", detail: "开始一项新任务", view: "home" },
  { label: "项目", detail: "浏览项目文件夹", view: "project-home" },
  { label: "社区", detail: "发现 Agent 与技能", view: "community" },
  { label: "自动化", detail: "管理自动执行任务", view: "automation" },
  { label: "知识库", detail: "查看沉淀的知识", view: "knowledge" },
  { label: "连接器", detail: "管理外部服务", view: "connectors" },
  { label: "设置", detail: "调整 Fouc 偏好", view: "settings" },
]

export function SystemBar({ onNavigate }: { onNavigate: (view: WorkbenchView) => void }) {
  const [query, setQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN")
  const results = useMemo(
    () => SEARCH_ITEMS.filter((item) => `${item.label}${item.detail}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery)),
    [normalizedQuery],
  )

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [])

  function navigate(view: WorkbenchView) {
    onNavigate(view)
    setQuery("")
    setSearchOpen(false)
    searchRef.current?.blur()
  }

  return (
    <div
      data-tauri-drag-region
      className="relative flex h-11 shrink-0 select-none items-center border-b border-[var(--wt-sidebar-edge)] bg-panel px-3"
    >
      <form
        data-tauri-drag-region="false"
        className="relative w-[304px] max-w-[38vw] max-[850px]:hidden"
        onSubmit={(event) => {
          event.preventDefault()
          if (results[0]) navigate(results[0].view)
        }}
      >
        <MagnifyingGlass
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 size-[14px] -translate-y-1/2 text-[var(--muted)]"
        />
        <input
          ref={searchRef}
          type="search"
          value={query}
          role="combobox"
          aria-label="全局搜索"
          aria-expanded={searchOpen}
          aria-controls="global-search-results"
          placeholder="搜索"
          onChange={(event) => {
            setQuery(event.target.value)
            setSearchOpen(true)
          }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setSearchOpen(false)}
          className="h-7 w-full rounded-[8px] border border-[var(--line)] bg-[var(--surface-subtle)] pl-8 pr-12 text-[11.5px] text-[var(--ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_2px_rgba(20,24,28,0.04)] outline-none transition-[border-color,background-color] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:bg-panel"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-[4px] border border-[var(--line)] bg-panel px-1.5 py-0.5 font-sans text-[9px] leading-none text-[var(--muted)] shadow-[0_1px_1px_rgba(20,24,28,0.04)]">
          ⌘ K
        </kbd>
        {searchOpen ? (
          <div
            id="global-search-results"
            role="listbox"
            className="overlay-surface absolute left-0 top-[34px] z-50 w-full overflow-hidden rounded-[7px] border bg-elevated p-1"
          >
            {results.length > 0 ? results.slice(0, 6).map((item) => (
              <button
                key={item.view}
                type="button"
                role="option"
                aria-selected="false"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => navigate(item.view)}
                className="flex h-9 w-full items-center gap-2 rounded-[7px] px-2.5 text-left outline-none hover:bg-wash focus-visible:bg-wash"
              >
                <MagnifyingGlass aria-hidden className="size-3.5 shrink-0 text-[var(--muted)]" />
                <span className="text-[11.5px] font-medium text-[var(--ink)]">{item.label}</span>
                <span className="ml-auto truncate text-[10px] text-[var(--muted)]">{item.detail}</span>
              </button>
            )) : (
              <p className="px-2.5 py-3 text-[11px] text-[var(--muted)]">没有匹配结果</p>
            )}
          </div>
        ) : null}
      </form>

      <div className="ml-auto flex items-center gap-0.5" data-tauri-drag-region="false">
        <QuickPanel label="通知" icon={BellSimple} panelIcon={BellRinging} title="通知" subtitle="2 条最新动态" badge footer="查看全部通知">
          <PanelRow title="项目周报已生成" detail="产品研发" time="12 分钟前" tone="accent" unread />
          <PanelRow title="连接器同步完成" detail="GitHub 数据已是最新状态" time="1 小时前" tone="success" />
        </QuickPanel>
        <QuickPanel label="任务" icon={ClipboardText} panelIcon={ListChecks} title="任务" subtitle="1 项进行中" footer="查看全部任务" onFooter={() => onNavigate("project-home")}>
          <PanelRow title="完善桌面端通知中心" detail="产品研发 · 今天" time="进行中" tone="accent" progress={68} />
          <PanelRow title="复核连接器权限" detail="连接器 · 明天" time="待处理" tone="neutral" />
        </QuickPanel>
        <span aria-hidden className="mx-1.5 h-5 w-px bg-[var(--line-strong)]" />
        <WindowControl label="最小化" icon={Minus} onClick={() => void performWindowAction("minimize")} />
        <WindowControl
          label="最大化或还原"
          icon={Square}
          onClick={() => void performWindowAction("toggleMaximize")}
          iconClassName="size-[13px]"
        />
        <WindowControl label="关闭" icon={X} onClick={() => void performWindowAction("close")} danger />
      </div>
    </div>
  )
}

function QuickPanel({
  label,
  icon: Icon,
  panelIcon: PanelIcon,
  title,
  subtitle,
  footer,
  onFooter,
  badge = false,
  children,
}: {
  label: string
  icon: typeof BellSimple
  panelIcon: typeof BellSimple
  title: string
  subtitle: string
  footer: string
  onFooter?: () => void
  badge?: boolean
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="relative flex size-7 items-center justify-center rounded-[7px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] data-[state=open]:bg-wash data-[state=open]:text-[var(--ink)]"
        >
          <Icon className="size-[15px]" weight="duotone" aria-hidden />
          {badge ? <span aria-hidden className="absolute right-[5px] top-[5px] size-1.5 rounded-full border border-panel bg-[var(--accent)]" /> : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[320px] rounded-[7px] p-0">
        <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-3.5 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]">
            <PanelIcon aria-hidden className="size-4" weight="duotone" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{title}</p>
            <p className="mt-0.5 text-[9.5px] text-[var(--muted)]">{subtitle}</p>
          </div>
          <span className="ml-auto rounded-full border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[9px] font-medium text-[var(--muted-strong)]">最近</span>
        </div>
        <div className="p-1.5">{children}</div>
        <button
          type="button"
          onClick={onFooter}
          className="flex h-9 w-full items-center justify-center gap-1.5 border-t border-[var(--line)] bg-[var(--surface-subtle)] text-[10.5px] font-medium text-[var(--accent-ink)] outline-none transition-colors hover:bg-[var(--accent-soft)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
        >
          {footer}
          <ArrowRight aria-hidden className="size-3" weight="bold" />
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PanelRow({
  title,
  detail,
  time,
  tone,
  unread = false,
  progress,
}: {
  title: string
  detail: string
  time: string
  tone: "accent" | "success" | "neutral"
  unread?: boolean
  progress?: number
}) {
  const Icon = tone === "success" ? CheckCircle : tone === "neutral" ? Circle : Clock
  return (
    <button type="button" className={cn("group relative flex w-full items-start gap-2.5 rounded-[8px] px-2.5 py-2.5 text-left outline-none transition-colors hover:bg-wash focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", unread && "bg-[color-mix(in_srgb,var(--accent-soft)_45%,transparent)]")}>
      {unread ? <span aria-hidden className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--accent)]" /> : null}
      <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[7px]", tone === "success" ? "bg-[#edf7f2] text-[var(--ok-ink)]" : tone === "neutral" ? "bg-[var(--surface-subtle)] text-[var(--muted)]" : "bg-[var(--accent-soft)] text-[var(--accent-ink)]")}>
        <Icon aria-hidden className="size-3.5" weight={tone === "neutral" ? "regular" : "fill"} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-[11px] font-medium text-[var(--ink)]">{title}</p>
          <span className="ml-auto shrink-0 text-[9px] text-[var(--muted)]">{time}</span>
        </div>
        <p className="mt-0.5 truncate text-[9.5px] text-[var(--muted)]">{detail}</p>
        {progress !== undefined ? (
          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-[var(--line)]">
            <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${progress}%` }} />
          </span>
        ) : null}
      </div>
    </button>
  )
}

function WindowControl({
  label,
  icon: Icon,
  onClick,
  danger,
  iconClassName,
}: {
  label: string
  icon: typeof Minus
  onClick: () => void
  danger?: boolean
  iconClassName?: string
}) {
  return (
    <button
      data-tauri-drag-region="false"
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-[7px] text-[var(--ink)] outline-none transition-colors focus-visible:bg-wash",
        danger ? "hover:bg-[#f5e0de] hover:text-[#b8493f]" : "hover:bg-wash",
      )}
    >
      <Icon className={cn("size-[14px]", iconClassName)} />
    </button>
  )
}
