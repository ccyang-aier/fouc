'use client';

import { ArrowClockwise, CaretDown, DownloadSimple, Graph, MagnifyingGlass, Rows, SidebarSimple, SquaresFour, TreeStructure, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import styles from './diagram.module.css';

export type DiagramExportFormat = 'svg' | 'png' | 'mermaid' | 'json';
export function DiagramToolbar({ title, provider, objects, relationships, external, search, onSearch, fieldLimit, onFieldLimit, objectsVisible, onObjectsToggle, inspectorVisible, onInspectorToggle, busy, loading, disabled, onRefresh, onLayout, onExport, onClose }: {
  title: string; provider: string; objects: number; relationships: number; external: number;
  search: string; onSearch: (value: string) => void; fieldLimit: number; onFieldLimit: (value: number) => void;
  objectsVisible: boolean; onObjectsToggle: () => void; inspectorVisible: boolean; onInspectorToggle: () => void;
  busy: 'refresh' | 'export' | null; loading: boolean; disabled: boolean;
  onRefresh?: () => void; onLayout: () => void; onExport: (format: DiagramExportFormat) => void; onClose?: () => void;
}) {
  return <>
    <header className={styles.header}>
      <div className={styles.title}><Graph size={16} /><h2>{title}</h2><span className={styles.provider}>{provider}</span></div>
      <div className={styles.headerActions}><span>{objects} 个对象<span className={styles.statDivider}>·</span>{relationships} 条外键{external > 0 && <><span className={styles.statDivider}>·</span>{external} 个外部引用</>}</span>
        {onRefresh && <Button variant="ghost" size="icon-sm" aria-label="刷新结构" title="刷新结构" loading={busy === 'refresh' || loading} disabled={disabled} onClick={onRefresh}><ArrowClockwise size={16} /></Button>}
        {onClose && <Button variant="ghost" size="icon-sm" aria-label="关闭关系图" title="关闭关系图" disabled={Boolean(busy)} onClick={onClose}><X size={16} /></Button>}
      </div>
    </header>
    <div className={styles.toolbar} aria-label="关系图工具栏">
      <label className={styles.search}><MagnifyingGlass size={15} /><input aria-label="搜索关系图表或字段" placeholder="搜索对象或字段" value={search} onChange={event => onSearch(event.target.value)} /></label>
      <Button variant="ghost" size="sm" aria-label="切换关系图对象清单" aria-pressed={objectsVisible} onClick={onObjectsToggle}><SquaresFour size={16} /><span className={styles.actionLabel}>对象</span></Button>
      <span className={styles.toolDivider} />
      <label className={styles.fieldLimit} title="每表显示字段上限，优先显示主键和外键"><Rows size={15} /><select aria-label="关系图字段显示数量" value={fieldLimit} onChange={event => onFieldLimit(Number(event.target.value))}><option value={12}>12 字段</option><option value={24}>24 字段</option></select></label>
      <Button variant="ghost" size="sm" aria-label="自动布局" disabled={disabled || !objects} onClick={onLayout}><TreeStructure size={16} /><span className={styles.actionLabel}>自动布局</span></Button>
      <div className={styles.exportActions}>
        <Button variant="ghost" size="sm" aria-label="切换关系图详情" aria-pressed={inspectorVisible} onClick={onInspectorToggle}><SidebarSimple size={16} /><span className={styles.actionLabel}>详情</span></Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" aria-label="导出关系图" loading={busy === 'export'} disabled={disabled || !objects}><DownloadSimple size={16} /><span className={styles.actionLabel}>导出</span><CaretDown size={12} /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" density="compact"><DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => onExport('svg')}>SVG 矢量图</DropdownMenuItem><DropdownMenuItem onSelect={() => onExport('png')}>PNG 图片</DropdownMenuItem><DropdownMenuItem onSelect={() => onExport('mermaid')}>Mermaid</DropdownMenuItem><DropdownMenuItem onSelect={() => onExport('json')}>JSON 元数据</DropdownMenuItem>
          </DropdownMenuGroup></DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </>;
}
