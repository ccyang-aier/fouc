'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DotsThree, ArrowsDownUp, CaretRight, FileText, Funnel, MagnifyingGlass, Plus, SquaresFour, Table, UploadSimple, X } from '@phosphor-icons/react';
import styles from './documents-page.module.css';
import { formatOf } from './document-visuals';
import { DocumentFolders } from './document-folders';
import { DocumentCollection } from './document-collection';
import type { DocumentItem, DocumentFolder } from './types';
type Props = {
    documents: DocumentItem[];
    folders: DocumentFolder[];
    onOpen: (id: string) => void;
    onOpenFolder: (id: string) => void;
    onCreate: () => void;
    onCreateFolder?: () => void;
    upload: ReactNode;
    renderMenu: (id: string) => ReactNode;
    canEdit?: boolean;
};
export function DocumentsPage({ documents, folders, onOpen, onOpenFolder, onCreate, onCreateFolder, upload, renderMenu, canEdit = true }: Props) {
    const uploadDialog = useRef<HTMLDialogElement>(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [filterOpen, setFilterOpen] = useState(false);
    const [ascending, setAscending] = useState(false);
    const [layout, setLayout] = useState<'table' | 'grid'>('table');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [allFolders, setAllFolders] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    useEffect(() => { if (uploadOpen)
        uploadDialog.current?.showModal();
    else
        uploadDialog.current?.close(); }, [uploadOpen]);
    const [newOpen, setNewOpen] = useState(false);
    const shown = useMemo(() => documents.filter((doc) => doc.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()) && (filter === 'all' || (filter === 'starred' ? doc.starred : formatOf(doc.title) === filter))).sort((a, b) => (ascending ? 1 : -1) * a.updatedAt.localeCompare(b.updatedAt)), [documents, search, filter, ascending]);
    const visibleFolders = folders.filter((folder) => folder.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
    const formats = [...new Set(documents.map((doc) => formatOf(doc.title)))];
    const selectedCount = shown.filter((doc) => selected.has(doc.id)).length;
    function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id))
        next.delete(id);
    else
        next.add(id); return next; }); }
    function exportSelection() {
        const blob = new Blob(['\ufeff名称,格式,更新时间,来源\n' + shown.filter((doc) => selected.has(doc.id)).map((doc) => [doc.title, formatOf(doc.title), doc.updatedAt, doc.source].map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = '文档清单.csv';
        link.click();
        URL.revokeObjectURL(url);
    }
    return <section className={styles.page} aria-label="知识库文档列表" onKeyDown={(event) => { if (event.key === 'Escape') {
        setFilterOpen(false);
        setNewOpen(false);
    } }}>
    <header className={styles.toolbar}><div className={styles.heading}><FileText size={18}/><h1>文档</h1><span>{documents.length}</span></div>
      <div className={styles.tools}><label className={styles.search}><MagnifyingGlass size={16}/><input aria-label="搜索文档" placeholder="搜索文档" value={search} onChange={(event) => setSearch(event.target.value)}/>{search ? <button aria-label="清除搜索" onClick={() => setSearch('')}><X size={13}/></button> : null}</label>
        <div className={styles.popoverAnchor} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) {
        setNewOpen(false);
        setFilterOpen(false);
    } }}><button className={styles.control} aria-expanded={filterOpen} onClick={() => setFilterOpen(!filterOpen)} data-active={filter !== 'all'}><Funnel size={16}/>筛选</button>{filterOpen ? <div className={styles.popover}><label>显示文档<select aria-label="筛选格式" value={filter} onChange={(event) => { setFilter(event.target.value); setFilterOpen(false); }}><option value="all">全部格式</option><option value="starred">仅星标文档</option>{formats.map((format) => <option key={format}>{format}</option>)}</select></label><button onClick={() => { setFilter('all'); setFilterOpen(false); }}>重置筛选</button></div> : null}</div>
        <button className={styles.control} title={ascending ? '按更新时间从新到旧' : '按更新时间从旧到新'} aria-label="切换更新时间排序" onClick={() => setAscending(!ascending)}><ArrowsDownUp size={17}/></button>
        <div className={styles.switcher}><button aria-label="文件夹卡片视图" aria-pressed={layout === 'table'} onClick={() => setLayout('table')}><SquaresFour size={17} weight="fill"/></button><button aria-label="文件网格视图" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}><Table size={17}/></button></div>
        <div className={styles.popoverAnchor}><button className={styles.control} disabled={!canEdit} aria-expanded={newOpen} onClick={() => setNewOpen(!newOpen)}><Plus size={17}/>新建<span className={styles.caret}>⌄</span></button>{newOpen ? <div className={styles.popover}><button onClick={() => { setNewOpen(false); onCreate(); }}>新建文档</button>{onCreateFolder ? <button onClick={() => { setNewOpen(false); onCreateFolder(); }}>新建文件夹</button> : null}</div> : null}</div>
        <button className={styles.upload} disabled={!canEdit} onClick={() => setUploadOpen(true)}><UploadSimple size={17}/>上传</button><DropdownMenu><DropdownMenuTrigger asChild><button className={styles.more} aria-label="文档视图更多操作"><DotsThree size={19} weight="bold" /></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { setSearch(''); setFilter('all'); setAscending(false); setLayout('table'); setSelected(new Set()); setAllFolders(false); }}>重置视图</DropdownMenuItem><DropdownMenuItem disabled={!selectedCount} onSelect={exportSelection}>导出所选文档清单</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </div>
    </header>
    <div className={styles.content}><div className={styles.sectionHeading}><h2>文件夹 <span>{folders.length}</span></h2><button onClick={() => setAllFolders(!allFolders)}>{allFolders ? '收起文件夹' : '全部文件夹'}<CaretRight size={14}/></button></div>
      <DocumentFolders visibleFolders={visibleFolders} allFolders={allFolders} onOpenFolder={onOpenFolder} onCreateFolder={onCreateFolder} canEdit={canEdit}/>
      <div className={styles.sectionHeading}><h2>文件 <span>{shown.length}</span></h2>{selectedCount ? <div className={styles.selection} role="status">已选择 {selectedCount} 项<button onClick={exportSelection}>导出清单</button><button onClick={() => setSelected(new Set())}>取消选择</button></div> : null}</div>
      <DocumentCollection layout={layout} shown={shown} selected={selected} selectedCount={selectedCount} setSelected={setSelected} toggle={toggle} ascending={ascending} setAscending={setAscending} onOpen={onOpen} renderMenu={renderMenu}/>
      {!shown.length ? <div className={styles.empty}><FileText size={32}/><strong>{search || filter !== 'all' ? '没有匹配的文档' : '开始整理你的知识'}</strong><p>{search || filter !== 'all' ? '尝试其他关键词或重置筛选。' : '新建文档，让灵感与资料在这里汇聚。'}</p><button className={styles.control} onClick={search || filter !== 'all' ? () => { setSearch(''); setFilter('all'); } : onCreate}>{search || filter !== 'all' ? '重置搜索与筛选' : '新建文档'}</button></div> : null}
    </div>
    <dialog ref={uploadDialog} onCancel={() => setUploadOpen(false)} onClose={() => setUploadOpen(false)} className={styles.uploadDialog} aria-label="上传文档" onKeyDown={(event) => { if (event.key === 'Escape')
        setUploadOpen(false); }}><div className={styles.dialogHeader}><h2>上传文档</h2><button autoFocus aria-label="关闭上传" onClick={() => setUploadOpen(false)}><X size={20}/></button></div>{uploadOpen ? upload : null}</dialog>
  </section>;
}
