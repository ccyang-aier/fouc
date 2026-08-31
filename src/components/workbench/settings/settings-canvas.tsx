"use client"

/**
 * 设置画布：应用级设置页面（非弹窗）。
 * 布局为左侧分区导航 + 右侧内容画布；各分区只承载真实可验证的内容。
 */

import { useState } from "react"
import { ArrowLeft, Info, Robot, SlidersHorizontal } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

import { AboutSettings } from "./about-settings"
import { AgentSettings } from "./agent-settings"
import { GeneralSettings } from "./general-settings"

export type SettingsSection = "general" | "agents" | "about"

const SECTIONS: Array<{
  id: SettingsSection
  label: string
  icon: typeof SlidersHorizontal
}> = [
  { id: "general", label: "通用", icon: SlidersHorizontal },
  { id: "agents", label: "Agent 纳管", icon: Robot },
  { id: "about", label: "关于", icon: Info },
]

export function SettingsCanvas({
  initialSection = "agents",
  onBack,
}: {
  initialSection?: SettingsSection
  onBack?: () => void
}) {
  const [section, setSection] = useState<SettingsSection>(initialSection)

  return (
    <div className="flex h-full min-h-0" aria-label="设置">
      <nav
        aria-label="设置分区"
        className="flex w-[188px] shrink-0 flex-col border-r border-[#eceef1] bg-[#f8f9f8] px-3 pb-4 pt-4 max-[900px]:w-[164px]"
      >
        <div className="flex h-8 items-center gap-1 px-1">
          {onBack && (
            <button
              type="button"
              aria-label="返回工作台"
              onClick={onBack}
              className="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-black/[0.05] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <ArrowLeft className="size-4" weight="bold" aria-hidden />
            </button>
          )}
          <h1 className="text-[15px] font-semibold tracking-[-0.01em]">设置</h1>
        </div>
        <div className="mt-3.5 space-y-0.5">
          {SECTIONS.map((item) => {
            const Icon = item.icon
            const selected = section === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-current={selected ? "page" : undefined}
                onClick={() => setSection(item.id)}
                className={cn(
                  "flex h-[32px] w-full items-center gap-2 rounded-[8px] px-2.5 text-left text-[12px] outline-none transition-[background-color,box-shadow,color] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  selected
                    ? "bg-white text-[var(--ink)] shadow-[0_1px_2px_rgba(23,25,27,0.06),0_0_0_1px_rgba(23,25,27,0.05)] font-medium"
                    : "text-[var(--ink-soft)] hover:bg-black/[0.04] hover:text-[var(--ink)]",
                )}
              >
                <Icon
                  className={cn("size-[15px] shrink-0", selected ? "text-[var(--accent)]" : "text-[#929aa3]")}
                  weight="fill"
                  aria-hidden
                />
                {item.label}
              </button>
            )
          })}
        </div>
        <p className="mt-auto px-2.5 text-[10px] text-[var(--muted)]">Fouc v0.1.0</p>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfcfb]">
        {section === "general" ? (
          <GeneralSettings />
        ) : section === "agents" ? (
          <AgentSettings />
        ) : (
          <AboutSettings />
        )}
      </div>
    </div>
  )
}
