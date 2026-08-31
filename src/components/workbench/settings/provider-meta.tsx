"use client"

/**
 * Provider 视觉元数据：单色字标头像 + 目录之外不承载行为的展示信息。
 * 色板为品牌印象色（浅底 + 深字），与工作台整体淡彩风格一致。
 */

import { cn } from "@/lib/utils"

interface ProviderVisual {
  monogram: string
  bg: string
  fg: string
}

const PROVIDER_VISUALS: Record<string, ProviderVisual> = {
  "claude-code": { monogram: "CC", bg: "#f7ebe3", fg: "#c15f3c" },
  codex: { monogram: "CX", bg: "#ececee", fg: "#3d3f45" },
  gemini: { monogram: "GM", bg: "#e7f0fd", fg: "#3d7de0" },
  opencode: { monogram: "OC", bg: "#eef2f6", fg: "#4b5563" },
  qwen: { monogram: "QW", bg: "#f0e9fb", fg: "#7a4fd3" },
  codebuddy: { monogram: "CB", bg: "#e6f1fd", fg: "#2f74d0" },
  goose: { monogram: "GO", bg: "#e6f5ec", fg: "#2b9a63" },
  auggie: { monogram: "AU", bg: "#fdeee6", fg: "#d06a2c" },
  kimi: { monogram: "KM", bg: "#eaeaf6", fg: "#5a5ad1" },
  droid: { monogram: "DR", bg: "#edf1f4", fg: "#55606c" },
  copilot: { monogram: "CP", bg: "#ececee", fg: "#33363c" },
  cursor: { monogram: "CU", bg: "#ebeef2", fg: "#3a4149" },
  kiro: { monogram: "KI", bg: "#fdeaec", fg: "#c04a58" },
  qoder: { monogram: "QD", bg: "#e9f4ef", fg: "#3d9270" },
  vibe: { monogram: "VB", bg: "#fcedf1", fg: "#c2506e" },
  hermes: { monogram: "HE", bg: "#ece9f8", fg: "#6455c8" },
  snow: { monogram: "SN", bg: "#e8f2fa", fg: "#4a86c8" },
  amp: { monogram: "AM", bg: "#ececee", fg: "#2f3237" },
  "cortex-code": { monogram: "CT", bg: "#e9f0fa", fg: "#40689e" },
  "corust-agent": { monogram: "CR", bg: "#fcefe7", fg: "#b96a28" },
  devin: { monogram: "DV", bg: "#eef1f4", fg: "#41474f" },
  harn: { monogram: "HA", bg: "#e9f3f0", fg: "#388571" },
  junie: { monogram: "JU", bg: "#f4eafa", fg: "#8657c9" },
  poolside: { monogram: "PL", bg: "#e6f2f8", fg: "#3d84ad" },
  stakpak: { monogram: "SK", bg: "#eff0e9", fg: "#6b7a3a" },
  vtcode: { monogram: "VT", bg: "#e8f4f2", fg: "#2f8f85" },
  antigravity: { monogram: "AG", bg: "#e9edfc", fg: "#5566d6" },
  omp: { monogram: "OM", bg: "#f2eaee", fg: "#a05a76" },
  "mimo-code": { monogram: "MI", bg: "#e8f1fb", fg: "#4478c4" },
  kilo: { monogram: "KL", bg: "#f0eee6", fg: "#8a7a3d" },
  nova: { monogram: "NO", bg: "#f4eee6", fg: "#b0813c" },
  dirac: { monogram: "DI", bg: "#e9f0f6", fg: "#4d6f8f" },
  grok: { monogram: "GK", bg: "#ebecee", fg: "#2f3237" },
}

const FALLBACK_VISUAL: ProviderVisual = { monogram: "AG", bg: "#eef2f6", fg: "#4b5563" }

export function providerVisual(providerId: string, name: string): ProviderVisual {
  const known = PROVIDER_VISUALS[providerId]
  if (known) return known
  const letters = name.replace(/[^a-zA-Z]/g, "")
  return { ...FALLBACK_VISUAL, monogram: letters.slice(0, 2).toUpperCase() || "AG" }
}

export function ProviderAvatar({
  providerId,
  name,
  className,
}: {
  providerId: string
  name: string
  className?: string
}) {
  const visual = providerVisual(providerId, name)
  return (
    <span
      aria-hidden
      style={{ backgroundColor: visual.bg, color: visual.fg }}
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-[10px] text-[12px] font-semibold tracking-[0.01em]",
        className ?? "size-9"
      )}
    >
      {visual.monogram}
    </span>
  )
}
