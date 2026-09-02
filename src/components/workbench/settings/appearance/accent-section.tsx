"use client"

import { Check, Swatches } from "@phosphor-icons/react"

import { ACCENT_IDS, accentOptions, type AccentId } from "@/lib/appearance"
import { cn } from "@/lib/utils"

import { SectionCard } from "./section-card"

export function AccentSection({ value, onChange }: { value: AccentId; onChange: (value: AccentId) => void }) {
  return (
    <SectionCard icon={Swatches} title="主题色" description="用于激活状态、主要操作与交互反馈">
      <div className="grid grid-cols-3 gap-2.5 max-[760px]:grid-cols-2" role="radiogroup" aria-label="主题色">
        {ACCENT_IDS.map((id) => {
          const option = accentOptions.find((item) => item.id === id)!
          const selected = value === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(id)}
              className={cn(
                "flex h-[54px] items-center gap-3 rounded-[9px] border px-3 text-left outline-none transition-[border-color,box-shadow,transform,background-color] hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                selected ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_0_1px_var(--accent)]" : "border-[var(--line)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)]",
              )}
            >
              <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-black/10" style={{ backgroundColor: option.color }}>
                {selected ? <Check className="size-3.5 text-white" weight="bold" /> : null}
              </span>
              <span className={cn("text-[11.5px]", selected ? "font-medium text-[var(--ink)]" : "text-[var(--muted-strong)]")}>{option.label}</span>
            </button>
          )
        })}
      </div>
    </SectionCard>
  )
}
