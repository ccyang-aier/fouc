'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CaretRight, FileText, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import styles from './documents-page.module.css';
import { formatOf } from './document-visuals';
import { DocumentFolders } from './document-folders';
import { DocumentCollection } from './document-collection';
import { DocumentsToolbar } from './documents-toolbar';
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
    onExpandSidebar?: () => void;
};
export function DocumentsPage({ documents, folders, onOpen, onOpenFolder, onCreate, onCreateFolder, upload, renderMenu, canEdit = true, onExpandSidebar }: Props) {
    const uploadDialog = useRef<HTMLDialogElement>(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [ascending, setAscending] = useState(false);
    const [layout, setLayout] = useState<'table' | 'grid'>('table');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [allFolders, setAllFolders] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    useEffect(() => { if (uploadOpen)
        uploadDialog.current?.showModal();
    else
        uploadDialog.current?.close(); }, [uploadOpen]);
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
    return <section className={styles.page} aria-label="知识库文档列表">
    <DocumentsToolbar count={documents.length} search={search} onSearch={setSearch} filter={filter} formats={formats} onFilter={setFilter}
      ascending={ascending} onSort={() => setAscending(!ascending)} layout={layout} onLayout={setLayout} canEdit={canEdit}
      onCreate={onCreate} onCreateFolder={onCreateFolder} onUpload={() => setUploadOpen(true)} selectedCount={selectedCount} onExport={exportSelection}
      onExpandSidebar={onExpandSidebar} onReset={() => { setSearch(''); setFilter('all'); setAscending(false); setLayout('table'); setSelected(new Set()); setAllFolders(false); }} />
    <div className={styles.content}><div className={styles.sectionHeading}><h2>文件夹 <span>{folders.length}</span></h2><button onClick={() => setAllFolders(!allFolders)}>{allFolders ? '收起文件夹' : '全部文件夹'}<CaretRight size={14}/></button></div>
      <DocumentFolders visibleFolders={visibleFolders} allFolders={allFolders} onOpenFolder={onOpenFolder} onCreateFolder={onCreateFolder} canEdit={canEdit}/>
      <div className={styles.sectionHeading}><h2>文件 <span>{shown.length}</span></h2>{selectedCount ? <div className={styles.selection} role="status">已选择 {selectedCount} 项<button onClick={exportSelection}>导出清单</button><button onClick={() => setSelected(new Set())}>取消选择</button></div> : null}</div>
      <DocumentCollection layout={layout} shown={shown} selected={selected} selectedCount={selectedCount} setSelected={setSelected} toggle={toggle} ascending={ascending} setAscending={setAscending} onOpen={onOpen} renderMenu={renderMenu}/>
      {!shown.length ? <div className={styles.empty}><FileText size={32}/><strong>{search || filter !== 'all' ? '没有匹配的文档' : '开始整理你的知识'}</strong><p>{search || filter !== 'all' ? '尝试其他关键词或重置筛选。' : '新建文档，让灵感与资料在这里汇聚。'}</p><Button variant="outline" size="sm" className={styles.control} onClick={search || filter !== 'all' ? () => { setSearch(''); setFilter('all'); } : onCreate}>{search || filter !== 'all' ? '重置搜索与筛选' : '新建文档'}</Button></div> : null}
    </div>
    <dialog ref={uploadDialog} onCancel={() => setUploadOpen(false)} onClose={() => setUploadOpen(false)} className={styles.uploadDialog} aria-label="上传文档" onKeyDown={(event) => { if (event.key === 'Escape')
        setUploadOpen(false); }}><div className={styles.dialogHeader}><h2>上传文档</h2><button autoFocus aria-label="关闭上传" onClick={() => setUploadOpen(false)}><X size={20}/></button></div>{uploadOpen ? upload : null}</dialog>
  </section>;
}
