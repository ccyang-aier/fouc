"use client"

import { useRef, useState } from "react"
import { CaretDown, CheckCircle, CircleNotch, MagicWand, Microphone, PaperPlaneTilt, Paperclip, ShieldCheck } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function ProjectComposer() {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [prompt, setPrompt] = useState("")
  const [permission, setPermission] = useState("默认权限")
  const [model, setModel] = useState("Auto")
  const [listening, setListening] = useState(false)
  const [attachmentCount, setAttachmentCount] = useState(0)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  function submit() {
    if (!prompt.trim()) {
      inputRef.current?.focus()
      return
    }
    setSending(true)
    window.setTimeout(() => {
      setSending(false)
      setSent(true)
      setPrompt("")
      window.setTimeout(() => setSent(false), 1800)
    }, 650)
  }

  return (
    <div className={cn("relative flex h-[100px] shrink-0 flex-col rounded-[8px] border bg-panel transition-[border-color,box-shadow] focus-within:border-[var(--accent-soft-line)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_9%,transparent)]", sent ? "border-[var(--accent-soft-line)]" : "border-[var(--line-strong)]") }>
      <textarea
        ref={inputRef}
        aria-label="任务描述"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault()
            submit()
          }
        }}
        placeholder={sent ? "任务已创建" : "描述目标，@ 工作对象、资源或 Agent..."}
        className="min-h-0 flex-1 resize-none bg-transparent px-4 pt-3.5 text-[11px] leading-5 text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
      />
      <div className="flex h-[44px] shrink-0 items-center justify-between px-2.5 pb-2">
        <div className="flex items-center gap-0.5">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(event) => setAttachmentCount(event.target.files?.length ?? 0)} />
          <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} className="h-8 gap-2 px-2 text-[10.5px]">
            <Paperclip className="size-[17px]" />{attachmentCount ? `${attachmentCount} 个附件` : "添加上下文"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-[10.5px]"><ShieldCheck className="size-[16px]" />{permission}<CaretDown className="size-3" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>任务权限</DropdownMenuLabel>
              {["默认权限", "仅查看", "允许修改工作区"].map((item) => <DropdownMenuCheckboxItem key={item} checked={permission === item} onCheckedChange={() => setPermission(item)}>{item}</DropdownMenuCheckboxItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-[10.5px]"><MagicWand className="size-[16px]" />{model}<CaretDown className="size-3" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>执行模式</DropdownMenuLabel>
              {["Auto", "Fast", "Deep"].map((item) => <DropdownMenuCheckboxItem key={item} checked={model === item} onCheckedChange={() => setModel(item)}>{item}</DropdownMenuCheckboxItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-pressed={listening} aria-label="语音输入" onClick={() => setListening((value) => !value)} className={cn("size-8", listening && "bg-[var(--accent-soft)] text-[var(--accent-ink)] animate-pulse")}><Microphone className="size-[18px]" weight={listening ? "fill" : "regular"} /></Button>
            </TooltipTrigger>
            <TooltipContent>{listening ? "停止语音输入" : "语音输入"}</TooltipContent>
          </Tooltip>
          <Button type="button" size="icon-sm" aria-label="创建任务" onClick={submit} disabled={sending} className="size-9 rounded-[7px]">
            {sending ? <CircleNotch className="size-[17px] animate-spin" /> : sent ? <CheckCircle className="size-[18px]" weight="fill" /> : <PaperPlaneTilt className="size-[17px]" weight="fill" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
