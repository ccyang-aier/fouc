"use client"

/**
 * 侧边栏材质分区：标准 / 磨砂玻璃。
 * 预览在多彩渐变底上真实渲染 backdrop-blur，直观呈现两种材质的差异；
 * 材质令牌直接取自 globals.css（跟随当前主题明暗）。
 */

import { Check } from "@phosphor-icons/react"

import { SIDEBAR_STYLE_IDS, sidebarStyleLabels, type SidebarStyle } from "@/lib/sidebar-style"
import { cn } from "@/lib/utils"

import { SettingsSection } from "./section-card"

const MATERIAL_HINTS: Record<SidebarStyle, string> = {
  standard: "纯色面板，稳定清晰",
  frosted: "半透玻璃，透出背景层次",
}

export function MaterialSection({
  value,
  onChange,
}: {
  value: SidebarStyle
  onChange: (style: SidebarStyle) => void
}) {
  return (
    <SettingsSection title="侧边栏材质" description="工作台与设置侧栏的面板质感">
      <div className="grid w-fit grid-cols-2 gap-2.5" role="radiogroup" aria-label="侧边栏材质">
        {SIDEBAR_STYLE_IDS.map((id) => {
          const selected = value === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(id)}
              className={cn(
                "relative w-[232px] rounded-[10px] border p-2 text-left outline-none transition-[border-color,box-shadow,transform] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] hover:-translate-y-px",
                selected
                  ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]"
                  : "border-[var(--line)] hover:border-[var(--line-strong)]",
              )}
            >
              <MaterialPreview frosted={id === "frosted"} selected={selected} />
              <span className="mt-2 flex items-center gap-1.5 px-0.5">
                <span className={cn("text-[11.5px]", selected ? "font-medium text-[var(--ink)]" : "text-[var(--muted-strong)]")}>
                  {sidebarStyleLabels[id]}
                </span>
                <span className="truncate text-[9.5px] text-[var(--muted)]">{MATERIAL_HINTS[id]}</span>
              </span>
            </button>
          )
        })}
      </div>
    </SettingsSection>
  )
}

function MaterialPreview({ frosted, selected }: { frosted: boolean; selected: boolean }) {
  return (
    <span className="relative block h-[64px] overflow-hidden rounded-[7px] border border-[var(--line)]" aria-hidden>
      {/* 桌面壁纸示意：柔和多彩渐变，用于呈现材质的通透差异 */}
      <span
        className="absolute inset-0 block"
        style={{ background: "linear-gradient(112deg, #7fb5c9 0%, #a48ec4 40%, #d9a67a 76%, #88bfa8 100%)" }}
      />
      <span
        className={cn(
          "absolute inset-y-[12%] left-[7%] block w-[36%] rounded-[6px] border",
          frosted ? "border-white/40" : "border-[var(--line)]",
        )}
        style={{
          backgroundColor: frosted ? "var(--wt-sidebar-frosted-panel)" : "var(--wt-sidebar-standard-panel)",
          ...(frosted
            ? {
                WebkitBackdropFilter: "blur(7px) saturate(150%)",
                backdropFilter: "blur(7px) saturate(150%)",
              }
            : {}),
        }}
      >
        <span className="mx-[16%] mt-[24%] block h-[3.5px] w-[68%] rounded-full bg-[var(--ink)]/70" />
        <span className="mx-[16%] mt-[12%] block h-[3px] w-[46%] rounded-full bg-[var(--ink)]/30" />
        <span className="mx-[16%] mt-[9%] block h-[3px] w-[58%] rounded-full bg-[var(--ink)]/30" />
      </span>
      <span
        className="absolute inset-y-[16%] right-[7%] block w-[42%] rounded-[6px] border border-[var(--line)] bg-panel"
      >
        <span className="mx-[12%] mt-[20%] block h-[4px] w-[52%] rounded-full bg-[var(--ink)]/80" />
        <span className="mx-[12%] mt-[14%] block h-[3px] w-[78%] rounded-full bg-[var(--ink)]/25" />
        <span className="mx-[12%] mt-[9%] block h-[3px] w-[60%] rounded-full bg-[var(--ink)]/25" />
      </span>
      {selected ? (
        <span className="absolute right-2 top-2 flex size-[18px] items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-sm">
          <Check className="size-3" weight="bold" />
        </span>
      ) : null}
    </span>
  )
}
