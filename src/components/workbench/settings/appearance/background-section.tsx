"use client"

/**
 * 应用背景分区：内置背景目录（默认渐变 / 照片 / 渐变预设）。
 * 画布层承载所选背景，磨砂玻璃材质透出的即背景本身；
 * 预览直接渲染背景图层值，跟随当前主题明暗。
 */

import { Check } from "@phosphor-icons/react"

import { APP_BACKGROUNDS } from "@/lib/app-background"
import { cn } from "@/lib/utils"

import { SettingsSection } from "./section-card"

export function BackgroundSection({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  return (
    <SettingsSection title="应用背景" description="作为画布垫在玻璃材质之下，修改即时生效">
      <div className="grid w-fit grid-cols-3 gap-2.5" role="radiogroup" aria-label="应用背景">
        <BackgroundCard
          label="默认"
          hint="晨雾渐变"
          background="var(--win-canvas)"
          selected={value === ""}
          onSelect={() => onChange("")}
        />
        {APP_BACKGROUNDS.map((entry) => (
          <BackgroundCard
            key={entry.id}
            label={entry.label}
            hint="内置背景"
            background={entry.css}
            selected={value === entry.id}
            onSelect={() => onChange(entry.id)}
          />
        ))}
      </div>
    </SettingsSection>
  )
}

function BackgroundCard({
  label,
  hint,
  background,
  selected,
  onSelect,
}: {
  label: string
  hint: string
  background: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative w-[168px] rounded-[10px] border p-2 text-left outline-none transition-[border-color,box-shadow,transform] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] hover:-translate-y-px",
        selected
          ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]"
          : "border-[var(--line)] hover:border-[var(--line-strong)]",
      )}
    >
      <span
        aria-hidden
        className="block h-[72px] overflow-hidden rounded-[7px] border border-[var(--line)]"
        style={{ background }}
      />
      <span className="mt-2 flex items-center gap-1.5 px-0.5">
        <span className={cn("text-[11.5px]", selected ? "font-medium text-[var(--ink)]" : "text-[var(--muted-strong)]")}>
          {label}
        </span>
        <span className="truncate text-[9.5px] text-[var(--muted)]">{hint}</span>
      </span>
      {selected ? (
        <span className="absolute right-2 top-2 flex size-[18px] items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-sm">
          <Check className="size-3" weight="bold" />
        </span>
      ) : null}
    </button>
  )
}
