import type { Effect } from "@tauri-apps/api/window"

import type { SidebarStyle } from "@/lib/sidebar-style"

const GLASS_FLAG_ID = "world-glass-flag"

/** 当前运行时是否处于原生玻璃平台（桌面端 + 平台支持窗口特效） */
function isNativeGlassRuntime(): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false
  if (!("__TAURI_INTERNALS__" in window)) return false
  return /Windows|Macintosh/.test(navigator.userAgent)
}

/** 幂等确保玻璃标记存在：根布局的首帧内联脚本注入，此处兜底防意外移除 */
function ensureGlassFlag(): void {
  if (!document.getElementById(GLASS_FLAG_ID)) {
    const flag = document.createElement("style")
    flag.id = GLASS_FLAG_ID
    ;(document.head ?? document.documentElement).appendChild(flag)
  }
}

/**
 * 客户端把侧栏磨砂材质同步为原生窗口特效：模糊由系统承担（Windows acrylic /
 * macOS vibrancy），页面层只叠浅色玻璃 tint，桌面背景得以通透出模糊效果。
 * 标记以 head 内 <style> 为载体：html 上的属性会被 React 水合清除。
 */
export async function syncSidebarWindowEffects(style: SidebarStyle, theme: "light" | "dark"): Promise<void> {
  if (!isNativeGlassRuntime()) return
  try {
    ensureGlassFlag()
    const { getCurrentWindow } = await import("@tauri-apps/api/window")
    const win = getCurrentWindow()
    // 系统磨砂底色跟随应用主题明暗，避免浅色应用叠在深色磨砂上发闷
    await win.setTheme(theme)
    if (style === "frosted") {
      await win.setEffects({ effects: ["acrylic", "sidebar"] as Effect[] })
    } else {
      await win.clearEffects()
    }
  } catch (err) {
    console.warn("同步窗口磨砂特效失败（页面内材质不受影响）", err)
  }
}
