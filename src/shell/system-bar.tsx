"use client"

/** 主区系统栏：macOS 风格全局搜索、通知/任务快捷面板与桌面窗口控制。 */

import { useEffect, useMemo, useRef, useState } from "react"
import {
  BellSimple,
  CheckCircle,
  CheckSquare,
  Circle,
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
  { label: "助理", detail: "开始一项新任务", view: "home" },
  { label: "项目", detail: "浏览项目文件夹", view: "projects" },
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
          className="h-7 w-full rounded-[8px] border border-[var(--line)] bg-[var(--surface-subtle)] pl-8 pr-12 text-[11.5px] text-[var(--ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_2px_rgba(20,24,28,0.04)] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[var(--muted)] focus:border-[var(--line-strong)] focus:bg-panel focus:shadow-[0_0_0_3px_var(--accent-soft)]"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-[4px] border border-[var(--line)] bg-panel px-1.5 py-0.5 font-sans text-[9px] leading-none text-[var(--muted)] shadow-[0_1px_1px_rgba(20,24,28,0.04)]">
          ⌘ K
        </kbd>
        {searchOpen ? (
          <div
            id="global-search-results"
            role="listbox"
            className="absolute left-0 top-[34px] z-50 w-full overflow-hidden rounded-[10px] border border-[var(--line-strong)] bg-elevated p-1.5 shadow-[0_10px_30px_rgba(20,24,28,0.14)]"
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
        <QuickPanel label="通知" icon={BellSimple} title="通知" badge>
          <PanelRow title="项目周报已生成" detail="产品研发 · 12 分钟前" />
          <PanelRow title="连接器同步完成" detail="GitHub · 1 小时前" quiet />
        </QuickPanel>
        <QuickPanel label="任务" icon={CheckSquare} title="任务">
          <PanelRow title="完善桌面端通知中心" detail="进行中 · 今天" />
          <PanelRow title="复核连接器权限" detail="待处理 · 明天" quiet />
          <button
            type="button"
            onClick={() => onNavigate("projects")}
            className="mt-1 flex h-7 w-full items-center justify-center rounded-[6px] text-[10.5px] font-medium text-[var(--accent-ink)] outline-none hover:bg-[var(--accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            查看全部任务
          </button>
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
  title,
  badge = false,
  children,
}: {
  label: string
  icon: typeof BellSimple
  title: string
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
      <DropdownMenuContent align="end" sideOffset={8} className="w-72 p-2">
        <div className="flex h-8 items-center px-2">
          <p className="text-[12px] font-semibold text-[var(--ink)]">{title}</p>
          <span className="ml-auto text-[9.5px] text-[var(--muted)]">最近</span>
        </div>
        <div className="mt-1 border-t border-[var(--line)] pt-1">{children}</div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PanelRow({ title, detail, quiet = false }: { title: string; detail: string; quiet?: boolean }) {
  const Icon = quiet ? Circle : CheckCircle
  return (
    <div className="flex items-start gap-2 rounded-[7px] px-2 py-2 hover:bg-wash">
      <Icon
        aria-hidden
        className={cn("mt-0.5 size-3.5 shrink-0", quiet ? "text-[var(--muted)]" : "text-[var(--accent-ink)]")}
        weight={quiet ? "regular" : "fill"}
      />
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-[var(--ink)]">{title}</p>
        <p className="mt-0.5 truncate text-[9.5px] text-[var(--muted)]">{detail}</p>
      </div>
    </div>
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
