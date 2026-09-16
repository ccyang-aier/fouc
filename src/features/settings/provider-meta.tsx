"use client"

/**
 * Provider 视觉元数据：品牌 logo 头像（目录映射）+ 未收录产品的字标回退。
 * Logo 资产来自 AionCore（Apache-2.0），整库存放于 public/agent-logos。
 * 单色 SVG（currentColor / 纯黑）经 alpha mask 以 currentColor 渲染、跟随主题
 * （AionUi ThemedLogo 同款方案）；彩色 SVG 与 PNG 原样呈现。
 */

import Image from "next/image"

import { cn } from "@/lib/utils"

interface ProviderVisual {
  monogram: string
  fg: string
}

const PROVIDER_VISUALS: Record<string, ProviderVisual> = {
  "claude-code": { monogram: "CC", fg: "#c15f3c" },
  codex: { monogram: "CX", fg: "#3d3f45" },
  gemini: { monogram: "GM", fg: "#3d7de0" },
  opencode: { monogram: "OC", fg: "#4b5563" },
  qwen: { monogram: "QW", fg: "#7a4fd3" },
  codebuddy: { monogram: "CB", fg: "#2f74d0" },
  goose: { monogram: "GO", fg: "#2b9a63" },
  auggie: { monogram: "AU", fg: "#d06a2c" },
  kimi: { monogram: "KM", fg: "#5a5ad1" },
  droid: { monogram: "DR", fg: "#55606c" },
  copilot: { monogram: "CP", fg: "#33363c" },
  cursor: { monogram: "CU", fg: "#3a4149" },
  kiro: { monogram: "KI", fg: "#c04a58" },
  qoder: { monogram: "QD", fg: "#3d9270" },
  vibe: { monogram: "VB", fg: "#c2506e" },
  hermes: { monogram: "HE", fg: "#6455c8" },
  snow: { monogram: "SN", fg: "#4a86c8" },
  amp: { monogram: "AM", fg: "#2f3237" },
  "cortex-code": { monogram: "CT", fg: "#40689e" },
  "corust-agent": { monogram: "CR", fg: "#b96a28" },
  devin: { monogram: "DV", fg: "#41474f" },
  harn: { monogram: "HA", fg: "#388571" },
  junie: { monogram: "JU", fg: "#8657c9" },
  poolside: { monogram: "PL", fg: "#3d84ad" },
  stakpak: { monogram: "SK", fg: "#6b7a3a" },
  vtcode: { monogram: "VT", fg: "#2f8f85" },
  antigravity: { monogram: "AG", fg: "#5566d6" },
  omp: { monogram: "OM", fg: "#a05a76" },
  "mimo-code": { monogram: "MI", fg: "#4478c4" },
  kilo: { monogram: "KL", fg: "#8a7a3d" },
  nova: { monogram: "NO", fg: "#b0813c" },
  dirac: { monogram: "DI", fg: "#4d6f8f" },
  grok: { monogram: "GK", fg: "#2f3237" },
}

/** provider id → public/agent-logos 下的 logo 路径（未收录者走字标回退） */
/** provider id → logo（src 为 public/agent-logos 下路径；mono 单色标经 mask 跟随主题文字色） */
const PROVIDER_LOGOS: Record<string, { src: string; mono?: boolean }> = {
  "claude-code": { src: "ai-major/claude.svg" },
  codex: { src: "tools/coding/codex.svg" },
  gemini: { src: "ai-major/gemini.svg" },
  opencode: { src: "tools/coding/opencode.svg" },
  qwen: { src: "ai-china/qwen.svg" },
  codebuddy: { src: "tools/coding/codebuddy.svg" },
  goose: { src: "tools/goose.svg", mono: true },
  auggie: { src: "brand/auggie.svg", mono: true },
  kimi: { src: "ai-china/kimi.svg" },
  droid: { src: "brand/droid.svg" },
  cursor: { src: "tools/coding/cursor.png" },
  qoder: { src: "tools/coding/qoder.png" },
  hermes: { src: "brand/hermes.svg" },
  snow: { src: "tools/coding/snow.png" },
  amp: { src: "acp-registry/amp-acp.svg", mono: true },
  "cortex-code": { src: "acp-registry/cortex-code.svg", mono: true },
  "corust-agent": { src: "acp-registry/corust-agent.svg", mono: true },
  devin: { src: "acp-registry/devin.svg", mono: true },
  harn: { src: "acp-registry/harn.svg", mono: true },
  junie: { src: "acp-registry/junie.svg", mono: true },
  poolside: { src: "acp-registry/poolside.svg", mono: true },
  stakpak: { src: "acp-registry/stakpak.svg", mono: true },
  vtcode: { src: "acp-registry/vtcode.svg", mono: true },
  antigravity: { src: "ai-major/antigravity.svg", mono: true },
  omp: { src: "acp-registry/omp.svg", mono: true },
  "mimo-code": { src: "acp-registry/mimo-code.svg", mono: true },
  kilo: { src: "acp-registry/kilo.svg", mono: true },
  nova: { src: "acp-registry/nova.svg", mono: true },
  dirac: { src: "acp-registry/dirac.svg", mono: true },
  grok: { src: "acp-registry/grok.svg", mono: true },
}

const FALLBACK_VISUAL: ProviderVisual = { monogram: "AG", fg: "#4b5563" }

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
  const logo = PROVIDER_LOGOS[providerId]
  const url = logo ? `/agent-logos/${logo.src}` : null

  // 单色标：以 alpha mask 落在 currentColor 上，跟随主题文字色（AionUi ThemedLogo 同款方案）
  if (logo?.mono && url) {
    return (
      <span
        aria-hidden
        className={cn("shrink-0 select-none text-[var(--ink-soft)]", className ?? "size-9")}
        style={{
          backgroundColor: "currentColor",
          WebkitMaskImage: `url("${url}")`,
          maskImage: `url("${url}")`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
    )
  }

  const visual = providerVisual(providerId, name)
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 select-none items-center justify-center text-[12px]",
        className ?? "size-9",
      )}
    >
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          sizes="36px"
          draggable={false}
          className="object-contain"
        />
      ) : (
        <span className="text-[1em] font-semibold tracking-[0.01em]" style={{ color: visual.fg }}>
          {visual.monogram}
        </span>
      )}
    </span>
  )
}
