"use client"

import { useRef, useState } from "react"
import {
  Briefcase,
  CaretDown,
  CaretRight,
  ChartPieSlice,
  CheckCircle,
  CircleNotch,
  Code,
  Database,
  FileText,
  MagicWand,
  MagnifyingGlass,
  Microphone,
  PaperPlaneTilt,
  Paperclip,
  PresentationChart,
  ShieldCheck,
  Stack,
  UserCircle,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

const modes = [
  { label: "日常办公", icon: Briefcase, color: "text-[#55b29d]" },
  { label: "开发交付", icon: Code, color: "text-[#6f9fe5]" },
  { label: "研究分析", icon: MagnifyingGlass, color: "text-[#9a7fdc]" },
]

const suggestions = [
  { label: "梳理需求", prompt: "帮我梳理新版本需求并输出可执行任务清单", icon: FileText, color: "text-[#5bb49e]" },
  { label: "实现功能", prompt: "为当前项目实现一个功能，并在完成后验证构建", icon: Code, color: "text-[#719fe3]" },
  { label: "分析数据", prompt: "分析我提供的数据，找出关键趋势与异常", icon: ChartPieSlice, color: "text-[#9a7fdc]" },
  { label: "准备汇报", prompt: "整理本周进展，生成一份清晰的团队工作汇报", icon: PresentationChart, color: "text-[#e3a352]" },
]

const agents = [
  { name: "Nova", color: "bg-[#dff5ee] text-[#0ba17f]" },
  { name: "Codey", color: "bg-[#e8f0ff] text-[#3579e7]" },
  { name: "Sage", color: "bg-[#efe9ff] text-[#7856e5]" },
]

export function HomeCanvas() {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState("日常办公")
  const [prompt, setPrompt] = useState("")
  const [permission, setPermission] = useState("默认权限")
  const [model, setModel] = useState("Auto")
  const [isListening, setIsListening] = useState(false)
  const [attachments, setAttachments] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  function chooseSuggestion(nextPrompt: string) {
    setPrompt(nextPrompt)
    setFeedback(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function submitMission() {
    if (!prompt.trim()) {
      inputRef.current?.focus()
      setFeedback("先描述一个想要达成的结果")
      return
    }

    setIsSending(true)
    setFeedback(null)
    window.setTimeout(() => {
      setIsSending(false)
      setFeedback("任务已创建，Nova 正在组织工作上下文")
      setPrompt("")
    }, 760)
  }

  return (
    <ScrollArea
      as="section"
      aria-label="Fouc 首页"
      className="relative h-full min-h-0"
      viewportClassName="flex flex-col items-center bg-panel px-7 pt-[106px] max-[1180px]:pt-16 max-[760px]:px-4 max-[760px]:pt-12"
    >
      <div className="w-full max-w-[740px] -translate-x-2 text-center max-[1180px]:translate-x-0">
        <h1 className="text-[25px] leading-tight font-semibold tracking-[-0.035em] text-[var(--ink)] max-[760px]:text-[23px]">
          今天想推进什么？
        </h1>
        <p className="mt-2 text-[11px] tracking-[-0.01em] text-[var(--muted)]">
          从目标开始，与 Agent 在同一条工作流中协作。
        </p>

        <div
          role="tablist"
          aria-label="工作模式"
          className="mx-auto mt-7 grid w-full max-w-[430px] grid-cols-3 gap-2"
        >
          {modes.map(({ label, icon: Icon, color }) => {
            const selected = mode === label
            return (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setMode(label)}
                className={cn(
                  "flex h-8 items-center justify-center gap-1.5 rounded-[8px] border text-[11px] font-medium outline-none transition-[background-color,border-color,color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:translate-y-px",
                  selected
                    ? "border-accent-soft-line bg-accent-soft text-accent-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                    : "border-[var(--line)] bg-panel text-[var(--ink-soft)] hover:border-[var(--line-strong)] hover:bg-surface-hover",
                )}
              >
                <Icon className={cn("size-[15px]", color)} weight="fill" />
                {label}
              </button>
            )
          })}
        </div>

        <div className="mx-auto mt-7 grid w-full max-w-[590px] grid-cols-4 gap-2.5 max-[760px]:grid-cols-2 max-[760px]:gap-2">
          {suggestions.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => chooseSuggestion(item.prompt)}
              className="group flex h-[42px] items-center justify-center gap-2 rounded-[8px] border border-[var(--line)] bg-panel px-2 text-[11px] font-medium text-[var(--ink-soft)] outline-none transition-[border-color,background-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:bg-surface-hover hover:shadow-[0_8px_22px_rgba(30,36,42,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <item.icon className={cn("size-[17px] shrink-0", item.color)} weight="fill" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div
          className={cn(
            "relative mt-7 flex h-[140px] flex-col rounded-[13px] border bg-panel text-left shadow-[0_10px_28px_rgba(28,36,42,0.035)] transition-[border-color,box-shadow] focus-within:border-[var(--accent)]",
            feedback?.startsWith("先") ? "border-[#efad9f]" : "border-[var(--line-strong)]",
          )}
        >
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value)
              if (feedback) setFeedback(null)
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault()
                submitMission()
              }
            }}
            className="min-h-0 flex-1 resize-none bg-transparent px-4.5 pt-3.5 pr-[270px] text-[11px] leading-[18px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] max-[760px]:pr-4.5"
            placeholder="描述目标、引用资料，或 @ 一位 Agent…"
            aria-label="任务描述"
          />

          <div className="absolute top-3 right-4 flex items-center gap-1.5 max-[760px]:hidden">
            <div className="flex -space-x-1.5">
              {agents.map((agent) => (
                <Tooltip key={agent.name}>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full border-2 border-panel outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                        agent.color,
                      )}
                    >
                      <UserCircle className="size-[18px]" weight="fill" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{agent.name} · 已就绪</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <span className="text-[9px] text-[var(--muted-strong)]">
              Nova · Codey · Sage · 3 位就绪
            </span>
          </div>

          <div className="flex h-[48px] shrink-0 items-center justify-between px-2.5 pb-2">
            <div className="flex items-center gap-1.5">
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => setAttachments(event.target.files?.length ?? 0)}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="添加附件"
                    onClick={() => fileRef.current?.click()}
                    className="size-8 rounded-[9px] bg-accent-soft text-accent-ink hover:shadow-[inset_0_0_0_1px_var(--accent-soft-line)]"
                  >
                    <Paperclip className="size-[16px]" weight="bold" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>添加附件</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-[11px]">
                    <Database className="size-4" />
                    <span className="max-[620px]:hidden">{attachments ? `${attachments} 个附件` : "添加上下文"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuLabel>添加工作上下文</DropdownMenuLabel>
                  <DropdownMenuItem><Stack weight="fill" /> 产品研发空间</DropdownMenuItem>
                  <DropdownMenuItem><FileText weight="fill" /> 最近文件</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => fileRef.current?.click()}><Paperclip /> 从本地选择</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-[11px] max-[620px]:hidden">
                    <ShieldCheck className="size-4" />
                    {permission}
                    <CaretDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>任务权限</DropdownMenuLabel>
                  {["默认权限", "仅查看", "允许修改工作区"].map((item) => (
                    <DropdownMenuCheckboxItem
                      key={item}
                      checked={permission === item}
                      onCheckedChange={() => setPermission(item)}
                    >
                      {item}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-[11px]">
                    <MagicWand className="size-4" />
                    {model}
                    <CaretDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>执行模型</DropdownMenuLabel>
                  {["Auto", "Fast", "Deep"].map((item) => (
                    <DropdownMenuCheckboxItem
                      key={item}
                      checked={model === item}
                      onCheckedChange={() => setModel(item)}
                    >
                      {item}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-pressed={isListening}
                    aria-label={isListening ? "停止语音输入" : "开始语音输入"}
                    onClick={() => setIsListening((listening) => !listening)}
                    className={cn(isListening && "bg-[#fff0ec] text-[#d9604e] animate-pulse")}
                  >
                    <Microphone className="size-5" weight={isListening ? "fill" : "regular"} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isListening ? "停止语音输入" : "语音输入"}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    aria-label="创建任务"
                    onClick={submitMission}
                    disabled={isSending}
                    className="size-8 rounded-[9px]"
                  >
                    {isSending ? (
                      <CircleNotch className="size-[16px] animate-spin" />
                    ) : (
                      <PaperPlaneTilt className="size-[16px]" weight="fill" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>创建任务 · Ctrl Enter</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        <button
          type="button"
          className={cn(
            "mx-auto mt-4 flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[10px] text-[var(--muted)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
            feedback && "text-accent-ink",
          )}
        >
          {feedback ? (
            <CheckCircle className="size-4" weight="fill" />
          ) : (
            <CheckCircle className="size-4 text-[#2b87eb]" />
          )}
          <span>{feedback ?? "今日完成 2 项 · 1 项等待评审"}</span>
          <CaretRight className="size-3.5" />
        </button>
      </div>
    </ScrollArea>
  )
}
