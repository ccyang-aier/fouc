"use client"

/**
 * 主题色分区：六个内置预设 + 任意取色（系统色板）。
 * 预设由 globals.css 的 data-accent 目录提供整套手工调校的派生色；
 * custom 通道把基色写入 --accent-custom，派生色实时推导，切换即刻全局生效。
 */

import { useRef } from "react"
import { Swatches } from "@phosphor-icons/react"

import { accentOptions, type AccentPref } from "@/lib/appearance"
import { cn } from "@/lib/utils"

import { SettingsSection } from "./section-card"

export function AccentSection({
  value,
  customColor,
  onChange,
  onCustomColor,
}: {
  value: AccentPref
  customColor: string
  onChange: (value: AccentPref) => void
  onCustomColor: (hex: string) => void
}) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const activePreset = accentOptions.find((option) => option.id === value)
  const activeColor = activePreset?.color ?? customColor

  return (
    <SettingsSection icon={Swatches} title="主题色" description="强调色作用于激活状态、主要操作与交互反馈">
      <div className="flex flex-wrap items-center gap-2 py-1" role="radiogroup" aria-label="主题色">
        {accentOptions.map((option) => {
          const selected = value === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              title={option.label}
              onClick={() => onChange(option.id)}
              className={cn(
                "size-[26px] rounded-full outline-none transition-[transform,box-shadow] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95",
                selected
                  ? "shadow-[0_0_0_2px_var(--panel),0_0_0_4px_var(--accent-ink)]"
                  : "hover:scale-110",
              )}
              style={{ backgroundColor: option.color }}
            />
          )
        })}

        <span className="mx-1.5 h-5 w-px bg-[var(--line)]" aria-hidden />

        <button
          type="button"
          role="radio"
          aria-checked={value === "custom"}
          aria-label="自定义主题色"
          title="自定义主题色"
          onClick={() => pickerRef.current?.click()}
          className={cn(
            "relative size-[26px] rounded-full outline-none transition-[transform,box-shadow] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95 hover:scale-110",
            value === "custom" && "shadow-[0_0_0_2px_var(--panel),0_0_0_4px_var(--accent-ink)]",
          )}
        >
          {/* 色环底座：从任意基色都能找到入口的彩虹环 */}
          <span
            className="absolute inset-0 rounded-full"
            aria-hidden
            style={{
              background:
                "conic-gradient(from 210deg, #e2564d, #d99a2b, #5aa469, #3f8fd2, #7a5cd6, #d256a0, #e2564d)",
            }}
          />
          {value === "custom" ? (
            <span
              className="absolute inset-[3px] rounded-full border border-white/40"
              aria-hidden
              style={{ backgroundColor: customColor }}
            />
          ) : (
            <span className="absolute inset-[3px] flex items-center justify-center rounded-full bg-panel text-[var(--muted-strong)]">
              <Swatches className="size-[12px]" weight="fill" aria-hidden />
            </span>
          )}
        </button>
        <input
          ref={pickerRef}
          type="color"
          value={customColor}
          onChange={(event) => onCustomColor(event.target.value)}
          className="sr-only"
          aria-hidden
          tabIndex={-1}
        />

        <span className="ml-1.5 flex items-baseline gap-1.5">
          <span className="text-[11px] text-[var(--muted-strong)]">{activePreset?.label ?? "自定义"}</span>
          <span className="font-mono text-[10px] text-[var(--muted)]">{activeColor.toUpperCase()}</span>
        </span>
      </div>
    </SettingsSection>
  )
}
