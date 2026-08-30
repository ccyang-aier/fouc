"use client"

/**
 * 会话控制台：针对单个 AgentInstallation 的端到端运行面 ——
 * 创建受管会话、下发任务、实时事件流、审批卡片、取消与终止。
 */

import { useEffect, useRef, useState } from "react"
import { Check, PaperPlaneTilt, ShieldCheck, StopCircle, X } from "@phosphor-icons/react"

import type { AgentEvent, AgentInstallation } from "@fouc/shared"
import { backendFetch, subscribeBackendEvents } from "@/lib/backend"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ConsoleItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "agent"; id: string; msgId: string; text: string }
  | { kind: "thought"; id: string; text: string }
  | { kind: "tool"; id: string; title: string; status: string }
  | { kind: "plan"; id: string; entries: Array<{ content: string; status: string }> }
  | { kind: "system"; id: string; text: string; tone: "ok" | "err" | "info" }
  | { kind: "approval"; id: string; callId: string; title: string; options: Array<{ optionId: string; label: string; kind: string }> }

export function SessionConsole({ installation, providerName }: { installation: AgentInstallation; providerName: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState<string>("idle")
  const [items, setItems] = useState<ConsoleItem[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<HTMLDivElement>(null)

  const ready = installation.status === "ready" || installation.status === "needs_auth"

  // 重置（切换 Agent 或会话结束）
  useEffect(() => {
    setSessionId(null)
    setSessionStatus("idle")
    setItems([])
    setError(null)
  }, [installation.id])

  // 事件流订阅
  useEffect(() => {
    if (!sessionId) return
    const close = subscribeBackendEvents((envelope) => {
      if (envelope.topic !== `runs.event.${sessionId}`) return
      const event = envelope.payload as AgentEvent
      applyEvent(setItems, event)
      if (event.type === "session.status") setSessionStatus(event.status)
    })
    return close
  }, [sessionId])

  useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight })
  }, [items])

  async function createSession() {
    setBusy(true)
    setError(null)
    try {
      const session = await backendFetch<{ id: string }>(`/api/sessions`, {
        method: "POST",
        body: JSON.stringify({ installationId: installation.id, workDir: `${installation.id}-sandbox` }),
      })
      setSessionId(session.id)
      setSessionStatus("starting")
      setItems([{ kind: "system", id: "started", text: `已创建受管会话，正在拉起 ${providerName}…`, tone: "info" }])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || !sessionId) return
    setInput("")
    setItems((prev) => [...prev, { kind: "user", id: crypto.randomUUID(), text }])
    setBusy(true)
    try {
      await backendFetch(`/api/sessions/${sessionId}/runs`, {
        method: "POST",
        body: JSON.stringify({ input: text }),
      })
    } catch (e) {
      setItems((prev) => [...prev, { kind: "system", id: crypto.randomUUID(), text: `下发失败：${String(e)}`, tone: "err" }])
    } finally {
      setBusy(false)
    }
  }

  async function cancelRun() {
    if (!sessionId) return
    await backendFetch(`/api/sessions/${sessionId}/cancel`, { method: "POST" }).catch(() => {})
  }

  async function terminate() {
    if (!sessionId) return
    await backendFetch(`/api/sessions/${sessionId}`, { method: "DELETE" }).catch(() => {})
    setItems((prev) => [...prev, { kind: "system", id: crypto.randomUUID(), text: "会话已终止", tone: "info" }])
    setSessionId(null)
    setSessionStatus("idle")
  }

  async function resolveApproval(callId: string, optionId: string) {
    if (!sessionId) return
    setItems((prev) => prev.filter((x) => !(x.kind === "approval" && x.callId === callId)))
    setItems((prev) => [...prev, { kind: "system", id: crypto.randomUUID(), text: `审批：${optionId}`, tone: "info" }])
    await backendFetch(`/api/sessions/${sessionId}/approvals`, {
      method: "POST",
      body: JSON.stringify({ callId, optionId }),
    }).catch(() => {})
  }

  const canSend = sessionId && ["active", "prompting", "suspended"].includes(sessionStatus) && !busy

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-[#eceef1] px-6 py-4">
        <h2 className="text-[14px] font-semibold">会话控制台 · {providerName}</h2>
        <p className="mt-0.5 text-[11.5px] text-[#8a919b]">
          {sessionId
            ? `会话 ${sessionId.slice(0, 8)} · 状态 ${sessionStatus}`
            : ready
              ? "创建受管会话以验证端到端执行能力"
              : "该 Agent 当前不可用（完成健康检查并确保就绪后再试）"}
        </p>
      </header>

      {!sessionId ? (
        <div className="flex flex-1 items-center justify-center px-8">
          <Button onClick={() => void createSession()} disabled={!ready || busy}>
            <Play_ className="size-3.5" aria-hidden />
            创建会话
          </Button>
        </div>
      ) : (
        <>
          <div ref={streamRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-6 py-4" aria-live="polite">
            {items.map((item) => (
              <ConsoleItemView key={item.id} item={item} onApprove={resolveApproval} />
            ))}
          </div>
          <div className="border-t border-[#eceef1] px-6 py-3">
            {error && (
              <p className="mb-2 text-[11.5px] text-[#b3413c]" role="alert">
                {error}
              </p>
            )}
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
                placeholder={canSend ? "输入任务，Enter 发送…" : "等待会话就绪…"}
                disabled={!canSend}
                aria-label="任务输入"
                className="min-w-0 flex-1 rounded-lg border border-[#dcdfe4] bg-white px-3 py-2 text-[13px] outline-none placeholder:text-[#b6bcc4] focus:border-[#9b80dc]/60 disabled:cursor-not-allowed disabled:bg-[#f7f8f9]"
              />
              <Button size="sm" onClick={() => void send()} disabled={!canSend} aria-label="发送任务">
                <PaperPlaneTilt className="size-3.5" aria-hidden />
              </Button>
              <Button size="sm" variant="outline" onClick={() => void cancelRun()} aria-label="取消当前任务">
                <StopCircle className="size-3.5" aria-hidden />
              </Button>
              <Button size="sm" variant="outline" onClick={() => void terminate()} aria-label="终止会话">
                <X className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Play_(props: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={props.className} aria-hidden>
      <path d="M4.5 2.8v10.4c0 .6.7 1 1.2.7l8.2-5.2c.5-.3.5-1 0-1.3L5.7 2.1c-.5-.3-1.2.1-1.2.7z" />
    </svg>
  )
}

// ─── 事件 → 控制台条目 ─────────────────────────────────────────────

function applyEvent(setItems: (fn: (prev: ConsoleItem[]) => ConsoleItem[]) => void, event: AgentEvent) {
  switch (event.type) {
    case "message.delta":
      setItems((prev) => {
        const last = prev[prev.length - 1]
        if (last?.kind === "agent" && last.msgId === event.msgId) {
          return [...prev.slice(0, -1), { ...last, text: last.text + event.text }]
        }
        return [...prev, { kind: "agent", id: crypto.randomUUID(), msgId: event.msgId, text: event.text }]
      })
      break
    case "thought.delta":
      setItems((prev) => {
        const last = prev[prev.length - 1]
        if (last?.kind === "thought") {
          return [...prev.slice(0, -1), { ...last, text: last.text + event.text }]
        }
        return [...prev, { kind: "thought", id: crypto.randomUUID(), text: event.text }]
      })
      break
    case "tool.started":
      setItems((prev) => [...prev, { kind: "tool", id: event.toolCallId, title: event.title, status: "pending" }])
      break
    case "tool.updated":
      setItems((prev) =>
        prev.map((item) =>
          item.kind === "tool" && item.id === event.toolCallId ? { ...item, title: event.title, status: event.status } : item
        )
      )
      break
    case "plan.updated":
      setItems((prev) => [...prev.filter((x) => x.kind !== "plan"), { kind: "plan", id: "plan", entries: event.entries }])
      break
    case "run.started":
      setItems((prev) => [...prev, { kind: "system", id: crypto.randomUUID(), text: "任务开始", tone: "info" }])
      break
    case "run.completed":
      setItems((prev) => [
        ...prev,
        {
          kind: "system",
          id: crypto.randomUUID(),
          text: `任务完成${event.stopReason ? `（${event.stopReason}）` : ""}${event.usage?.totalTokens ? ` · ${event.usage.totalTokens} tokens` : ""}`,
          tone: "ok",
        },
      ])
      break
    case "run.failed":
      setItems((prev) => [...prev, { kind: "system", id: crypto.randomUUID(), text: `任务失败：${event.message}`, tone: "err" }])
      break
    case "run.cancelled":
      setItems((prev) => [...prev, { kind: "system", id: crypto.randomUUID(), text: "任务已取消", tone: "info" }])
      break
    case "approval.required":
      setItems((prev) => [
        ...prev,
        {
          kind: "approval",
          id: event.approval.callId,
          callId: event.approval.callId,
          title: event.approval.title,
          options: event.approval.options,
        },
      ])
      break
    case "auth.required":
      setItems((prev) => [
        ...prev,
        { kind: "system", id: crypto.randomUUID(), text: "Agent 需要认证 —— 请在其原生流程完成登录后重试", tone: "err" },
      ])
      break
    default:
      break
  }
}

// ─── 条目渲染 ──────────────────────────────────────────────────────

function ConsoleItemView(props: { item: ConsoleItem; onApprove: (callId: string, optionId: string) => void }) {
  const { item } = props
  switch (item.kind) {
    case "user":
      return (
        <div className="ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-[#6c5bb3] px-3.5 py-2 text-[13px] text-white">
          {item.text}
        </div>
      )
    case "agent":
      return (
        <div className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-bl-sm bg-white px-3.5 py-2 text-[13px] text-[#2a2f36] shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
          {item.text}
        </div>
      )
    case "thought":
      return (
        <div className="max-w-[85%] rounded-lg border border-dashed border-[#dcdfe4] px-3 py-1.5 text-[11.5px] italic text-[#8a919b]">
          {item.text}
        </div>
      )
    case "tool":
      return (
        <div className="flex items-center gap-2 text-[11.5px] text-[#4b5563]">
          <span
            className={cn(
              "size-1.5 rounded-full",
              item.status === "completed" ? "bg-[#1f8a5f]" : item.status === "failed" ? "bg-[#b3413c]" : "bg-[#e6a64f] animate-pulse"
            )}
          />
          <span className="font-medium">工具</span>
          <span className="truncate">{item.title}</span>
          <span className="text-[#a2a9b3]">{item.status}</span>
        </div>
      )
    case "plan":
      return (
        <ol className="max-w-[85%] space-y-1 rounded-lg border border-[#eceef1] bg-white px-3 py-2 text-[11.5px]">
          {item.entries.map((entry, index) => (
            <li key={index} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  entry.status === "completed" ? "bg-[#1f8a5f]" : entry.status === "in_progress" ? "bg-[#e6a64f]" : "bg-[#c4cad2]"
                )}
              />
              <span className={cn(entry.status === "completed" && "text-[#8a919b] line-through")}>{entry.content}</span>
            </li>
          ))}
        </ol>
      )
    case "system":
      return (
        <p
          className={cn(
            "text-center text-[11px]",
            item.tone === "ok" ? "text-[#1f8a5f]" : item.tone === "err" ? "text-[#b3413c]" : "text-[#8a919b]"
          )}
        >
          {item.text}
        </p>
      )
    case "approval":
      return (
        <div className="max-w-[85%] rounded-xl border border-[#f0dcae] bg-[#fdf8ee] px-3.5 py-2.5">
          <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#7a5b16]">
            <ShieldCheck className="size-4" aria-hidden />
            审批请求：{item.title}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.options.map((option) => (
              <Button
                key={option.optionId}
                size="sm"
                variant={option.kind.startsWith("allow") ? "default" : "outline"}
                onClick={() => props.onApprove(item.callId, option.optionId)}
              >
                {option.kind.startsWith("allow") ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      )
  }
}

