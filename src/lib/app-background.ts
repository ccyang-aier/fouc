/**
 * 应用背景目录：画布层可切换的内置背景（照片 / 渐变），
 * 磨砂玻璃质感构建于画布之上——玻璃透出的即所选背景。
 * 纯数据 + DOM 应用模块（无 "use client"，根布局的首帧脚本也引用目录），
 * 选择持久化在 localStorage，键与 layout 内联脚本保持同步。
 */

export type AppBackground = {
  id: string
  label: string
  /** 完整 background 图层值（不含底色；照片为 cover 定位，渐变自带满幅） */
  css: string
}

const STORAGE_KEY = "fouc.app-background"

export const APP_BACKGROUNDS: AppBackground[] = [
  {
    id: "dusk-shore",
    label: "暮色",
    css: 'url("/wallpapers/dusk-shore.jpg") center / cover no-repeat',
  },
  {
    id: "mist",
    label: "雾霭",
    css: "linear-gradient(165deg, #b9cde2 0%, #cfc8de 46%, #b7d3c7 100%)",
  },
  {
    id: "warm-sand",
    label: "暖沙",
    css: "linear-gradient(165deg, #e9d8bf 0%, #dfc9b4 52%, #d3c2ae 100%)",
  },
  {
    id: "graphite",
    label: "石墨",
    css: "linear-gradient(165deg, #2b303b 0%, #232733 55%, #1d2530 100%)",
  },
]

export function readStoredAppBackground(): string {
  if (typeof window === "undefined") return ""
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return APP_BACKGROUNDS.some((background) => background.id === saved) ? (saved as string) : ""
}

/** 应用背景到 html（dataset 门控 CSS 覆盖，CSS 变量承载图层值）并持久化 */
export function applyAppBackground(id: string): void {
  if (typeof document === "undefined") return
  const html = document.documentElement
  const background = APP_BACKGROUNDS.find((entry) => entry.id === id)
  if (background) {
    html.dataset.appWallpaper = ""
    html.style.setProperty("--app-wallpaper", background.css)
    window.localStorage.setItem(STORAGE_KEY, background.id)
  } else {
    delete html.dataset.appWallpaper
    html.style.removeProperty("--app-wallpaper")
    window.localStorage.removeItem(STORAGE_KEY)
  }
}
