"use client"

import { ArrowDown, ArrowUp, ArrowSquareOut, ArrowsClockwise, ArrowsLeftRight, Camera, Copy, Database, DownloadSimple, EyeSlash, Funnel, Highlighter, List, PencilSimple, Table, Trash, MagicWand, X, Rows, ArrowsOutSimple } from '@phosphor-icons/react'
import type { DatabaseCell } from '@fouc/shared'
import { createPortal } from 'react-dom'
import { getOverlayRoot } from '@/lib/overlay-root'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { TableGridContextActions } from './context-actions'
import type { ResultGridSelectionScope } from './selection-controller'
import type { GridHighlightMode, GridValuePresentation } from './presentation'
import styles from './context-menu.module.css'

export function GridContextMenu({ point, cell, scope, actions, includeHeaders, onHeaders, onClose, onCellDetails, onRowDetails, onColumnDetails, onCopy, onTranspose, onClear, onScreenshot, onReturnFocus, hasHighlight, canHideEqual, hasHiddenColumns, canViewJson, canViewBinary, onHighlight, onHideEqual, onShowColumns, onOpenWith }: {
  point: { x: number; y: number } | null; cell: { columnIndex: number; columnName: string; value: DatabaseCell } | null; scope: ResultGridSelectionScope | null; actions?: TableGridContextActions;
  includeHeaders: boolean; onHeaders: (value: boolean) => void; onClose: () => void; onReturnFocus: () => void;
  onCellDetails: () => void; onRowDetails: () => void; onColumnDetails: () => void; onCopy: (format: 'raw' | 'tsv' | 'csv' | 'json') => void;
  onTranspose: () => void; onClear: () => void; onScreenshot: () => void;
  hasHighlight: boolean; canHideEqual: boolean; hasHiddenColumns: boolean; canViewJson: boolean; canViewBinary: boolean;
  onHighlight: (mode: GridHighlightMode | null) => void; onHideEqual: () => void; onShowColumns: () => void; onOpenWith: (mode: GridValuePresentation) => void;
}) {
  if (!point || !cell || !scope) return null
  const blocked = !actions?.writable || !actions.canEdit
  const submenuOffset = window.innerWidth < 520 ? -196 : 2
  return <DropdownMenu open modal={false} onOpenChange={open => { if (!open) onClose() }}>
    {createPortal(<DropdownMenuTrigger aria-hidden tabIndex={-1} className={styles.anchor} style={{ left: point.x, top: point.y }} />, getOverlayRoot() ?? document.body)}
    <DropdownMenuContent density="compact" aria-label="数据表选区菜单" side="right" align="start" sideOffset={0} collisionPadding={8} className={styles.menu} onCloseAutoFocus={event => { event.preventDefault(); onReturnFocus() }} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r' && actions) { event.preventDefault(); if (!actions.queryDisabled) { onClose(); actions.onRefresh() } } }}>
      {actions && <><DropdownMenuGroup>
        <DropdownMenuItem disabled={actions.queryDisabled} onSelect={() => actions.onDatabaseSort(cell.columnName, 'asc')}><Database weight="bold" />数据库升序排序</DropdownMenuItem>
        <DropdownMenuItem disabled={actions.queryDisabled} onSelect={() => actions.onDatabaseSort(cell.columnName, 'desc')}><Database weight="bold" />数据库降序排序</DropdownMenuItem>
      </DropdownMenuGroup><DropdownMenuSeparator /><DropdownMenuGroup>
        <DropdownMenuItem disabled={actions.queryDisabled} onSelect={() => actions.onPageSort(cell.columnIndex, 'asc')}><ArrowUp weight="bold" />当前页升序排序</DropdownMenuItem>
        <DropdownMenuItem disabled={actions.queryDisabled} onSelect={() => actions.onPageSort(cell.columnIndex, 'desc')}><ArrowDown weight="bold" />当前页降序排序</DropdownMenuItem>
      </DropdownMenuGroup><DropdownMenuSeparator /></>}
      <DropdownMenuGroup>
        {actions && <DropdownMenuSub><DropdownMenuSubTrigger disabled={actions.queryDisabled}><Funnel weight="bold" />筛选</DropdownMenuSubTrigger><DropdownMenuSubContent density="compact" sideOffset={submenuOffset} collisionPadding={8}>
          <DropdownMenuItem disabled={cell.value === null || typeof cell.value === 'object'} onSelect={() => actions.onFilter(cell.columnName, cell.value, 'equals')}>等于当前值</DropdownMenuItem>
          <DropdownMenuItem disabled={cell.value === null || typeof cell.value === 'object'} onSelect={() => actions.onFilter(cell.columnName, cell.value, 'not-equals')}>不等于当前值</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.onFilter(cell.columnName, cell.value, 'is-null')}>为空</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.onFilter(cell.columnName, cell.value, 'is-not-null')}>非空</DropdownMenuItem>
        </DropdownMenuSubContent></DropdownMenuSub>}
        <DropdownMenuSub><DropdownMenuSubTrigger><Highlighter weight="bold" />高亮</DropdownMenuSubTrigger><DropdownMenuSubContent density="compact" sideOffset={submenuOffset} collisionPadding={8}>
          <DropdownMenuItem onSelect={() => onHighlight('value')}>高亮相同值</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onHighlight('rows')}>高亮所选行</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onHighlight('columns')}>高亮所选列</DropdownMenuItem>
          <DropdownMenuSeparator /><DropdownMenuItem disabled={!hasHighlight} onSelect={() => onHighlight(null)}>清除高亮</DropdownMenuItem>
        </DropdownMenuSubContent></DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!canHideEqual} onSelect={onHideEqual}><EyeSlash weight="bold" />隐藏相同数值列</DropdownMenuItem>
        {hasHiddenColumns && <DropdownMenuItem onSelect={onShowColumns}>显示全部列</DropdownMenuItem>}
        <DropdownMenuItem onSelect={onCellDetails}><ArrowsOutSimple weight="bold" />单元格详情</DropdownMenuItem>
        <DropdownMenuItem onSelect={onColumnDetails}><Table weight="bold" />列详情</DropdownMenuItem>
        <DropdownMenuItem onSelect={onRowDetails}><Rows weight="bold" />行详情</DropdownMenuItem>
      </DropdownMenuGroup><DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuSub><DropdownMenuSubTrigger><Copy weight="bold" />复制</DropdownMenuSubTrigger><DropdownMenuSubContent density="compact" sideOffset={submenuOffset} collisionPadding={8}>
          <DropdownMenuItem onSelect={() => onCopy('raw')}>当前单元格原始值</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCopy('tsv')}>选区原始值 · TSV</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCopy('csv')}>选区原始值 · CSV</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCopy('json')}>选区原始值 · JSON</DropdownMenuItem>
          <DropdownMenuSeparator /><DropdownMenuCheckboxItem checked={includeHeaders} onCheckedChange={onHeaders} onSelect={event => event.preventDefault()}>包含列名</DropdownMenuCheckboxItem>
        </DropdownMenuSubContent></DropdownMenuSub>
        {actions && <><DropdownMenuItem disabled={blocked || !actions.canNull} onSelect={() => actions.onEdit('null', scope)} title={!actions.writable ? '解锁表格写入后可编辑' : undefined}><X weight="bold" />设为 NULL</DropdownMenuItem>
          <DropdownMenuItem disabled={blocked} onSelect={() => actions.onEdit('fill', scope)}><PencilSimple weight="bold" />批量修改所选</DropdownMenuItem>
          <DropdownMenuSub><DropdownMenuSubTrigger disabled={blocked}><MagicWand weight="bold" />生成值</DropdownMenuSubTrigger><DropdownMenuSubContent density="compact" sideOffset={submenuOffset} collisionPadding={8}>
            <DropdownMenuItem onSelect={() => actions.onEdit('generate-uuid', scope)}>UUID</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onEdit('generate-now', scope)}>当前时间 · ISO</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onEdit('generate-sequence', scope)}>自增序列 · 从 1 开始</DropdownMenuItem>
          </DropdownMenuSubContent></DropdownMenuSub></>}
        <DropdownMenuItem onSelect={onTranspose}><ArrowsLeftRight weight="bold" />转置查看</DropdownMenuItem>
        <DropdownMenuItem onSelect={onClear}><List weight="bold" />清除选区</DropdownMenuItem>
      </DropdownMenuGroup><DropdownMenuSeparator />
      <DropdownMenuGroup><DropdownMenuItem onSelect={onScreenshot}><Camera weight="bold" />截图选中区域</DropdownMenuItem></DropdownMenuGroup>
      {actions && <><DropdownMenuSeparator /><DropdownMenuGroup>
        <DropdownMenuItem disabled={!actions.writable || !actions.canClone} onSelect={() => actions.onEdit('clone', scope)}><Copy weight="bold" />克隆 {scope.rows.length} 行为新行</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" disabled={!actions.writable || !actions.canDelete} onSelect={() => actions.onEdit('delete', scope)}><Trash weight="bold" />删除 {scope.rows.length} 行</DropdownMenuItem>
      </DropdownMenuGroup><DropdownMenuSeparator /><DropdownMenuGroup>
        <DropdownMenuSub><DropdownMenuSubTrigger disabled={!scope.rectangular}><DownloadSimple weight="bold" />导出</DropdownMenuSubTrigger><DropdownMenuSubContent density="compact" sideOffset={submenuOffset} collisionPadding={8}>
          {(['csv', 'tsv', 'json', 'markdown', 'sql'] as const).map(format => <DropdownMenuItem key={format} onSelect={() => actions.onExport(format, scope)}>{format === 'markdown' ? 'Markdown' : format.toUpperCase()}</DropdownMenuItem>)}
        </DropdownMenuSubContent></DropdownMenuSub>
      </DropdownMenuGroup></>}
      <DropdownMenuGroup><DropdownMenuSub><DropdownMenuSubTrigger><ArrowSquareOut weight="bold" />打开方式</DropdownMenuSubTrigger><DropdownMenuSubContent density="compact" sideOffset={submenuOffset} collisionPadding={8}>
        <DropdownMenuItem onSelect={() => onOpenWith('text')}>文本查看</DropdownMenuItem>
        <DropdownMenuItem disabled={!canViewJson} title={!canViewJson ? '当前值不是有效 JSON' : undefined} onSelect={() => onOpenWith('json')}>JSON 查看</DropdownMenuItem>
        <DropdownMenuItem disabled={!canViewBinary} title={!canViewBinary ? '当前值不是原生二进制' : undefined} onSelect={() => onOpenWith('binary')}>二进制查看</DropdownMenuItem>
      </DropdownMenuSubContent></DropdownMenuSub></DropdownMenuGroup>
      {actions && <><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuItem disabled={actions.queryDisabled} onSelect={actions.onRefresh}><ArrowsClockwise weight="bold" />刷新<span className={styles.shortcut}>Ctrl R</span></DropdownMenuItem></DropdownMenuGroup></>}
    </DropdownMenuContent>
  </DropdownMenu>
}
