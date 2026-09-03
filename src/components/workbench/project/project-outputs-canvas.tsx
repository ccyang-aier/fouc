"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { initialOutputGroups, lifecycleStageOrder, outputTypeMeta, type OutputEntry, type OutputPerson } from "./project-outputs-data"
import { OutputsContextPanel } from "./project-outputs-context"
import { OutputsTable, type OutputSection } from "./project-outputs-table"
import { initialOutputsFilters, OutputsScopeSwitch, OutputsToolbar, type OutputsFilters, type OutputsScope } from "./project-outputs-toolbar"
import { ProjectHeader } from "./project-header"
import { type ProjectTab } from "./project-data"

const allOutputs: OutputEntry[] = initialOutputGroups.flatMap((group) => group.outputs)
const ownerNames = [...new Set(initialOutputGroups.map((group) => group.owner.name))]
const stageSectionIds = lifecycleStageOrder.map((type) => `stage-${type}`)

const DEFAULT_EXPANDED = new Set(["Issue-128"])
const DEFAULT_SELECTED = "ISSUE-128-ROOT-CAUSE"
const REFRESH_DURATION = 650

type ProjectOutputsCanvasProps = {
  tab: ProjectTab
  onTabChange: (tab: ProjectTab) => void
  favorited: boolean
  onFavoriteChange: (favorited: boolean) => void
  panelOpen: boolean
  onPanelOpenChange: (open: boolean) => void
}

export function ProjectOutputsCanvas({ tab, onTabChange, favorited, onFavoriteChange, panelOpen, onPanelOpenChange }: ProjectOutputsCanvasProps) {
  const [scope, setScope] = useState<OutputsScope>("work")
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<OutputsFilters>(initialOutputsFilters)
  const [sortDesc, setSortDesc] = useState(true)
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(DEFAULT_EXPANDED)
  const [selectedId, setSelectedId] = useState<string | null>(DEFAULT_SELECTED)
  const [refreshing, setRefreshing] = useState(false)

  const normalizedQuery = query.trim().toLowerCase()
  const filtersActive = normalizedQuery !== "" || filters.type !== "all" || filters.status !== "all" || filters.verification !== "all" || filters.owner !== "all"

  const sections = useMemo<OutputSection[]>(() => {
    const ownerOk = (owner: OutputPerson) => filters.owner === "all" || owner.name === filters.owner
    const passesFilters = (output: OutputEntry) =>
      (filters.type === "all" || output.type === filters.type) &&
      (filters.status === "all" || output.status === filters.status) &&
      (filters.verification === "all" || (filters.verification === "verified") === (output.verification !== null))
    const byUpdated = (a: OutputEntry, b: OutputEntry) => (sortDesc ? b.updated.localeCompare(a.updated) : a.updated.localeCompare(b.updated))

    let built: OutputSection[]

    if (scope === "work") {
      built = initialOutputGroups.filter((group) => ownerOk(group.owner)).map((group) => {
        const groupMatches = normalizedQuery === "" || `${group.id} ${group.title} ${group.owner.name}`.toLowerCase().includes(normalizedQuery)
        const outputs = group.outputs
          .filter(passesFilters)
          .filter((output) => groupMatches || output.name.toLowerCase().includes(normalizedQuery))
          .sort(byUpdated)

        return { id: group.id, title: group.title, owner: group.owner, status: group.status, acceptance: group.acceptance, outputs }
      })
    } else {
      built = lifecycleStageOrder.map((type) => ({
        id: `stage-${type}`,
        title: outputTypeMeta[type].stage,
        outputs: initialOutputGroups
          .filter((group) => ownerOk(group.owner))
          .flatMap((group) => group.outputs)
          .filter((output) => output.type === type && passesFilters(output) && (normalizedQuery === "" || output.name.toLowerCase().includes(normalizedQuery)))
          .sort(byUpdated),
      }))
    }

    return filtersActive ? built.filter((section) => section.outputs.length > 0) : built
  }, [scope, normalizedQuery, filters, sortDesc, filtersActive])

  // 搜索时强制展开可见分组，保证命中结果直接可读；清空后恢复手动展开状态
  const effectiveExpanded = normalizedQuery !== "" ? new Set(sections.map((section) => section.id)) : expandedIds

  const selectedOutput = selectedId ? allOutputs.find((output) => output.id === selectedId) ?? null : null
  const selectedGroupId = selectedOutput ? initialOutputGroups.find((group) => group.outputs.includes(selectedOutput))?.id ?? null : null

  function handleScopeChange(next: OutputsScope) {
    setScope(next)
    // 切换视图后展开全部分组，避免新分组体系整体折叠
    setExpandedIds(new Set(next === "work" ? initialOutputGroups.map((group) => group.id) : stageSectionIds))
  }

  function toggleGroup(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    window.setTimeout(() => setRefreshing(false), REFRESH_DURATION)
  }

  return (
    <div
      className={cn(
        "grid h-full min-h-0 bg-panel",
        panelOpen ? "grid-cols-[minmax(0,1fr)_310px] max-[1120px]:grid-cols-1" : "grid-cols-1",
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col">
        <ProjectHeader
          tab={tab}
          onTabChange={onTabChange}
          favorited={favorited}
          onFavoriteChange={onFavoriteChange}
          panelOpen={panelOpen}
          onTogglePanel={() => onPanelOpenChange(!panelOpen)}
        />
        <div className="shrink-0 pb-[19px] pl-7 pr-3.5 pt-6">
          <OutputsScopeSwitch scope={scope} onScopeChange={handleScopeChange} />
          <div className="mt-5">
            <OutputsToolbar
              query={query}
              onQueryChange={setQuery}
              chipLabel={selectedGroupId}
              onChipClear={() => setSelectedId(null)}
              filters={filters}
              onFiltersChange={setFilters}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              owners={ownerNames}
            />
          </div>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-auto pb-6 pl-7 pr-3.5">
          <OutputsTable
            sections={sections}
            expandedIds={effectiveExpanded}
            onToggleGroup={toggleGroup}
            selectedId={selectedId}
            onSelect={setSelectedId}
            sortDesc={sortDesc}
            onToggleSort={() => setSortDesc((desc) => !desc)}
            emptyLabel={scope === "work" ? "没有符合条件的工作对象" : "没有符合条件的阶段"}
            unitLabel={scope === "work" ? "工作对象" : "阶段"}
          />
        </div>
      </div>
      {panelOpen ? <OutputsContextPanel groupId={selectedGroupId} output={selectedOutput} onClose={() => onPanelOpenChange(false)} /> : null}
    </div>
  )
}
