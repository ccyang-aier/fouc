"use client"

/**
 * 关于：品牌、版本与产品定位 —— 静态事实信息。
 */

import Image from "next/image"

import { PanelHeader } from "./general-settings"

export const FOUC_VERSION = "0.1.0"

export function AboutSettings() {
  return (
    <div className="mx-auto w-full max-w-[760px] px-8 py-7 max-[1100px]:px-6">
      <PanelHeader title="关于" description="Fouc 智能工作台的产品信息。" />

      <section className="mt-5 rounded-[12px] border border-[#eceef1] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(23,25,27,0.04)]">
        <div className="flex items-center gap-4">
          <span className="relative size-12 shrink-0 overflow-hidden rounded-[12px]">
            <Image
              src="/brand/fouc-mark.png"
              alt="Fouc 标识"
              fill
              sizes="48px"
              draggable={false}
              className="scale-[1.5] object-contain"
            />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">Fouc 智能工作台</h3>
            <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">版本 {FOUC_VERSION} · 客户端与 Web 双端</p>
          </div>
        </div>
        <p className="mt-5 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
          Fouc 是构建于 AI Agent 之上的超级工作台，面向个人与企业团队。以人与 Agent
          的高效协作为核心，帮助你在同一条工作流中敏捷完成开发、研究、分析与日常办公任务。
        </p>
        <div className="mt-5 border-t border-[#f2f3f5] pt-4 text-[11.5px] leading-relaxed text-[var(--muted)]">
          Agent 接入基于 Agent Client Protocol（ACP）：已内置 33 种 CLI Agent
          的目录声明，安装即可自动发现、探测与纳管，无需任何手工配置。
        </div>
      </section>
    </div>
  )
}
