"use client"

/**
 * 侧边栏材质偏好（标准 / 磨砂玻璃），随 world 的 sidebarStyle 一同移植。
 * 状态落在 html[data-sidebar-style] 上，由 sidebar-material.css 消费；本地持久化。
 */

export const SIDEBAR_STYLE_IDS = ["standard", "frosted"] as const
export type SidebarStyle = (typeof SIDEBAR_STYLE_IDS)[number]

export const sidebarStyleLabels: Record<SidebarStyle, string> = {
  standard: "标准",
  frosted: "磨砂玻璃",
}

const STORAGE_KEY = "fouc.sidebar-style"

export function readStoredSidebarStyle(): SidebarStyle {
  if (typeof window === "undefined") return "frosted"
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return saved === "standard" || saved === "frosted" ? saved : "frosted"
}

export function applySidebarStyle(style: SidebarStyle): void {
  if (typeof document === "undefined") return
  document.documentElement.dataset.sidebarStyle = style
  window.localStorage.setItem(STORAGE_KEY, style)
}
