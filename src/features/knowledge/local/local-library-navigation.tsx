'use client';

import { useState } from 'react';
import { Clock, Folder, Plus, Tag, Trash } from '@phosphor-icons/react';
import { IconButton } from '../dense-sidebar/icon-button';
import { SidebarRow, SidebarSectionHeader, sidebarIconMap } from '../dense-sidebar/sidebar-navigation-primitives';
import { SIDEBAR_MAIN_ITEMS } from '../dense-sidebar/sidebar-navigation';
import { useI18n } from '../dense-sidebar/use-i18n';
import type { LocalDocument, LocalLibrary, LocalTag } from './local-library';

type MainView = 'all-documents' | 'starred' | 'drafts' | 'trash';
const emptyHintClassName = 'block w-full py-1 pl-10 pr-2 text-left text-[10px] leading-4 text-[var(--muted)]';

export function LocalLibraryNavigation({
  view, counts, selectedId, folderId, activeTagId, folders, documents, tags,
  onSelectMain, onSelectFolder, onSelectDocument, onSelectTag,
  onCreateFolder, onCreateDocument, onCreateTag, onRemoveTag,
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
  onCreateTag: (name: string) => void;
  onRemoveTag: (id: string) => void;
}) {
  const { t } = useI18n();
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const recent = [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 10);

  function submitTag(event: React.FormEvent) {
    event.preventDefault();
    const name = tagDraft.trim();
    if (!name) return;
    onCreateTag(name);
    setTagDraft('');
    setCreatingTag(false);
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
        {folders.map((folder) => <SidebarRow key={folder.id} icon={Folder} label={folder.name} count={documents.filter((doc) => doc.folderId === folder.id).length} selected={folderId === folder.id && !selectedId && !activeTagId} onClick={() => onSelectFolder(folder.id)} />)}
        {documents.filter((doc) => !doc.folderId).map((doc) => <SidebarRow key={doc.id} icon={sidebarIconMap.file} label={doc.title || '无标题文档'} selected={selectedId === doc.id} onClick={() => onSelectDocument(doc.id)} />)}
        {!documents.length ? <button type="button" onClick={onCreateDocument} className={`${emptyHintClassName} rounded-md hover:bg-[var(--surface-hover)]`}>暂无文档 · 新建第一个文档</button> : null}
      </div> : null}
    </section>

    <section className="mt-4" aria-label="标签">
      <SidebarSectionHeader icon={Tag} label="标签" count={tags.length} expanded={tagsOpen} onToggle={() => setTagsOpen((open) => !open)} actions={<IconButton label="新建标签" onClick={() => { setCreatingTag(true); setTagsOpen(true); }} className="rounded p-1 hover:bg-[var(--surface-hover)]"><Plus size={15} /></IconButton>} />
      {tagsOpen ? <div className="mt-1 space-y-0.5">
        {creatingTag ? <form onSubmit={submitTag} className="flex items-center gap-1 px-1 py-1"><input autoFocus aria-label="标签名称" value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setCreatingTag(false); setTagDraft(''); } }} className="min-w-0 flex-1 rounded border border-[var(--line)] bg-transparent px-1.5 py-1 text-xs outline-none focus:border-[var(--accent)]" /><button type="submit" disabled={!tagDraft.trim()} className="text-[11px] text-[var(--accent-ink)] disabled:opacity-40">创建</button></form> : null}
        {tags.map((tag) => <div key={tag.id} className="group/tag flex items-center"><div className="min-w-0 flex-1"><SidebarRow icon={Tag} label={tag.name} count={tag.pageIds.filter((id) => documents.some((doc) => doc.id === id)).length} selected={activeTagId === tag.id && !selectedId} onClick={() => onSelectTag(tag.id)} /></div><button type="button" aria-label={`删除标签 ${tag.name}`} onClick={() => onRemoveTag(tag.id)} className="hidden p-1 text-[var(--muted)] hover:text-[var(--err-ink)] group-hover/tag:block focus-visible:block"><Trash size={13} /></button></div>)}
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
