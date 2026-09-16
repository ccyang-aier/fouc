"use client"

import { useEffect, useRef } from "react"
import { ArrowsClockwise, CaretDown, Funnel, MagnifyingGlass, X } from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { outputStatusMeta, outputTypeMeta, type OutputStatus, type OutputType } from "./project-outputs-data"

export type OutputsScope = "work" | "lifecycle"

export type OutputsFilters = {
  type: OutputType | "all"
  status: OutputStatus | "all"
  verification: "all" | "verified" | "none"
  owner: string | "all"
}

export const initialOutputsFilters: OutputsFilters = { type: "all", status: "all", verification: "all", owner: "all" }

const scopeOptions = [
  { id: "work", label: "按工作对象" },
  { id: "lifecycle", label: "按生命周期" },
] as const

const verificationFilterLabels = {
  verified: "已验证",
  none: "未验证",
} as const

type FilterTriggerProps = {
  label: string
  active: boolean
  /** 更多筛选类触发器使用前导图标，替代右侧的展开箭头 */
  leading?: "funnel"
  children: React.ReactNode
}

/** 通用筛选下拉：激活时切换为蓝色洗染态，与列表高亮同体系 */
function FilterTrigger({ label, active, leading, children }: FilterTriggerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-[34px] shrink-0 items-center gap-2 rounded-[8px] border px-3 text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
            leading === "funnel" ? "whitespace-nowrap" : "w-[110px] justify-between",
            active
              ? "border-[#d7e2f2] bg-[#eef3fa] text-[#3d67a0]"
              : "border-[var(--line)] bg-panel text-[var(--ink)] hover:bg-[var(--surface-subtle)] data-[state=open]:bg-[var(--surface-subtle)]",
          )}
        >
          {leading === "funnel" ? <Funnel className="size-4 shrink-0 text-[var(--muted-strong)]" /> : null}
          {label}
          {leading === "funnel" ? null : <CaretDown className={cn("size-3.5 shrink-0", active ? "text-[#4674ab]" : "text-[var(--muted-strong)]")} />}
        </button>
      </DropdownMenuTrigger>
      {children}
    </DropdownMenu>
  )
}

export function OutputsScopeSwitch({ scope, onScopeChange }: { scope: OutputsScope; onScopeChange: (scope: OutputsScope) => void }) {
  return (
    <div role="tablist" aria-label="产物视图" className="inline-flex h-[30px] shrink-0 items-center rounded-[9px] border border-[var(--line)] bg-[#f7f8fa] p-[3px]">
      {scopeOptions.map((option) => {
        const active = scope === option.id

        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onScopeChange(option.id)}
            className={cn(
              "h-full rounded-[7px] border px-[18px] text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              active
                ? "border-[var(--line)] bg-panel text-[#3d67a0] shadow-[0_1px_2px_rgba(35,40,48,0.05)]"
                : "border-transparent text-[var(--muted-strong)] hover:text-[var(--ink)]",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

type OutputsToolbarProps = {
  query: string
  onQueryChange: (query: string) => void
  chipLabel: string | null
  onChipClear: () => void
  filters: OutputsFilters
  onFiltersChange: (filters: OutputsFilters) => void
  onRefresh: () => void
  refreshing: boolean
  owners: string[]
}

export function OutputsToolbar({ query, onQueryChange, chipLabel, onChipClear, filters, onFiltersChange, onRefresh, refreshing, owners }: OutputsToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }

    window.addEventListener("keydown", focusSearch)
    return () => window.removeEventListener("keydown", focusSearch)
  }, [])

  return (
    <div className="flex h-[34px] items-center gap-3">
      <label className="flex h-[34px] w-[268px] shrink-0 items-center gap-2 rounded-[8px] border border-[var(--line)] bg-panel px-3 text-[12px] transition-colors focus-within:border-[#a9c0e0]">
        <MagnifyingGlass className="size-4 shrink-0 text-[var(--muted-strong)]" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label="搜索工作对象、产物或负责人"
          placeholder="搜索工作对象、产物或负责人"
          className="min-w-0 flex-1 bg-transparent text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
        />
      </label>

      {chipLabel ? (
        <span className="flex h-[28px] shrink-0 items-center gap-2 rounded-[8px] bg-[#eef3fa] py-1 pl-3 pr-2 text-[12px] font-medium text-[#3d67a0]">
          工作对象: {chipLabel}
          <button
            type="button"
            aria-label="清除工作对象聚焦"
            onClick={onChipClear}
            className="flex size-4 items-center justify-center rounded text-[#8598b4] outline-none transition-colors hover:text-[#3d67a0] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <X className="size-3" weight="bold" />
          </button>
        </span>
      ) : null}

      <FilterTrigger
        label={filters.type === "all" ? "所有类型" : outputTypeMeta[filters.type].label}
        active={filters.type !== "all"}
      >
        <DropdownMenuContent align="start" className="w-36">
          <DropdownMenuLabel>产物类型</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={filters.type === "all"} onCheckedChange={() => onFiltersChange({ ...filters, type: "all" })}>全部</DropdownMenuCheckboxItem>
          {(Object.keys(outputTypeMeta) as OutputType[]).map((type) => (
            <DropdownMenuCheckboxItem key={type} checked={filters.type === type} onCheckedChange={() => onFiltersChange({ ...filters, type })}>{outputTypeMeta[type].label}</DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </FilterTrigger>

      <FilterTrigger
        label={filters.status === "all" ? "所有状态" : outputStatusMeta[filters.status].label}
        active={filters.status !== "all"}
      >
        <DropdownMenuContent align="start" className="w-36">
          <DropdownMenuLabel>产物状态</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={filters.status === "all"} onCheckedChange={() => onFiltersChange({ ...filters, status: "all" })}>全部</DropdownMenuCheckboxItem>
          {(Object.keys(outputStatusMeta) as OutputStatus[]).map((status) => (
            <DropdownMenuCheckboxItem key={status} checked={filters.status === status} onCheckedChange={() => onFiltersChange({ ...filters, status })}>{outputStatusMeta[status].label}</DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </FilterTrigger>

      <FilterTrigger
        label={filters.verification === "all" ? "所有验证" : verificationFilterLabels[filters.verification]}
        active={filters.verification !== "all"}
      >
        <DropdownMenuContent align="start" className="w-36">
          <DropdownMenuLabel>验证进度</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={filters.verification === "all"} onCheckedChange={() => onFiltersChange({ ...filters, verification: "all" })}>全部</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={filters.verification === "verified"} onCheckedChange={() => onFiltersChange({ ...filters, verification: "verified" })}>已验证</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={filters.verification === "none"} onCheckedChange={() => onFiltersChange({ ...filters, verification: "none" })}>未验证</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </FilterTrigger>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <FilterTrigger label="更多筛选" active={filters.owner !== "all"} leading="funnel">
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuLabel>负责人</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={filters.owner === "all"} onCheckedChange={() => onFiltersChange({ ...filters, owner: "all" })}>全部</DropdownMenuCheckboxItem>
            {owners.map((name) => (
              <DropdownMenuCheckboxItem key={name} checked={filters.owner === name} onCheckedChange={() => onFiltersChange({ ...filters, owner: name })}>{name}</DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </FilterTrigger>

        <button
          type="button"
          aria-label="刷新产物列表"
          onClick={onRefresh}
          className="flex size-[34px] shrink-0 items-center justify-center rounded-[8px] border border-[var(--line)] bg-panel text-[var(--ink-soft)] outline-none transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <ArrowsClockwise className={cn("size-4", refreshing && "animate-spin text-[#4674ab]")} />
        </button>
      </div>
    </div>
  )
}
