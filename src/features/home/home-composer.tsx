"use client"

import { useEffect, useRef, useState } from "react"
import {
  BookOpen,
  CaretDown,
  Check,
  CircleNotch,
  FileText,
  FolderSimple,
  Microphone,
  PaperPlaneTilt,
  Paperclip,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Stack,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { HomeAssistant } from "./home-assistant"

const AGENTS = ["Nova", "Codey", "Sage"] as const
const MODES = ["Auto", "Fast", "Deep"] as const
const PERMISSIONS = ["默认权限", "仅查看", "允许修改工作区"] as const

type HomeComposerProps = {
  onStatusChange: (status: string | null) => void
}

function SelectorChevron() {
  return <CaretDown className="size-3 text-[var(--muted)]" weight="bold" />
}

export function HomeComposer({ onStatusChange }: HomeComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const celebrationTimerRef = useRef<number | null>(null)
  const [prompt, setPrompt] = useState("")
  const [agent, setAgent] = useState<(typeof AGENTS)[number]>("Nova")
  const [mode, setMode] = useState<(typeof MODES)[number]>("Auto")
  const [permission, setPermission] = useState<(typeof PERMISSIONS)[number]>("默认权限")
  const [projectIncluded, setProjectIncluded] = useState(true)
  const [knowledgeIncluded, setKnowledgeIncluded] = useState(true)
  const [attachmentCount, setAttachmentCount] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [assistantCelebrating, setAssistantCelebrating] = useState(false)

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current)
    }
  }, [])

  function submitMission() {
    if (!prompt.trim()) {
      setHasError(true)
      onStatusChange("先描述一个想要完成的目标")
      inputRef.current?.focus()
      return
    }

    setHasError(false)
    setIsSending(true)
    onStatusChange(null)
    window.setTimeout(() => {
      setPrompt("")
      setIsSending(false)
      onStatusChange(`${agent} 正在整理任务上下文`)
      setAssistantCelebrating(true)
      if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current)
      celebrationTimerRef.current = window.setTimeout(() => setAssistantCelebrating(false), 1400)
    }, 720)
  }

  return (
    <div
      className={cn(
        "group/composer relative flex h-[216px] w-full flex-col rounded-[11px] border bg-panel text-left shadow-[0_1px_2px_rgba(22,28,36,0.025),0_12px_34px_-28px_rgba(22,28,36,0.32)] transition-[border-color,box-shadow] duration-200 focus-within:border-[var(--line-strong)] focus-within:shadow-[0_1px_2px_rgba(22,28,36,0.035),0_18px_38px_-28px_rgba(22,28,36,0.4)]",
        hasError ? "border-[#d58c7f]" : "border-[var(--line)]",
      )}
    >
      <HomeAssistant celebrating={assistantCelebrating} />

      <div className="relative z-10 flex h-[53px] shrink-0 items-center justify-between rounded-t-[10px] border-b border-[var(--line)] bg-panel px-5 max-[760px]:px-3">
        <div className="flex min-w-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 text-[11px] font-medium text-[var(--ink-soft)]">
                <FolderSimple className="size-[17px]" />
                <span className="max-[520px]:hidden">当前项目</span>
                <SelectorChevron />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>项目上下文</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={projectIncluded} onCheckedChange={setProjectIncluded}>
                产品研发空间
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem><Stack />切换项目</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="mx-1 h-5 w-px bg-[var(--line)]" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 text-[11px] font-medium text-[var(--ink-soft)]">
                <BookOpen className="size-[17px]" />
                <span className="max-[520px]:hidden">知识库</span>
                <SelectorChevron />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>可用知识</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={knowledgeIncluded} onCheckedChange={setKnowledgeIncluded}>
                团队知识库
              </DropdownMenuCheckboxItem>
              <DropdownMenuItem><FileText />最近资料</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 text-[11px] font-medium text-[var(--ink-soft)]">
              <ShieldCheck className="size-[17px]" />
              <span className="max-[760px]:hidden">{permission}</span>
              <SelectorChevron />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>任务权限</DropdownMenuLabel>
            {PERMISSIONS.map((item) => (
              <DropdownMenuCheckboxItem key={item} checked={permission === item} onCheckedChange={() => setPermission(item)}>
                {item}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <textarea
        ref={inputRef}
        value={prompt}
        onChange={(event) => {
          setPrompt(event.target.value)
          if (hasError) {
            setHasError(false)
            onStatusChange(null)
          }
        }}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault()
            submitMission()
          }
        }}
        aria-label="任务描述"
        placeholder="描述你的目标、引用资料，或 @ 一位 Agent…"
        className="chat-scope relative z-10 min-h-0 flex-1 resize-none bg-panel px-6 pt-4 text-[12px] leading-5 text-[var(--ink)] outline-none placeholder:text-[var(--muted)] max-[760px]:px-4"
      />

      <div className="relative z-10 flex h-[62px] shrink-0 items-center justify-between rounded-b-[10px] bg-panel px-5 pb-3 max-[760px]:px-3">
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const count = event.target.files?.length ?? 0
            setAttachmentCount(count)
            if (count) onStatusChange(`已添加 ${count} 个附件`)
          }}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="添加附件"
              onClick={() => fileRef.current?.click()}
              className="size-10 rounded-[7px] border-[var(--line)] bg-transparent text-[var(--ink-soft)] shadow-none hover:bg-[var(--surface-hover)]"
            >
              {attachmentCount ? <Paperclip className="size-[18px]" weight="bold" /> : <Plus className="size-[18px]" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{attachmentCount ? `已添加 ${attachmentCount} 个附件` : "添加附件"}</TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-2 max-[760px]:gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 min-w-[118px] justify-between rounded-[7px] bg-transparent px-3 text-[11px] shadow-none max-[760px]:min-w-0">
                <span className="flex items-center gap-2"><Stack className="size-[16px]" />{agent}</span>
                <SelectorChevron />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>选择 Agent</DropdownMenuLabel>
              {AGENTS.map((item) => (
                <DropdownMenuCheckboxItem key={item} checked={agent === item} onCheckedChange={() => setAgent(item)}>
                  {item}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 min-w-[118px] justify-between rounded-[7px] bg-transparent px-3 text-[11px] shadow-none max-[760px]:min-w-0">
                <span className="flex items-center gap-2"><SlidersHorizontal className="size-[16px]" />{mode}</span>
                <SelectorChevron />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>工作模式</DropdownMenuLabel>
              {MODES.map((item) => (
                <DropdownMenuCheckboxItem key={item} checked={mode === item} onCheckedChange={() => setMode(item)}>
                  {item}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem><Check />按任务自动选择工具</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="mx-1 h-6 w-px bg-[var(--line)] max-[760px]:hidden" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={isListening ? "停止语音输入" : "开始语音输入"}
                aria-pressed={isListening}
                onClick={() => {
                  setIsListening((value) => !value)
                  onStatusChange(isListening ? null : "正在聆听…")
                }}
                className={cn("size-10 rounded-[7px] bg-transparent shadow-none", isListening && "border-[#df9e93] bg-[#fff6f4] text-[#c15d4d]")}
              >
                <Microphone className="size-[19px]" weight={isListening ? "fill" : "regular"} />
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
                disabled={isSending}
                onClick={submitMission}
                className="size-10 rounded-[7px] bg-[#4a8fca] shadow-[0_5px_12px_rgba(74,143,202,0.2)] hover:bg-[#3f80b8]"
              >
                {isSending ? <CircleNotch className="size-[18px] animate-spin" /> : <PaperPlaneTilt className="size-[18px]" weight="fill" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>创建任务 · Ctrl Enter</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
