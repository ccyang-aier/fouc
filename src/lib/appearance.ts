"use client"

/**
 * 外观偏好：主题（浅色 / 深色 / 跟随系统）、字体（界面 / 代码 / 对话）与动效。
 * 状态落在 html 的 dataset（主题、字体族、动效开关）与 CSS 变量（字号）上，
 * 由 globals.css 消费；localStorage 单键持久化，首帧由 layout 内联脚本应用避免闪色。
 */

import { readStoredSidebarStyle } from "@/lib/sidebar-style"
import { syncSidebarWindowEffects } from "@/lib/window-material"

// ── 主题 ───────────────────────────────────────────────────────────

export const THEME_PREFS = ["light", "dark", "system"] as const
export type ThemePref = (typeof THEME_PREFS)[number]
export type ResolvedTheme = "light" | "dark"

export const themePrefLabels: Record<ThemePref, string> = {
  light: "浅色",
  dark: "深色",
  system: "跟随系统",
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  if (pref !== "system") return pref
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

// ── 主题色 ─────────────────────────────────────────────────────────

export const ACCENT_IDS = ["mineral", "emerald", "ocean", "violet", "amber", "rose"] as const
export type AccentId = (typeof ACCENT_IDS)[number]

/** 主题色偏好：六个内置预设，或 custom（任意取色，基色落在 --accent-custom） */
export type AccentPref = AccentId | "custom"

export const accentOptions: Array<{ id: AccentId; label: string; color: string }> = [
  { id: "mineral", label: "矿物蓝", color: "#3e63dd" },
  { id: "emerald", label: "松石绿", color: "#2D8C78" },
  { id: "ocean", label: "海湾蓝", color: "#3F78A8" },
  { id: "violet", label: "雾紫", color: "#766A9C" },
  { id: "amber", label: "琥珀", color: "#A67535" },
  { id: "rose", label: "岩蔷薇", color: "#9A6269" },
]

export const ACCENT_PREF_IDS: readonly AccentPref[] = [...ACCENT_IDS, "custom"]

// ── 字体目录（预览栈与 globals.css 的属性映射保持同步） ─────────────

export const UI_FONT_IDS = ["default", "native", "mono"] as const
export type UiFontId = (typeof UI_FONT_IDS)[number]

export const uiFontOptions: Array<{ id: UiFontId; label: string; stack: string }> = [
  {
    id: "default",
    label: "默认",
    stack:
      '"Inter Variable", "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", "PingFang SC", "Microsoft YaHei UI", "Noto Sans CJK SC", system-ui, sans-serif',
  },
  {
    id: "native",
    label: "系统原生",
    stack: 'system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei UI", "Noto Sans CJK SC", sans-serif',
  },
  {
    id: "mono",
    label: "等宽界面",
    stack:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
]

export const CODE_FONT_IDS = ["default", "cascadia", "jetbrains", "consolas"] as const
export type CodeFontId = (typeof CODE_FONT_IDS)[number]

export const codeFontOptions: Array<{ id: CodeFontId; label: string; stack: string }> = [
  {
    id: "default",
    label: "默认等宽",
    stack: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  {
    id: "cascadia",
    label: "Cascadia Code",
    stack: '"Cascadia Code", "Cascadia Mono", ui-monospace, SFMono-Regular, Consolas, monospace',
  },
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    stack: '"JetBrains Mono", "Cascadia Code", ui-monospace, SFMono-Regular, Consolas, monospace',
  },
  {
    id: "consolas",
    label: "Consolas",
    stack: 'Consolas, "Liberation Mono", "Courier New", monospace',
  },
]

export const CHAT_FONT_IDS = ["follow", "native", "serif"] as const
export type ChatFontId = (typeof CHAT_FONT_IDS)[number]

export const chatFontOptions: Array<{ id: ChatFontId; label: string; stack: string }> = [
  { id: "follow", label: "跟随界面", stack: "" },
  {
    id: "native",
    label: "系统原生",
    stack: 'system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei UI", sans-serif',
  },
  {
    id: "serif",
    label: "衬线阅读",
    stack: 'Georgia, "Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", SimSun, serif',
  },
]

export const FONT_SIZE_RANGES = {
  ui: { min: 12, max: 16 },
  code: { min: 11, max: 15 },
  chat: { min: 12, max: 17 },
} as const

// ── 偏好模型 ───────────────────────────────────────────────────────

export type AppearancePrefs = {
  theme: ThemePref
  accent: AccentPref
  /** 自定义主题色基色（#rrggbb），仅 accent === "custom" 时生效 */
  accentCustom: string
  uiFont: UiFontId
  uiFontSize: number
  codeFont: CodeFontId
  codeFontSize: number
  chatFont: ChatFontId
  chatFontSize: number
  reducedMotion: boolean
}

export const APPEARANCE_DEFAULTS: AppearancePrefs = {
  theme: "light",
  accent: "mineral",
  accentCustom: "#3e63dd",
  uiFont: "default",
  uiFontSize: 13,
  codeFont: "default",
  codeFontSize: 12,
  chatFont: "follow",
  chatFontSize: 13,
  reducedMotion: false,
}

const STORAGE_KEY = "fouc.appearance"

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function sizeOf(value: unknown, range: { min: number; max: number }, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) && n >= range.min && n <= range.max ? Math.round(n) : fallback
}

function hexOf(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback
}

export function readAppearancePrefs(): AppearancePrefs {
  if (typeof window === "undefined") return APPEARANCE_DEFAULTS
  let raw: unknown = null
  try {
    raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null")
  } catch {
    raw = null
  }
  const saved = (raw ?? {}) as Record<string, unknown>
  return {
    theme: oneOf(saved.theme, THEME_PREFS, APPEARANCE_DEFAULTS.theme),
    accent: oneOf(saved.accent, ACCENT_PREF_IDS, APPEARANCE_DEFAULTS.accent),
    accentCustom: hexOf(saved.accentCustom, APPEARANCE_DEFAULTS.accentCustom),
    uiFont: oneOf(saved.uiFont, UI_FONT_IDS, APPEARANCE_DEFAULTS.uiFont),
    uiFontSize: sizeOf(saved.uiFontSize, FONT_SIZE_RANGES.ui, APPEARANCE_DEFAULTS.uiFontSize),
    codeFont: oneOf(saved.codeFont, CODE_FONT_IDS, APPEARANCE_DEFAULTS.codeFont),
    codeFontSize: sizeOf(saved.codeFontSize, FONT_SIZE_RANGES.code, APPEARANCE_DEFAULTS.codeFontSize),
    chatFont: oneOf(saved.chatFont, CHAT_FONT_IDS, APPEARANCE_DEFAULTS.chatFont),
    chatFontSize: sizeOf(saved.chatFontSize, FONT_SIZE_RANGES.chat, APPEARANCE_DEFAULTS.chatFontSize),
    reducedMotion: saved.reducedMotion === true,
  }
}

// ── 应用 ───────────────────────────────────────────────────────────

let current: AppearancePrefs = APPEARANCE_DEFAULTS
let snapshotInitialized = false
let systemListenerBound = false
const listeners = new Set<() => void>()

function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
  void syncSidebarWindowEffects(readStoredSidebarStyle(), resolved)
}

/** 跟随系统：系统深浅色变化时实时重解析（监听常驻，仅在 system 偏好下生效） */
function ensureSystemListener(): void {
  if (systemListenerBound || typeof window === "undefined") return
  systemListenerBound = true
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (current.theme !== "system") return
    applyResolvedTheme(resolveTheme("system"))
  })
}

export function applyAppearancePrefs(prefs: AppearancePrefs): void {
  current = prefs
  if (typeof window === "undefined") return

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))

  applyResolvedTheme(resolveTheme(prefs.theme))

  const root = document.documentElement
  root.dataset.accent = prefs.accent
  if (prefs.accent === "custom") {
    root.style.setProperty("--accent-custom", prefs.accentCustom)
  } else {
    root.style.removeProperty("--accent-custom")
  }
  const fontAttrs: Array<[name: string, value: string, isDefault: boolean]> = [
    ["uiFont", prefs.uiFont, prefs.uiFont === "default"],
    ["codeFont", prefs.codeFont, prefs.codeFont === "default"],
    ["chatFont", prefs.chatFont, prefs.chatFont === "follow"],
  ]
  for (const [name, value, isDefault] of fontAttrs) {
    if (isDefault) delete root.dataset[name]
    else root.dataset[name] = value
  }
  root.style.setProperty("--ui-size", `${prefs.uiFontSize}px`)
  root.style.setProperty("--code-size", `${prefs.codeFontSize}px`)
  root.style.setProperty("--chat-size", `${prefs.chatFontSize}px`)
  if (prefs.reducedMotion) root.dataset.reducedMotion = ""
  else delete root.dataset.reducedMotion

  ensureSystemListener()
  for (const listener of listeners) listener()
}

// ── 外部存储（useSyncExternalStore） ────────────────────────────────

/** 订阅外观偏好变化（applyAppearancePrefs 时通知） */
export function subscribeAppearance(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 客户端快照：首次读取本地持久化偏好，之后缓存 */
export function getAppearanceSnapshot(): AppearancePrefs {
  if (!snapshotInitialized) {
    current = readAppearancePrefs()
    snapshotInitialized = true
  }
  return current
}

/** 服务端快照：默认值（保持水合契约） */
export function getAppearanceServerSnapshot(): AppearancePrefs {
  return APPEARANCE_DEFAULTS
}
