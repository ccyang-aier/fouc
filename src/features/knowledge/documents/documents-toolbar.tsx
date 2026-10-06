'use client';

import {
  ArrowsDownUp, CaretDown, DotsThree, Funnel, MagnifyingGlass,
  Plus, SidebarSimple, SquaresFour, Table, UploadSimple, X,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconButton } from '../dense-sidebar/icon-button';
import styles from './documents-page.module.css';

type Props = {
  count: number;
  search: string;
  onSearch: (value: string) => void;
  filter: string;
  formats: string[];
  onFilter: (value: string) => void;
  ascending: boolean;
  onSort: () => void;
  layout: 'table' | 'grid';
  onLayout: (value: 'table' | 'grid') => void;
  canEdit: boolean;
  onCreate: () => void;
  onCreateFolder?: () => void;
  onUpload: () => void;
  onReset: () => void;
  selectedCount: number;
  onExport: () => void;
  onExpandSidebar?: () => void;
};

export function DocumentsToolbar({
  count, search, onSearch, filter, formats, onFilter, ascending, onSort,
  layout, onLayout, canEdit, onCreate, onCreateFolder, onUpload,
  onReset, selectedCount, onExport, onExpandSidebar,
}: Props) {
  return <header className={styles.toolbar}>
    <div className={styles.heading}>
      {onExpandSidebar ? <IconButton label="展开知识库侧边栏" tooltip="展开侧栏" onClick={onExpandSidebar} className={styles.sidebarToggle}><SidebarSimple size={18} /></IconButton> : null}
      <h1>文档</h1><span>{count}</span>
    </div>
    <div className={styles.tools}>
      <label className={styles.search}>
        <MagnifyingGlass size={16} />
        <input aria-label="搜索文档" placeholder="搜索文档" value={search} onChange={event => onSearch(event.target.value)} />
        {search ? <Button variant="ghost" size="icon-sm" aria-label="清除搜索" onClick={() => onSearch('')} className={styles.clearSearch}><X size={13} /></Button> : null}
      </label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={styles.control} data-active={filter !== 'all'}><Funnel size={16} />筛选</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={filter} onValueChange={onFilter}>
            <DropdownMenuRadioItem value="all">全部格式</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="starred">仅星标文档</DropdownMenuRadioItem>
            {formats.map(format => <DropdownMenuRadioItem key={format} value={format}>{format}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup><DropdownMenuItem disabled={filter === 'all'} onSelect={() => onFilter('all')}>重置筛选</DropdownMenuItem></DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" size="sm" className={styles.control} title={ascending ? '按更新时间从新到旧' : '按更新时间从旧到新'} aria-label="切换更新时间排序" onClick={onSort}><ArrowsDownUp size={17} /></Button>
      <div className={styles.switcher}>
        <Button variant="ghost" size="icon-sm" aria-label="文件夹卡片视图" aria-pressed={layout === 'table'} onClick={() => onLayout('table')}><SquaresFour size={17} weight="fill" /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="文件网格视图" aria-pressed={layout === 'grid'} onClick={() => onLayout('grid')}><Table size={17} /></Button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={styles.control} disabled={!canEdit}><Plus size={17} />新建<CaretDown className={styles.caret} size={12} /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onCreate}>新建文档</DropdownMenuItem>
            {onCreateFolder ? <DropdownMenuItem onSelect={onCreateFolder}>新建文件夹</DropdownMenuItem> : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" className={styles.upload} disabled={!canEdit} onClick={onUpload}><UploadSimple size={17} />上传</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" className={styles.more} aria-label="文档视图更多操作"><DotsThree size={19} weight="bold" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onReset}>重置视图</DropdownMenuItem>
            <DropdownMenuItem disabled={!selectedCount} onSelect={onExport}>导出所选文档清单</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>;
}
