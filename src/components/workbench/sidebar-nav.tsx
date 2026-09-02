"use client"

/**
 * 侧栏导航列表（工作台侧栏 / 设置侧栏共用）：
 * 统一「亮白容器」hover 语言；激活态为白色指示容器，切换时沿列表滑动到位。
 */

import type { ReactNode } from "react"
import type { Icon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

/** 行高与行距须与下方 space-y 保持同步，指示容器据此计算滑动位置。 */
const ROW_HEIGHT = 36
const ROW_GAP = 3

export type SidebarNavItem<T extends string> = {
  id: T
  label: string
  icon: Icon
}

export function SidebarNavList<T extends string>({
  items,
  value,
  onChange,
  collapsible = false,
  renderTrailing,
}: {
  items: Array<SidebarNavItem<T>>
  value: T
  onChange: (value: T) => void
  /** 工作台侧栏折叠时随 .sidebar-label 约定隐藏文字 */
  collapsible?: boolean
  renderTrailing?: (item: SidebarNavItem<T>) => ReactNode
}) {
  const activeIndex = items.findIndex((item) => item.id === value)

  return (
    <div className="relative">
      {activeIndex >= 0 ? (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 rounded-[8px] bg-[var(--accent-soft)] shadow-[inset_0_0_0_1px_var(--accent-soft-line)] transition-transform duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            height: ROW_HEIGHT,
            transform: `translateY(${activeIndex * (ROW_HEIGHT + ROW_GAP)}px)`,
          }}
        />
      ) : null}
      <ul className="relative space-y-[3px]">
        {items.map((item) => {
          const selected = item.id === value
          const Icon = item.icon
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-current={selected ? "page" : undefined}
                onClick={() => onChange(item.id)}
                className={cn(
                  "flex h-[36px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[12px] font-medium outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  "text-[var(--ink-soft)] hover:bg-raise hover:text-[var(--ink)]",
                  selected && "text-[var(--accent-ink)]",
                )}
              >
                <Icon
                  className={cn(
                    "size-[17px] shrink-0 transition-colors",
                    selected ? "text-[var(--accent-ink)]" : "text-[var(--muted-strong)]",
                  )}
                  weight={selected ? "fill" : "regular"}
                  aria-hidden
                />
                <span className={cn("truncate", collapsible && "sidebar-label")}>{item.label}</span>
                {renderTrailing?.(item)}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
