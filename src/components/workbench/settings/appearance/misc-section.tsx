"use client"

/**
 * 其它分区：动效强度与外观默认值恢复。
 */

import { ArrowCounterClockwise } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { SettingsSection } from "./section-card"

export function MiscSection({
  reducedMotion,
  onReducedMotionChange,
  onReset,
}: {
  reducedMotion: boolean
  onReducedMotionChange: (value: boolean) => void
  onReset: () => void
}) {
  return (
    <SettingsSection title="其它" description="动效与默认值">
      <div className="flex items-center justify-between gap-6 py-0.5">
        <div className="min-w-0">
          <h3 className="text-[12px] font-medium">减弱动效</h3>
          <p className="mt-0.5 text-[10.5px] text-[var(--muted)]">停用过渡与动画，状态切换即时呈现</p>
        </div>
        <Switch checked={reducedMotion} onChange={onReducedMotionChange} label="减弱动效" />
      </div>
      <div className="mt-3.5 flex items-center justify-between gap-6 border-t border-[var(--line)] pt-3.5">
        <div className="min-w-0">
          <h3 className="text-[12px] font-medium">恢复默认外观</h3>
          <p className="mt-0.5 text-[10.5px] text-[var(--muted)]">重置本页全部设置（含侧边栏材质）</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          className="h-8 shrink-0 rounded-[8px] px-2.5 text-[11.5px]"
        >
          <ArrowCounterClockwise className="size-3.5" aria-hidden />
          重置
        </Button>
      </div>
    </SettingsSection>
  )
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 rounded-full outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
        checked ? "bg-[var(--accent)]" : "bg-[var(--switch-off)]",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-4 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          checked ? "left-[19px]" : "left-[3px]",
        )}
      />
    </button>
  )
}
