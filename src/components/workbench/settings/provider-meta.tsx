"use client"

/**
 * Provider 视觉元数据：品牌 logo 头像（目录映射）+ 未收录产品的字标回退。
 * Logo 资产来自 AionCore（Apache-2.0），整库存放于 public/agent-logos；
 * 多数 logo 为深色透明底，故统一衬在品牌印象色的浅彩底片上，深浅主题皆可读。
 */

import Image from "next/image"

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

/** provider id → public/agent-logos 下的 logo 路径（未收录者走字标回退） */
const PROVIDER_LOGOS: Record<string, string> = {
  "claude-code": "ai-major/claude.svg",
  codex: "tools/coding/codex.svg",
  gemini: "ai-major/gemini.svg",
  opencode: "tools/coding/opencode.svg",
  qwen: "ai-china/qwen.svg",
  codebuddy: "tools/coding/codebuddy.svg",
  goose: "tools/goose.svg",
  auggie: "brand/auggie.svg",
  kimi: "ai-china/kimi.svg",
  droid: "brand/droid.svg",
  cursor: "tools/coding/cursor.png",
  qoder: "tools/coding/qoder.png",
  hermes: "brand/hermes.svg",
  snow: "tools/coding/snow.png",
  amp: "acp-registry/amp-acp.svg",
  "cortex-code": "acp-registry/cortex-code.svg",
  "corust-agent": "acp-registry/corust-agent.svg",
  devin: "acp-registry/devin.svg",
  harn: "acp-registry/harn.svg",
  junie: "acp-registry/junie.svg",
  poolside: "acp-registry/poolside.svg",
  stakpak: "acp-registry/stakpak.svg",
  vtcode: "acp-registry/vtcode.svg",
  antigravity: "ai-major/antigravity.svg",
  omp: "acp-registry/omp.svg",
  "mimo-code": "acp-registry/mimo-code.svg",
  kilo: "acp-registry/kilo.svg",
  nova: "acp-registry/nova.svg",
  dirac: "acp-registry/dirac.svg",
  grok: "acp-registry/grok.svg",
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
  const logo = PROVIDER_LOGOS[providerId]
  return (
    <span
      aria-hidden
      style={{ backgroundColor: visual.bg, color: visual.fg }}
      className={cn(
        "relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-[10px] text-[12px]",
        className ?? "size-9",
      )}
    >
      {logo ? (
        <Image
          src={`/agent-logos/${logo}`}
          alt=""
          fill
          sizes="36px"
          draggable={false}
          className="object-contain p-[14%]"
        />
      ) : (
        <span className="text-[1em] font-semibold tracking-[0.01em]">{visual.monogram}</span>
      )}
    </span>
  )
}
