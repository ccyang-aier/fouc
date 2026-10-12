"use client"

import { Crosshair, PanelsTopLeft, Table2, List, SlidersHorizontal, ArrowDownAZ, ArrowDownZA } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import styles from "./resource-tree.module.css"

export type ResourceSort = "catalog" | "asc" | "desc"
export type ResourceKind = "table" | "view"

export function ResourceTreeControls({ disabled, canLocate, sort, kinds, onLocate, onSort, onKind }: {
  disabled: boolean; canLocate: boolean; sort: ResourceSort; kinds: ReadonlySet<ResourceKind>;
  onLocate: () => void; onSort: (sort: ResourceSort) => void; onKind: (kind: ResourceKind, visible: boolean) => void
}) {
  const filtered = kinds.size !== 2 || sort !== "catalog"
  return <>
    <button type="button" className={`${styles.iconButton} fouc-action`} aria-label="定位当前对象" title="定位当前对象" disabled={disabled || !canLocate} onClick={onLocate}><Crosshair size={15} /></button>
    <DropdownMenu>
      <DropdownMenuTrigger className={styles.iconButton} disabled={disabled} aria-label="资源排序与筛选" title="资源排序与筛选" data-active={filtered}><SlidersHorizontal size={15} />{filtered && <i className={styles.filterDot} />}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="资源排序与筛选">
        <DropdownMenuGroup>
          <DropdownMenuLabel>对象排序</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={sort} onValueChange={value => onSort(value as ResourceSort)}>
            <DropdownMenuRadioItem className="gap-2" value="catalog"><List />目录顺序</DropdownMenuRadioItem>
            <DropdownMenuRadioItem className="gap-2" value="asc"><ArrowDownAZ />名称：A–Z</DropdownMenuRadioItem>
            <DropdownMenuRadioItem className="gap-2" value="desc"><ArrowDownZA />名称：Z–A</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>按类型筛选</DropdownMenuLabel>
          <DropdownMenuCheckboxItem className="gap-2" checked={kinds.has("table")} onCheckedChange={visible => onKind("table", visible)} onSelect={event => event.preventDefault()}><Table2 />表</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem className="gap-2" checked={kinds.has("view")} onCheckedChange={visible => onKind("view", visible)} onSelect={event => event.preventDefault()}><PanelsTopLeft />视图</DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </>
}
