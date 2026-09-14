"use client"

/**
 * 侧栏导航列表（工作台侧栏 / 设置侧栏共用）：
 * 激活态为主题色实底容器（全局唯一的实色锚点），切换时以弹簧物理沿列表滑动到位；
 * 悬停白底仅作用于未激活行，避免盖住滑入中的激活容器造成两段式闪变。
 */

import type { ReactNode } from "react"
import type { Icon } from "@phosphor-icons/react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

/** 行高与行距须与下方 space-y 保持同步，指示容器据此计算滑动位置。 */
const ROW_HEIGHT = 36
const ROW_GAP = 3

export type SidebarNavItem<T extends string> = {
  id: T
  label: string
  icon: Icon
  /** 未激活行图标的着色（激活行固定白字，不吃此色） */
  iconClass?: string
}

/** renderTrailing 的上下文：折叠轨道下行尾元素需切换为图标角标形态 */
export type SidebarNavTrailingContext = {
  collapsed: boolean
}

export function SidebarNavList<T extends string>({
  items,
  value,
  onChange,
  collapsible = false,
  collapsed = false,
  renderRow,
  renderTrailing,
}: {
  items: Array<SidebarNavItem<T>>
  value: T | null
  onChange: (value: T) => void
  /** 工作台侧栏折叠时随 .sidebar-label 约定隐藏文字 */
  collapsible?: boolean
  /** 折叠轨道形态：图标居中，行尾元素交给 renderTrailing 自行降级 */
  collapsed?: boolean
  /** 行级包裹：把指定行接入下拉触发器等交互容器，其余行原样渲染 */
  renderRow?: (item: SidebarNavItem<T>, row: ReactNode) => ReactNode
  renderTrailing?: (item: SidebarNavItem<T>, context: SidebarNavTrailingContext) => ReactNode
}) {
  const activeIndex = items.findIndex((item) => item.id === value)

  return (
    <div className="relative">
      {activeIndex >= 0 ? (
        <motion.span
          aria-hidden
          initial={false}
          animate={{ y: activeIndex * (ROW_HEIGHT + ROW_GAP) }}
          transition={{ type: "spring", stiffness: 460, damping: 38 }}
          className="absolute inset-x-0 top-0 rounded-[8px] bg-[var(--accent)] shadow-[inset_0_1px_0_rgb(255_255_255/0.16)]"
          style={{ height: ROW_HEIGHT }}
        />
      ) : null}
      <ul className="relative space-y-[3px]">
        {items.map((item) => {
          const selected = item.id === value
          const Icon = item.icon
          const row = (
            <button
              type="button"
              aria-label={item.label}
              aria-current={selected ? "page" : undefined}
              onClick={() => onChange(item.id)}
              className={cn(
                "relative flex h-[36px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[12px] font-medium outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                collapsed && "justify-center px-0",
                selected
                  ? "text-white"
                  : "text-[var(--ink-soft)] hover:bg-raise hover:text-[var(--ink)]",
              )}
            >
              <Icon
                className={cn(
                  "size-[17px] shrink-0 transition-colors",
                  selected ? "text-white" : item.iconClass ?? "text-[var(--muted-strong)]",
                )}
                weight={selected ? "fill" : "regular"}
                aria-hidden
              />
              <span className={cn("truncate", collapsible && "sidebar-label")}>{item.label}</span>
              {renderTrailing?.(item, { collapsed })}
            </button>
          )
          return (
            <li key={item.id}>
              {renderRow ? renderRow(item, row) : row}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
