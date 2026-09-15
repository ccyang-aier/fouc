"use client"

/**
 * 设置画布：应用级设置页面（非弹窗）。
 * 布局为独立的设置侧栏 + 右侧内容画布；侧栏与工作台侧栏共用同一套材质与拖拽调宽。
 */

import { useState } from "react"
import {
  ArrowLeft,
  Info,
  MagnifyingGlass,
  PaintBrush,
  Robot,
  SlidersHorizontal,
} from "@phosphor-icons/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import { NavButton, type SidebarRowItem } from "../navigation-sidebar"
import { SidebarResizeHandle, useSidebarWidth } from "../sidebar-resize"
import { AboutSettings } from "./about-settings"
import { AgentSettings } from "./agent-settings"
import { AppearanceSettings } from "./appearance-settings"
import { GeneralSettings } from "./general-settings"

export type SettingsSection = "appearance" | "general" | "agents" | "about"

const SECTIONS: Array<SidebarRowItem & { id: SettingsSection }> = [
  { id: "appearance", label: "外观", icon: PaintBrush },
  { id: "general", label: "通用", icon: SlidersHorizontal },
  { id: "agents", label: "Agent", icon: Robot },
  { id: "about", label: "关于", icon: Info },
]

export function SettingsCanvas({
  initialSection = "appearance",
  onBack,
}: {
  initialSection?: SettingsSection
  onBack?: () => void
}) {
  const [section, setSection] = useState<SettingsSection>(initialSection)
  const [query, setQuery] = useState("")
  const { width, dragging, startResize } = useSidebarWidth()
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN")
  const visibleSections = normalizedQuery
    ? SECTIONS.filter((item) => item.label.toLocaleLowerCase("zh-CN").includes(normalizedQuery))
    : SECTIONS

  return (
    <div
      /* 材质挂在设置页根节点：侧栏与主面板共用同一块材质底座，圆角缺口与侧栏无缝衔接 */
      className="sidebar-material flex h-full min-h-0"
      aria-label="设置"
    >
      <div
        style={{ width, zIndex: 20 }}
        className={cn(
          "h-full shrink-0",
          !dragging && "transition-[width] duration-[220ms] ease-out-soft",
        )}
      >
        <nav
          aria-label="设置分区"
          className="relative flex h-full min-h-0 flex-col border-r border-[var(--wt-sidebar-glass-edge)] px-3 pb-5 pt-3"
        >
          <div className="flex h-9 shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-label="返回工作台"
              onClick={onBack}
              className="flex size-7 shrink-0 items-center justify-center rounded-[7px] text-[#6f7478] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <ArrowLeft className="size-4" weight="bold" aria-hidden />
            </button>
            <span className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--ink)]">设置</span>
            <span className="mt-px font-mono text-[10px] text-[var(--muted)]">v0.1.0</span>
          </div>

          <div className="relative mt-2.5">
            <MagnifyingGlass
              className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-[var(--muted)]"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索设置"
              aria-label="搜索设置"
              className="h-[34px] w-full rounded-[6px] border border-[var(--line)] bg-panel pl-9 pr-3 text-[11.5px] text-[var(--ink)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
            />
          </div>
          <p className="mb-2 mt-5 px-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--muted)]">
            Preferences
          </p>
          <div className="space-y-1">
            {visibleSections.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={section === item.id}
                onSelect={() => setSection(item.id as SettingsSection)}
              />
            ))}
          </div>
          {visibleSections.length === 0 ? (
            <p className="px-2.5 py-4 text-[11px] text-[var(--muted)]">没有匹配的设置</p>
          ) : null}

          <SidebarResizeHandle dragging={dragging} onPointerDown={startResize} />
        </nav>
      </div>

      <ScrollArea
        as="main"
        className="min-h-0 flex-1 overflow-hidden bg-panel"
        viewportClassName="bg-panel"
      >
        {section === "appearance" ? (
          <AppearanceSettings />
        ) : section === "general" ? (
          <GeneralSettings />
        ) : section === "agents" ? (
          <AgentSettings />
        ) : (
          <AboutSettings />
        )}
      </ScrollArea>
    </div>
  )
}
