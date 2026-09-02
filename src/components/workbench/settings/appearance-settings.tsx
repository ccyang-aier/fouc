"use client"

/**
 * 外观设置：主题、字体、侧边栏材质与动效偏好。
 * 偏好经 lib/appearance 的外部存储管理（useSyncExternalStore 订阅），
 * 修改即时应用到整个工作台并持久化；首帧直接读取本地偏好，无默认值闪变。
 */

import { useCallback, useState, useSyncExternalStore } from "react"

import {
  APPEARANCE_DEFAULTS,
  applyAppearancePrefs,
  getAppearanceServerSnapshot,
  getAppearanceSnapshot,
  resolveTheme,
  subscribeAppearance,
  type AppearancePrefs,
} from "@/lib/appearance"
import { applySidebarStyle, readStoredSidebarStyle, type SidebarStyle } from "@/lib/sidebar-style"

import { FontSection } from "./appearance/font-section"
import { AccentSection } from "./appearance/accent-section"
import { MaterialSection } from "./appearance/material-section"
import { MiscSection } from "./appearance/misc-section"
import { ThemeSection } from "./appearance/theme-section"
import { PanelHeader } from "./general-settings"

export function AppearanceSettings() {
  const prefs = useSyncExternalStore(subscribeAppearance, getAppearanceSnapshot, getAppearanceServerSnapshot)
  const [sidebarStyle, setSidebarStyle] = useState<SidebarStyle>(() => readStoredSidebarStyle())

  const update = useCallback((patch: Partial<AppearancePrefs>) => {
    applyAppearancePrefs({ ...getAppearanceSnapshot(), ...patch })
  }, [])

  const changeSidebarStyle = useCallback((style: SidebarStyle) => {
    setSidebarStyle(style)
    applySidebarStyle(style)
  }, [])

  const resetAll = useCallback(() => {
    applyAppearancePrefs(APPEARANCE_DEFAULTS)
    applySidebarStyle("frosted")
    setSidebarStyle("frosted")
  }, [])

  return (
    <div className="mx-auto w-full max-w-[960px] px-10 pb-14 pt-12 max-[1100px]:px-7 max-[900px]:pt-8">
      <PanelHeader title="外观" description="主题、字体与材质 —— 所有修改即时作用于整个工作台。" />
      <ThemeSection
        value={prefs.theme}
        resolved={resolveTheme(prefs.theme)}
        onChange={(theme) => update({ theme })}
      />
      <AccentSection value={prefs.accent} onChange={(accent) => update({ accent })} />
      <FontSection prefs={prefs} onChange={update} />
      <MaterialSection value={sidebarStyle} onChange={changeSidebarStyle} />
      <MiscSection
        reducedMotion={prefs.reducedMotion}
        onReducedMotionChange={(reducedMotion) => update({ reducedMotion })}
        onReset={resetAll}
      />
    </div>
  )
}
