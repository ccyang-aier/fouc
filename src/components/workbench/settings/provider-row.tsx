"use client"

/**
 * Agent 纳管行：目录中一个 Provider 产品的卡片 —— 状态徽章、测试连接、
 * 行内展开的纳管编辑器（安装实例管理 / 登记路径 / 能力清单 / 会话验证）。
 */

import { useState } from "react"
import {
  ArrowClockwise,
  CaretDown,
  CheckCircle,
  DownloadSimple,
  Flag,
  Info,
  Pause,
  Play,
  ShieldWarning,
  SignOut,
  SpinnerGap,
  TrashSimple,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react"

import type { AgentInstallation, CapabilityManifest, ProviderSpec } from "@fouc/shared"
import { formatRelativeTime } from "@/lib/relative-time"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { SessionConsole } from "../session-console"
import { ProviderAvatar } from "./provider-meta"

// ─── Provider 级状态 ───────────────────────────────────────────────

export type ProviderStatusKey =
  | "ready"
  | "needs_auth"
  | "needs_runtime"
  | "incompatible"
  | "unhealthy"
  | "disabled"
  | "missing"
  | "unchecked"
  | "not_installed"

const STATUS_META: Record<
  ProviderStatusKey,
  { label: string; className: string; icon: typeof CheckCircle }
> = {
  ready: { label: "可用", className: "bg-[#e8f6ef] text-[#1f8a5f] border-[#bfe5d3]", icon: CheckCircle },
  needs_auth: { label: "需要登录", className: "bg-[#fdf3e2] text-[#a06b12] border-[#f0dcae]", icon: ShieldWarning },
  needs_runtime: { label: "缺运行时", className: "bg-[#fdf3e2] text-[#a06b12] border-[#f0dcae]", icon: DownloadSimple },
  incompatible: { label: "不兼容", className: "bg-[#fdecec] text-[#b3413c] border-[#f2c7c4]", icon: XCircle },
  unhealthy: { label: "异常", className: "bg-[#fdecec] text-[#b3413c] border-[#f2c7c4]", icon: WarningCircle },
  disabled: { label: "已停用", className: "bg-[#f1f2f4] text-[#6b7280] border-[#dcdfe4]", icon: Pause },
  missing: { label: "路径丢失", className: "bg-[#f1f2f4] text-[#6b7280] border-[#dcdfe4]", icon: SignOut },
  unchecked: { label: "未检测", className: "bg-[#eef3fb] text-[#3f6db5] border-[#cddcf2]", icon: SpinnerGap },
  not_installed: { label: "未安装", className: "bg-[#fdf3f2] text-[#c05b4d] border-[#f2d3ce]", icon: DownloadSimple },
}

/** 实例展示优先级：越靠前越能代表该产品的当前状态 */
const STATUS_RANK: ProviderStatusKey[] = [
  "ready",
  "needs_auth",
  "unchecked",
  "needs_runtime",
  "unhealthy",
  "incompatible",
  "missing",
  "disabled",
]

/** 该产品最具代表性的安装实例：默认 > 状态 > 最近探测 */
export function pickBestInstallation(list: AgentInstallation[]): AgentInstallation | null {
  if (list.length === 0) return null
  return [...list].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
    const ra = STATUS_RANK.indexOf(a.status as ProviderStatusKey)
    const rb = STATUS_RANK.indexOf(b.status as ProviderStatusKey)
    if (ra !== rb) return ra - rb
    return (b.lastProbeAt ?? b.updatedAt) - (a.lastProbeAt ?? a.updatedAt)
  })[0]
}

export function ProviderStatusBadge({ statusKey }: { statusKey: ProviderStatusKey }) {
  const meta = STATUS_META[statusKey]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
        meta.className
      )}
    >
      <Icon size={11} weight="bold" aria-hidden />
      {meta.label}
    </span>
  )
}

const SOURCE_LABEL: Record<AgentInstallation["source"], string> = {
  path: "PATH 发现",
  known_location: "常见位置",
  user_added: "手工登记",
  package_manager: "包管理器",
}

// ─── 行组件 ────────────────────────────────────────────────────────

export interface ProviderRowProps {
  provider: ProviderSpec
  installations: AgentInstallation[]
  statusKey: ProviderStatusKey
  expanded: boolean
  testing: boolean
  testHint: string | null
  probingIds: ReadonlySet<string>
  registering: boolean
  onToggleExpand: () => void
  onTest: () => void
  onHealthCheck: (installationId: string) => void
  onToggleEnabled: (installation: AgentInstallation) => void
  onSetDefault: (installationId: string) => void
  onRemove: (installationId: string) => void
  onRegisterPath: (executablePath: string) => void
}

export function ProviderRow(props: ProviderRowProps) {
  const { provider, installations, statusKey, expanded, testing, testHint } = props
  const best = pickBestInstallation(installations)
  const subtitle =
    best
      ? `${best.version ? `v${best.version} · ` : ""}${best.executablePath}`
      : `命令 ${provider.cliCommand} · 安装后加入 PATH 即可自动纳管`

  return (
    <div
      id={`provider-row-${provider.id}`}
      className={cn(
        "rounded-[12px] border bg-white transition-[border-color,box-shadow] duration-150",
        expanded
          ? "border-[#d8dbe0] shadow-[0_3px_12px_rgba(23,25,27,0.06)]"
          : "border-[#eceef1] shadow-[0_1px_2px_rgba(23,25,27,0.03)] hover:border-[#dcdfe4] hover:shadow-[0_2px_6px_rgba(23,25,27,0.05)]"
      )}
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <ProviderAvatar providerId={provider.id} name={provider.name} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium">{provider.name}</span>
            <ProviderStatusBadge statusKey={statusKey} />
            {best?.isDefault && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#eef3fb] px-1.5 py-px text-[10px] font-medium text-[#3f6db5]">
                <Flag size={9} weight="fill" aria-hidden />
                默认
              </span>
            )}
          </div>
          <p
            className={cn(
              "mt-0.5 truncate text-[11px]",
              testHint ? "text-[#b3413c]" : "text-[var(--muted)]"
            )}
            title={testHint ?? (best?.executablePath ?? provider.cliCommand)}
          >
            {testHint ?? subtitle}
          </p>
        </div>

        <ProviderInfoTip provider={provider} />

        <div className="flex shrink-0 items-center gap-1.5 border-l border-[#f2f3f5] pl-3">
          <Button
            variant="outline"
            size="sm"
            onClick={props.onTest}
            disabled={testing}
            aria-label={`测试连接 ${provider.name}`}
            className="h-7 rounded-[8px] px-2.5 text-[11.5px]"
          >
            {testing ? (
              <SpinnerGap className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <ArrowClockwise className="size-3.5" aria-hidden />
            )}
            {testing ? "检测中" : "测试连接"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={props.onToggleExpand}
            aria-expanded={expanded}
            aria-label={`编辑 ${provider.name} 纳管配置`}
            className="h-7 rounded-[8px] px-2.5 text-[11.5px]"
          >
            {expanded ? "收起" : "编辑"}
            <CaretDown
              size={11}
              weight="bold"
              aria-hidden
              className={cn("transition-transform duration-150", expanded && "rotate-180")}
            />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="animate-in fade-in-0 slide-in-from-top-1 border-t border-[#f2f3f5]">
          <ExpandedPanel {...props} best={best} />
        </div>
      )}
    </div>
  )
}

// ─── 信息提示 ──────────────────────────────────────────────────────

function ProviderInfoTip({ provider }: { provider: ProviderSpec }) {
  const launch = provider.acpLaunch.kind === "bridge" ? "桥接 ACP" : "原生 ACP"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${provider.name} 接入信息`}
          className="shrink-0 rounded-md p-1 text-[#b6bcc4] outline-none transition-colors hover:bg-black/[0.045] hover:text-[var(--muted-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <Info size={13} weight="bold" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="w-56">
        <p className="font-medium">{provider.name}</p>
        <p className="mt-1 text-[#d7dce2]">命令 {provider.cliCommand}</p>
        <p>{launch} · {provider.authRequired ? "需要原生登录" : "无需登录"}</p>
        {provider.skillsDir && <p>技能目录 {provider.skillsDir}</p>}
      </TooltipContent>
    </Tooltip>
  )
}

// ─── 展开编辑器 ────────────────────────────────────────────────────

function ExpandedPanel(
  props: ProviderRowProps & { best: AgentInstallation | null }
) {
  const { provider, installations, best } = props
  const [pathInput, setPathInput] = useState("")

  function submitPath() {
    const trimmed = pathInput.trim()
    if (!trimmed) return
    props.onRegisterPath(trimmed)
    setPathInput("")
  }

  return (
    <div className="max-h-[480px] space-y-4 overflow-y-auto px-4 pb-4 pt-3.5">
      {installations.length > 0 ? (
        <section aria-label={`${provider.name} 安装实例`}>
          <SectionLabel>安装实例（{installations.length}）</SectionLabel>
          <div className="mt-1.5 space-y-1.5">
            {installations.map((installation) => (
              <InstallationCard
                key={installation.id}
                installation={installation}
                probing={props.probingIds.has(installation.id)}
                onHealthCheck={() => props.onHealthCheck(installation.id)}
                onToggleEnabled={() => props.onToggleEnabled(installation)}
                onSetDefault={() => props.onSetDefault(installation.id)}
                onRemove={() => props.onRemove(installation.id)}
              />
            ))}
          </div>
        </section>
      ) : (
        <section aria-label={`${provider.name} 发现状态`}>
          <SectionLabel>发现状态</SectionLabel>
          <p className="mt-1.5 rounded-[10px] border border-dashed border-[#dcdfe4] bg-[#fafbfa] px-3.5 py-3 text-[11.5px] leading-relaxed text-[var(--muted)]">
            尚未在本机发现 {provider.name}。安装后其命令（{provider.cliCommand}）加入 PATH
            即会在下次发现时自动登记；也可以在下方直接登记可执行文件路径。
          </p>
        </section>
      )}

      <section aria-label={`登记 ${provider.name} 路径`}>
        <SectionLabel>登记路径</SectionLabel>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            value={pathInput}
            onChange={(event) => setPathInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                submitPath()
              }
            }}
            placeholder="C:\path\to\… 或 /usr/local/bin/…"
            autoFocus={installations.length === 0}
            aria-label={`${provider.name} 可执行文件路径`}
            className="h-7.5 min-w-0 flex-1 rounded-[8px] border border-[#e3e5e8] bg-white px-2.5 py-1.5 font-mono text-[11px] outline-none placeholder:font-sans placeholder:text-[#b6bcc4] focus:border-[var(--accent)]/55 focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
          <Button
            variant="subtle"
            size="sm"
            onClick={submitPath}
            disabled={!pathInput.trim() || props.registering}
            className="h-7.5 shrink-0 rounded-[8px] px-2.5 text-[11.5px]"
          >
            {props.registering ? <SpinnerGap className="size-3.5 animate-spin" aria-hidden /> : null}
            登记并检测
          </Button>
        </div>
      </section>

      {best?.capabilityManifest && <CapabilityPanel manifest={best.capabilityManifest} />}

      {best && (best.status === "ready" || best.status === "needs_auth") && (
        <section aria-label={`${provider.name} 会话验证`}>
          <SectionLabel>会话验证</SectionLabel>
          <div className="mt-1.5 h-[380px] overflow-hidden rounded-[10px] border border-[#eceef1] bg-[#fbfbfc]">
            <SessionConsole installation={best} providerName={provider.name} />
          </div>
        </section>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10.5px] font-medium tracking-[0.02em] text-[var(--muted)]">{children}</h4>
}

// ─── 安装实例卡片 ──────────────────────────────────────────────────

function InstallationCard(props: {
  installation: AgentInstallation
  probing: boolean
  onHealthCheck: () => void
  onToggleEnabled: () => void
  onSetDefault: () => void
  onRemove: () => void
}) {
  const { installation } = props
  return (
    <div className="rounded-[10px] border border-[#f0f1f3] bg-[#fafbfa] px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <ProviderStatusBadge statusKey={installation.status as ProviderStatusKey} />
        {installation.version && (
          <span className="rounded-full border border-[#dcdfe4] bg-white px-1.5 py-px text-[10px] font-medium text-[#6b7280]">
            v{installation.version}
          </span>
        )}
        <span className="text-[10.5px] text-[var(--muted)]">{SOURCE_LABEL[installation.source]}</span>
        <span className="ml-auto shrink-0 text-[10.5px] text-[var(--muted)]">
          探测于 {formatRelativeTime(installation.lastProbeAt)}
          {installation.lastProbeDurationMs ? ` · ${installation.lastProbeDurationMs}ms` : ""}
        </span>
      </div>
      <p className="mt-1 truncate font-mono text-[10.5px] text-[#6b7280]" title={installation.executablePath}>
        {installation.executablePath}
      </p>
      {installation.lastErrorMessage && (
        <p className="mt-1 text-[10.5px] text-[#b3413c]" role="alert">
          {installation.lastErrorCode}: {installation.lastErrorMessage}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <MiniAction onClick={props.onHealthCheck} disabled={props.probing}>
          {props.probing ? <SpinnerGap className="size-3 animate-spin" aria-hidden /> : <ArrowClockwise className="size-3" aria-hidden />}
          健康检查
        </MiniAction>
        <MiniAction onClick={props.onToggleEnabled}>
          {installation.enabled ? <Pause className="size-3" aria-hidden /> : <Play className="size-3" aria-hidden />}
          {installation.enabled ? "停用" : "启用"}
        </MiniAction>
        {!installation.isDefault && (
          <MiniAction onClick={props.onSetDefault}>
            <Flag className="size-3" aria-hidden />
            设为默认
          </MiniAction>
        )}
        <MiniAction onClick={props.onRemove} danger>
          <TrashSimple className="size-3" aria-hidden />
          解除纳管
        </MiniAction>
      </div>
    </div>
  )
}

function MiniAction({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-[7px] border border-[#e3e5e8] bg-white px-2 text-[10.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-45",
        danger
          ? "text-[#b3413c] hover:border-[#f2c7c4] hover:bg-[#fdf5f4]"
          : "text-[var(--ink-soft)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)]"
      )}
    >
      {children}
    </button>
  )
}

// ─── 能力清单 ──────────────────────────────────────────────────────

function CapabilityPanel({ manifest }: { manifest: CapabilityManifest }) {
  return (
    <section aria-label="能力清单">
      <SectionLabel>能力清单 · 适配级别 {manifest.adapterLevel}</SectionLabel>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-[10px] border border-[#f0f1f3] bg-[#fafbfa] px-3.5 py-3 text-[11px] max-[900px]:grid-cols-1">
        <Capability label="协议" value={`ACP v${manifest.protocol.version}`} />
        <Capability label="Agent 身份" value={manifest.agentName ?? "—"} />
        <Capability label="会话恢复 / 分叉" value={`${manifest.session.resume ? "支持" : "不支持"} / ${manifest.session.fork ? "支持" : "不支持"}`} />
        <Capability label="图片输入" value={manifest.input.image ? "支持" : "不支持"} />
        <Capability
          label="MCP"
          value={(["stdio", "http", "sse"] as const).filter((k) => manifest.extensions.mcp[k]).join(" / ") || "未声明"}
        />
        <Capability
          label="模型 / 权限模式"
          value={`${manifest.controls.models.length} 个 / ${manifest.controls.modes.length} 个`}
        />
        {manifest.controls.modes.length > 0 && (
          <div className="col-span-full flex flex-wrap gap-1 pt-0.5">
            {manifest.controls.modes.slice(0, 8).map((mode) => (
              <span
                key={mode.id}
                className="rounded border border-[#e3e5e8] bg-white px-1.5 py-0.5 text-[10px] text-[#6b7280]"
              >
                {mode.name}
              </span>
            ))}
          </div>
        )}
      </dl>
    </section>
  )
}

function Capability({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <dt className="shrink-0 text-[var(--muted)]">{label}</dt>
      <dd className="truncate font-medium text-[#4b5563]" title={value}>
        {value}
      </dd>
    </div>
  )
}
