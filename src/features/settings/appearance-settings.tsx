"use client"

/**
 * 外观设置：主题、主题色与字体偏好。
 * 偏好经 lib/appearance 的外部存储管理（useSyncExternalStore 订阅），
 * 修改即时应用到整个工作台并持久化；首帧直接读取本地偏好，无默认值闪变。
 */

import { useCallback, useSyncExternalStore } from "react"

import {
  applyAppearancePrefs,
  getAppearanceServerSnapshot,
  getAppearanceSnapshot,
  resolveTheme,
  subscribeAppearance,
  type AppearancePrefs,
} from "@/lib/appearance"

import { FontSection } from "./appearance/font-section"
import { AccentSection } from "./appearance/accent-section"
import { ThemeSection } from "./appearance/theme-section"
import { SettingsPanel } from "./settings-panel"

export function AppearanceSettings() {
  const prefs = useSyncExternalStore(subscribeAppearance, getAppearanceSnapshot, getAppearanceServerSnapshot)

  const update = useCallback((patch: Partial<AppearancePrefs>) => {
    applyAppearancePrefs({ ...getAppearanceSnapshot(), ...patch })
  }, [])

  return (
    <SettingsPanel title="外观">
      <ThemeSection
        value={prefs.theme}
        resolved={resolveTheme(prefs.theme)}
        onChange={(theme) => update({ theme })}
      />
      <AccentSection
        value={prefs.accent}
        customColor={prefs.accentCustom}
        onChange={(accent) => update({ accent })}
        onCustomColor={(accentCustom) => update({ accent: "custom", accentCustom })}
      />
      <FontSection prefs={prefs} onChange={update} />
    </SettingsPanel>
  )
}
