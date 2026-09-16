"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import {
  Briefcase,
  CaretDown,
  ChartBar,
  CirclesFour,
  Code,
  PenNib,
  Plugs,
  Robot,
  Sparkle,
  Tag,
  TextT,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

export type CommunityTypeFilter = "all" | "agents" | "skills" | "plugins" | "prompts"

const TYPE_ITEMS = [
  { id: "all", label: "全部资源", icon: CirclesFour },
  { id: "agents", label: "Agents", icon: Robot },
  { id: "skills", label: "Skill", icon: Sparkle },
  { id: "plugins", label: "Plugin", icon: Plugs },
  { id: "prompts", label: "Prompt", icon: TextT },
] as const

const TAG_ITEMS = [
  { id: "研发", icon: Code, color: "#6681f5" },
  { id: "办公", icon: Briefcase, color: "#4aa78f" },
  { id: "数据", icon: ChartBar, color: "#8a70d6" },
  { id: "内容", icon: PenNib, color: "#d38b3d" },
  { id: "写作", icon: TextT, color: "#d4657c" },
] as const

const MIN_WIDTH = 190
const MAX_WIDTH = 320
const DEFAULT_WIDTH = 208

export function CommunityFacets({
  type,
  tag,
  typeCounts,
  tagCounts,
  onTypeChange,
  onTagChange,
}: {
  type: CommunityTypeFilter
  tag: string
  typeCounts: Record<CommunityTypeFilter, number>
  tagCounts: Map<string, number>
  onTypeChange: (type: CommunityTypeFilter) => void
  onTagChange: (tag: string) => void
}) {
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [dragging, setDragging] = useState(false)
  const [typesOpen, setTypesOpen] = useState(true)
  const [tagsOpen, setTagsOpen] = useState(true)
  const dragStart = useRef<{ pointerX: number; width: number } | null>(null)

  useEffect(() => {
    if (!dragging) return
    function move(event: PointerEvent) {
      const start = dragStart.current
      if (!start) return
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, start.width + event.clientX - start.pointerX)))
    }
    function stop() {
      dragStart.current = null
      setDragging(false)
      document.body.style.removeProperty("cursor")
      document.body.style.removeProperty("user-select")
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop, { once: true })
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
    }
  }, [dragging])

  function beginResize(event: ReactPointerEvent<HTMLButtonElement>) {
    dragStart.current = { pointerX: event.clientX, width }
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  return (
    <aside
      aria-label="社区资源分类"
      style={{ width, flexBasis: width }}
      className={cn(
        "sidebar-material relative flex h-full shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-[var(--wt-sidebar-edge)] px-[11px] pb-6",
        !dragging && "transition-[width,flex-basis] duration-150",
      )}
    >
      <div className="flex h-[47px] shrink-0 items-center px-1">
        <strong className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--ink)]">社区</strong>
      </div>

      <FacetSection label="类型" icon={CirclesFour} count={typeCounts.all} open={typesOpen} onToggle={() => setTypesOpen((open) => !open)}>
        {TYPE_ITEMS.map((item) => {
          const Icon = item.icon
          const active = type === item.id && !tag
          return (
            <button
              key={item.id}
              type="button"
              data-active={active}
              onClick={() => { onTypeChange(item.id); onTagChange("") }}
              className="sidebar-nav-row group flex h-[30px] w-full items-center gap-2 rounded-[6px] px-2 text-[12px] leading-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <Icon className={cn("sidebar-nav-icon size-4 shrink-0", active ? "text-[var(--accent-ink)]" : "text-[var(--muted)] group-hover:text-[var(--muted-strong)]")} weight={active ? "fill" : "duotone"} />
              <span className="sidebar-nav-label min-w-0 flex-1 truncate text-left">{item.label}</span>
              <span className="shrink-0 font-mono text-[9px] tabular-nums text-[var(--muted)]">{typeCounts[item.id]}</span>
            </button>
          )
        })}
      </FacetSection>

      <FacetSection label="标签" icon={Tag} count={TAG_ITEMS.length} open={tagsOpen} onToggle={() => setTagsOpen((open) => !open)} className="mt-[15px]">
        {TAG_ITEMS.map((item) => {
          const Icon = item.icon
          const active = tag === item.id
          return (
            <button
              key={item.id}
              type="button"
              data-active={active}
              onClick={() => onTagChange(active ? "" : item.id)}
              className="sidebar-nav-row group flex h-[30px] w-full items-center gap-2 rounded-[6px] px-2 text-[12px] leading-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <Icon aria-hidden className="sidebar-nav-icon size-4 shrink-0" style={{ color: active ? "var(--accent-ink)" : item.color }} weight={active ? "fill" : "duotone"} />
              <span className="sidebar-nav-label min-w-0 flex-1 truncate text-left">{item.id}</span>
              <span className="shrink-0 font-mono text-[9px] tabular-nums text-[var(--muted)]">{tagCounts.get(item.id) ?? 0}</span>
            </button>
          )
        })}
      </FacetSection>

      <button
        type="button"
        aria-label="拖拽调整社区侧栏宽度"
        title="拖拽调整社区侧栏宽度"
        onPointerDown={beginResize}
        style={{ cursor: "col-resize" }}
        className={cn(
          "absolute inset-y-0 right-[-4px] z-30 w-[9px] touch-none outline-none before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-[var(--accent)] before:opacity-0 before:transition-opacity hover:before:opacity-100 focus-visible:before:opacity-100",
          dragging && "before:w-[2px] before:opacity-100",
        )}
      />
    </aside>
  )
}

function FacetSection({
  label,
  icon: Icon,
  count,
  open,
  onToggle,
  className,
  children,
}: {
  label: string
  icon: typeof CirclesFour
  count: number
  open: boolean
  onToggle: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("flex flex-col gap-0.5", className)}>
      <button type="button" aria-expanded={open} onClick={onToggle} className="group flex min-h-[27px] items-center gap-1.5 rounded-[5px] px-1.5 text-left text-[11px] font-normal text-[var(--muted)] outline-none hover:bg-sidebar-hover hover:text-[var(--muted-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
        <Icon className="size-3.5 shrink-0" weight="duotone" />
        <span>{label}</span>
        <span className="font-mono text-[9px] text-[var(--muted)]">({count})</span>
        <CaretDown className={cn("ml-0.5 size-2.5 text-[var(--muted)] transition-transform duration-150", !open && "-rotate-90")} weight="fill" />
      </button>
      {open ? <div className="space-y-0.5 pl-2.5">{children}</div> : null}
    </section>
  )
}
