"use client"

import { useEffect } from "react"
import { CheckCircle, Info, WarningCircle, X, XCircle } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

export type AppAlertTone = "success" | "info" | "warning" | "error"

export interface AppAlertMessage {
  id: number
  tone: AppAlertTone
  title: string
  description?: string
}

interface AppAlertProps {
  alert: AppAlertMessage | null
  onClose: () => void
  duration?: number
}

const toneStyles: Record<AppAlertTone, { icon: string; iconSurface: string }> = {
  success: {
    icon: "text-[var(--ok-ink)]",
    iconSurface: "bg-[color-mix(in_srgb,var(--ok-ink)_10%,var(--panel))]",
  },
  info: {
    icon: "text-[var(--accent-ink)]",
    iconSurface: "bg-[var(--accent-soft)]",
  },
  warning: {
    icon: "text-[var(--warn-ink)]",
    iconSurface: "bg-[color-mix(in_srgb,var(--warn-ink)_10%,var(--panel))]",
  },
  error: {
    icon: "text-[var(--err-ink)]",
    iconSurface: "bg-[color-mix(in_srgb,var(--err-ink)_10%,var(--panel))]",
  },
}

export function AppAlert({ alert, onClose, duration = 5_000 }: AppAlertProps) {
  useEffect(() => {
    if (!alert || duration <= 0) return
    const timer = window.setTimeout(onClose, duration)
    return () => window.clearTimeout(timer)
  }, [alert, duration, onClose])

  if (!alert) return null

  const style = toneStyles[alert.tone]
  const Icon = alert.tone === "success"
    ? CheckCircle
    : alert.tone === "warning"
      ? WarningCircle
      : alert.tone === "error"
        ? XCircle
        : Info

  return (
    <div
      role={alert.tone === "error" ? "alert" : "status"}
      aria-live={alert.tone === "error" ? "assertive" : "polite"}
      className="fixed right-5 top-14 z-[100] flex w-[328px] items-start gap-3 rounded-[10px] border border-[var(--line-strong)] bg-[var(--elevated)] p-3.5 pr-10 text-left shadow-[0_14px_40px_rgba(24,30,42,0.18)]"
    >
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[8px]", style.iconSurface)}>
        <Icon className={cn("size-[17px]", style.icon)} weight="fill" aria-hidden />
      </span>
      <span className="min-w-0 pt-0.5">
        <strong className="block text-[11px] font-semibold leading-4 text-[var(--ink)]">{alert.title}</strong>
        {alert.description ? <span className="mt-0.5 block text-[9.5px] leading-4 text-[var(--muted-strong)]">{alert.description}</span> : null}
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭通知"
        className="absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-[6px] text-[var(--muted)] outline-none transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <X className="size-3.5" weight="bold" aria-hidden />
      </button>
    </div>
  )
}
