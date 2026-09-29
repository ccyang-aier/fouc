'use client';

import { useEffect, useRef, useState } from 'react';
import { CaretRight, Clock, DotsThree, Folder, PencilSimple, Plus, Tag, Trash } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { IconButton } from '../dense-sidebar/icon-button';
import { SidebarRow, SidebarSectionHeader, sidebarIconMap } from '../dense-sidebar/sidebar-navigation-primitives';
import { SIDEBAR_MAIN_ITEMS } from '../dense-sidebar/sidebar-navigation';
import { useI18n } from '../dense-sidebar/use-i18n';
import styles from '../dense-sidebar/sidebar-interactions.module.css';
import type { LocalDocument, LocalLibrary, LocalTag } from './local-library';

type MainView = 'all-documents' | 'starred' | 'drafts' | 'trash';
const tagColors = ['#5582c4', '#cb805c', '#5d9d83', '#a87ac0', '#d6a24c', '#688aab'] as const;
const emptyHintClassName = 'px-1 py-1 text-[11px] leading-4 text-[var(--muted)]';

export function LocalLibraryNavigation({
  view, counts, selectedId, folderId, activeTagId, folders, documents, tags,
  onSelectMain, onSelectFolder, onSelectDocument, onSelectTag,
  onCreateFolder, onCreateDocument, onCreateDocumentInTag, onCreateTag, onRenameTag, onRemoveTag,
}: {
  view: MainView;
  counts: Record<MainView, number>;
  selectedId: string | null;
  folderId: string | null;
  activeTagId: string | null;
  folders: LocalLibrary['folders'];
  documents: LocalDocument[];
  tags: LocalTag[];
  onSelectMain: (view: MainView) => void;
  onSelectFolder: (id: string) => void;
  onSelectDocument: (id: string) => void;
  onSelectTag: (id: string) => void;
  onCreateFolder: () => void;
  onCreateDocument: () => void;
  onCreateDocumentInTag: (id: string) => void;
  onCreateTag: (name: string) => void;
  onRenameTag: (id: string, name: string) => void;
  onRemoveTag: (id: string) => void;
}) {
  const { t } = useI18n();
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [expandedTagIds, setExpandedTagIds] = useState<string[]>([]);
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const recent = [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 10);

  useEffect(() => {
    if (!renamingTagId) return;
    const frame = requestAnimationFrame(() => renameInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [renamingTagId]);

  function submitTag(event: React.FormEvent) {
    event.preventDefault();
    const name = tagDraft.trim();
    if (!name) return;
    onCreateTag(name);
    setTagDraft('');
    setCreatingTag(false);
  }

  function renameTag(id: string) {
    const name = renameDraft.trim();
    if (name) onRenameTag(id, name);
    setRenamingTagId(null);
  }

  function toggleTag(id: string) {
    setExpandedTagIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
    <nav aria-label="本机知识库导航" className="space-y-1">
      {SIDEBAR_MAIN_ITEMS.map((item) => <SidebarRow
        key={item.id}
        icon={sidebarIconMap[item.icon]}
        iconTone={item.tone}
        label={t(item.labelKey)}
        count={counts[item.id as MainView]}
        selected={!selectedId && !activeTagId && item.id === view}
        onClick={() => onSelectMain(item.id as MainView)}
      />)}
    </nav>

    <section className="mt-5" aria-label="文件夹">
      <SidebarSectionHeader icon={Folder} label="文件夹" count={folders.length} expanded={foldersOpen} onToggle={() => setFoldersOpen((open) => !open)} actions={<IconButton label="新建文件夹" onClick={onCreateFolder} className="rounded p-1 hover:bg-[var(--surface-hover)]"><Plus size={15} /></IconButton>} />
      {foldersOpen ? <div className="mt-1 space-y-0.5">
        {folders.map((folder) => {
          const folderDocuments = documents.filter((doc) => doc.folderId === folder.id);
          const expanded = expandedFolderIds.includes(folder.id);
          return <div key={folder.id}>
            <div className={cn(styles.row, 'group flex h-[30px] items-center rounded-[6px] pl-[14px] pr-1 text-[13px] text-[var(--sidebar-text)]')} data-selected={folderId === folder.id && !selectedId && !activeTagId ? 'true' : undefined}>
              <button type="button" aria-label={`${expanded ? '收起' : '展开'}文件夹 ${folder.name}`} aria-expanded={expanded} onClick={() => setExpandedFolderIds((current) => expanded ? current.filter((id) => id !== folder.id) : [...current, folder.id])} className="mr-1 flex size-4 shrink-0 items-center justify-center rounded text-[var(--muted)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"><CaretRight size={11} weight="bold" className={cn('transition-transform', expanded && 'rotate-90')} /></button>
              <button type="button" onClick={() => onSelectFolder(folder.id)} className="flex h-full min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"><Folder aria-hidden size={15} weight="fill" className="shrink-0 text-[#7c8387]" /><span className="truncate">{folder.name}</span></button>
              <span className="pl-2 pr-0.5 text-[10.5px] tabular-nums text-[#8b9093]">{folderDocuments.length}</span>
            </div>
            {expanded ? <div className="space-y-0.5">
              {folderDocuments.map((doc) => <SidebarRow key={doc.id} depth={2} icon={sidebarIconMap.file} label={doc.title || '无标题文档'} selected={selectedId === doc.id} onClick={() => onSelectDocument(doc.id)} />)}
              {!folderDocuments.length ? <p className="py-1 pl-9 text-[11px] leading-4 text-[var(--muted)]">暂无文档</p> : null}
            </div> : null}
          </div>;
        })}
        {documents.filter((doc) => !doc.folderId).map((doc) => <SidebarRow key={doc.id} depth={1} icon={sidebarIconMap.file} label={doc.title || '无标题文档'} selected={selectedId === doc.id} onClick={() => onSelectDocument(doc.id)} />)}
        {!folders.length && !documents.length ? <p className={emptyHintClassName}><button type="button" onClick={onCreateDocument} className="rounded text-left [font:inherit] hover:text-[var(--ink)]">暂无文档 · 新建第一个文档</button></p> : null}
      </div> : null}
    </section>

    <section className="mt-4" aria-label="标签">
      <SidebarSectionHeader icon={Tag} label="标签" count={tags.length} expanded={tagsOpen} onToggle={() => setTagsOpen((open) => !open)} actions={<IconButton label="新建标签" onClick={() => { setCreatingTag(true); setTagsOpen(true); }} className="rounded p-1 hover:bg-[var(--surface-hover)]"><Plus size={15} /></IconButton>} />
      {tagsOpen ? <div className="mt-1 space-y-0.5">
        {creatingTag ? <form onSubmit={submitTag} className="flex items-center gap-1 px-1 py-1"><input autoFocus aria-label="标签名称" value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setCreatingTag(false); setTagDraft(''); } }} className="min-w-0 flex-1 rounded border border-[var(--line)] bg-transparent px-1.5 py-1 text-xs outline-none focus:border-[var(--accent)]" /><button type="submit" disabled={!tagDraft.trim()} className="text-[11px] text-[var(--accent-ink)] disabled:opacity-40">创建</button></form> : null}
        {tags.map((tag, index) => {
          const taggedDocuments = documents.filter((doc) => tag.pageIds.includes(doc.id));
          const expanded = expandedTagIds.includes(tag.id);
          const selected = activeTagId === tag.id && !selectedId;
          return <div key={tag.id}>
            <div data-selected={selected ? 'true' : undefined} className={cn(styles.row, 'group flex h-[30px] items-center rounded-[6px] pl-[16px] pr-1 text-[12px] text-[var(--sidebar-text)]')}>
              <button type="button" aria-label={`${expanded ? '收起' : '展开'}标签 ${tag.name}`} aria-expanded={expanded} onClick={() => toggleTag(tag.id)} className="mr-1 flex size-4 shrink-0 items-center justify-center rounded text-[var(--muted)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"><CaretRight size={11} weight="bold" className={cn('transition-transform', expanded && 'rotate-90')} /></button>
              {renamingTagId === tag.id ? <form onSubmit={(event) => { event.preventDefault(); renameTag(tag.id); }} className="min-w-0 flex-1"><input ref={renameInputRef} aria-label={`重命名标签 ${tag.name}`} value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} onBlur={() => renameTag(tag.id)} onKeyDown={(event) => { if (event.key === 'Escape') { setRenamingTagId(null); event.stopPropagation(); } }} className="h-6 w-full rounded border border-[var(--focus-ring)] bg-[var(--panel)] px-1 text-[12px] outline-none" /></form> : <button type="button" aria-current={selected ? 'page' : undefined} onClick={() => { onSelectTag(tag.id); setExpandedTagIds((current) => current.includes(tag.id) ? current : [...current, tag.id]); }} className="flex h-full min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"><span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tagColors[index % tagColors.length] }} /><span className="truncate">{tag.name}</span></button>}
              <div className={styles.trailing}>
                <div className={cn(styles.actions, 'flex items-center gap-0.5')}>
                  <IconButton label={`在${tag.name}中新建文档`} className={styles.actionButton} onClick={() => onCreateDocumentInTag(tag.id)}><Plus size={14} /></IconButton>
                  <DropdownMenu><DropdownMenuTrigger asChild><IconButton label={`${tag.name}更多操作`} className={styles.actionButton}><DotsThree size={15} weight="bold" /></IconButton></DropdownMenuTrigger><DropdownMenuContent align="end" onCloseAutoFocus={(event) => { if (renamingTagId === tag.id) event.preventDefault(); }}><DropdownMenuItem onSelect={() => { setRenameDraft(tag.name); setRenamingTagId(tag.id); }}><PencilSimple />重命名</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-red-600" onSelect={() => onRemoveTag(tag.id)}><Trash />删除标签</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                </div>
                {!selected ? <span className={styles.count}>{taggedDocuments.length}</span> : null}
              </div>
            </div>
            {expanded ? <div className="space-y-0.5">
              {taggedDocuments.map((doc) => <SidebarRow key={doc.id} depth={1} icon={sidebarIconMap.file} label={doc.title || '无标题文档'} selected={selectedId === doc.id} onClick={() => onSelectDocument(doc.id)} />)}
              {!taggedDocuments.length ? <p className={emptyHintClassName}>暂无文档</p> : null}
            </div> : null}
          </div>;
        })}
        {!tags.length && !creatingTag ? <p className={emptyHintClassName}>暂无标签</p> : null}
      </div> : null}
    </section>

    <section className="mt-4" aria-label="最近">
      <SidebarSectionHeader icon={Clock} label="最近" count={recent.length} expanded={recentOpen} onToggle={() => setRecentOpen((open) => !open)} />
      {recentOpen ? <div className="mt-1 space-y-0.5">
        {recent.map((doc) => <SidebarRow key={doc.id} icon={sidebarIconMap.file} label={doc.title || '无标题文档'} selected={selectedId === doc.id} onClick={() => onSelectDocument(doc.id)} />)}
        {!recent.length ? <p className={emptyHintClassName}>暂无最近文档</p> : null}
      </div> : null}
    </section>
  </div>;
}
