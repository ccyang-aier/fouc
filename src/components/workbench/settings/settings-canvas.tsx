"use client"

/**
 * 设置画布：应用级设置页面（非弹窗）。
 * 布局为独立的设置侧栏 + 右侧内容画布；侧栏与工作台侧栏共用同一套材质与拖拽调宽。
 */

import { useState } from "react"
import {
  Info,
  MagnifyingGlass,
  PaintBrush,
  Robot,
  SlidersHorizontal,
} from "@phosphor-icons/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import { SidebarNavList, type SidebarNavItem } from "../sidebar-nav"
import { SidebarResizeHandle, useSidebarWidth } from "../sidebar-resize"
import { AboutSettings } from "./about-settings"
import { AgentSettings } from "./agent-settings"
import { AppearanceSettings } from "./appearance-settings"
import { GeneralSettings } from "./general-settings"

export type SettingsSection = "appearance" | "general" | "agents" | "about"

const SECTIONS: Array<SidebarNavItem<SettingsSection>> = [
  { id: "appearance", label: "外观", icon: PaintBrush, color: "text-[#d184ad]" },
  { id: "general", label: "通用", icon: SlidersHorizontal, color: "text-[#6e9fe6]" },
  { id: "agents", label: "Agent", icon: Robot, color: "text-[#9b80dc]" },
  { id: "about", label: "关于", icon: Info, color: "text-[#63b99d]" },
]

export function SettingsCanvas({
  initialSection = "appearance",
}: {
  initialSection?: SettingsSection
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
          !dragging && "transition-[width] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        )}
      >
        <nav
          aria-label="设置分区"
          // 分隔线用伪元素从圆角拐点（16px）起线，与工作台侧边栏一致
          className="relative flex h-full min-h-0 flex-col px-3 pb-5 pt-[14px] after:pointer-events-none after:absolute after:top-[16px] after:bottom-0 after:right-0 after:w-px after:bg-[var(--wt-sidebar-glass-edge)] after:content-['']"
        >
          <div className="relative">
            <MagnifyingGlass
              className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-[#a8aca8]"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索设置"
              aria-label="搜索设置"
              className="h-[34px] w-full rounded-[6px] border border-[#e5e6e3] bg-white pl-9 pr-3 text-[11.5px] text-[var(--ink)] outline-none transition-[border-color,box-shadow] placeholder:text-[#afb3af] focus:border-[#8ba6bc] focus:ring-2 focus:ring-[#7797b3]/15"
            />
          </div>
          <p className="mb-2 mt-5 px-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-[#a7aaa6]">
            Preferences
          </p>
          <SidebarNavList items={visibleSections} value={section} onChange={setSection} />
          {visibleSections.length === 0 ? (
            <p className="px-2.5 py-4 text-[11px] text-[#a0a5a3]">没有匹配的设置</p>
          ) : null}

          <SidebarResizeHandle dragging={dragging} onPointerDown={startResize} />
        </nav>
      </div>

      <ScrollArea
        as="main"
        /* 顶部分割线与左缘分割线同用 --wt-sidebar-glass-edge；从圆角切点（16px）起线，避免横线戳进圆角区 */
        className="min-h-0 flex-1 overflow-hidden rounded-tl-[16px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.012)] before:pointer-events-none before:absolute before:top-0 before:right-0 before:left-[16px] before:h-px before:bg-[var(--wt-sidebar-glass-edge)] before:content-['']"
        viewportClassName="bg-white"
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
