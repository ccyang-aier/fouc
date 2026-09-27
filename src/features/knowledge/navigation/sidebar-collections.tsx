'use client';

import { useEffect, useState } from 'react';
import { CaretRight, Plus, Star, Tag, Trash } from '@phosphor-icons/react';
import type { Page } from '@fouc/shared/knowledge/contracts';
import { DialogButton, ModalDialog, NameField } from '../organization/ui';
import { NavigationDialogPortal } from './navigation-dialog-portal';
import { SidebarDocuments } from './sidebar-documents';
import { cn } from '@/lib/utils';

type Collections = { starred: string[]; tags: { id: string; name: string; pageIds: string[] }[] };
const stringList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

function readCollections(key: string): Collections {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? 'null') as Collections | null;
    if (parsed && stringList(parsed.starred) && Array.isArray(parsed.tags) && parsed.tags.every((tag) => tag && typeof tag.id === 'string' && typeof tag.name === 'string' && stringList(tag.pageIds))) return parsed;
  } catch { /* Browser storage may be unavailable; navigation still works in memory. */ }
  return { starred: [], tags: [] };
}

/** Personal navigation preferences, scoped by account and workspace; page content stays on the server. */
export function useSidebarCollections(userId: string, workspaceId: string | null) {
  const key = `fouc.knowledge.collections:${userId}:${workspaceId}`;
  const [collections, setCollections] = useState(() => readCollections(key));
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(collections)); } catch { /* Keep the in-memory preference. */ }
  }, [key, collections]);
  function toggleStar(id: string) {
    setCollections((current) => ({ ...current, starred: current.starred.includes(id) ? current.starred.filter((value) => value !== id) : [...current.starred, id] }));
  }
  return { collections, setCollections, toggleStar };
}

export function SidebarTags({ pages, collections, onChange, selectedPageId, onSelect }: {
  pages: readonly Page[];
  collections: Collections;
  onChange: (next: Collections) => void;
  selectedPageId: string | null;
  onSelect: (page: Page) => void;
}) {
  const [open, setOpen] = useState(true);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; pageIds: string[] } | null>(null);
  const [name, setName] = useState('');
  const [pageIds, setPageIds] = useState<string[]>([]);
  function edit(tag: NonNullable<typeof editing>) { setEditing(tag); setName(tag.name); setPageIds(tag.pageIds); }
  function save() {
    if (!editing || !name.trim()) return;
    const tag = { ...editing, name: name.trim(), pageIds };
    onChange({ ...collections, tags: [...collections.tags.filter((item) => item.id !== tag.id), tag] });
    setExpandedTag(tag.id);
    setEditing(null);
  }
  return <section className="mt-[13px]">
    <div className="group/tags flex h-[30px] items-center gap-1 rounded-md px-1.5">
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-[var(--muted-strong)]"><Tag size={15} />标签<CaretRight size={10} weight="fill" className={cn('transition-transform', open && 'rotate-90')} /></button>
      <button type="button" aria-label="新建标签" title="新建个人标签" onClick={() => edit({ id: crypto.randomUUID(), name: '', pageIds: [] })} className="ml-auto flex size-5 items-center justify-center rounded text-[var(--muted)] opacity-0 hover:bg-[var(--surface-hover)] group-hover/tags:opacity-100 focus-visible:opacity-100"><Plus size={14} /></button>
    </div>
    {open ? collections.tags.map((tag) => <div key={tag.id}>
      <div className="group/tag flex h-[30px] items-center gap-1 pl-5">
        <button type="button" aria-expanded={expandedTag === tag.id} onClick={() => setExpandedTag((current) => current === tag.id ? null : tag.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-[12px] text-[var(--ink-soft)]"><Tag size={13} className="shrink-0 text-[#ada34e]" /><span className="truncate">{tag.name}</span></button>
        <button type="button" aria-label={`编辑标签「${tag.name}」`} onClick={() => edit(tag)} className="text-[10px] text-[var(--muted)] opacity-0 group-hover/tag:opacity-100 focus-visible:opacity-100">编辑</button>
      </div>
      {expandedTag === tag.id ? <SidebarDocuments pages={pages.filter((page) => tag.pageIds.includes(page.id))} selectedPageId={selectedPageId} onSelect={onSelect} indented /> : null}
    </div>) : null}
    {editing ? <NavigationDialogPortal><ModalDialog open onClose={() => setEditing(null)} title={editing?.name ? '编辑个人标签' : '新建个人标签'} description="标签与星标保存在当前浏览器，按账号和工作区独立记录。" footer={<><DialogButton onClick={() => setEditing(null)}>取消</DialogButton><DialogButton variant="primary" disabled={!name.trim()} onClick={save}>保存</DialogButton></>}>
      <NameField label="标签名称" value={name} onChange={setName} autoFocus onSubmit={save} maxLength={80} />
      <fieldset className="mt-4 max-h-48 space-y-2 overflow-y-auto"><legend className="mb-2 text-[11px] text-[var(--muted)]">关联文档</legend>{pages.map((page) => <label key={page.id} className="flex items-center gap-2 text-[12px] text-[var(--ink-soft)]"><input type="checkbox" checked={pageIds.includes(page.id)} onChange={(event) => setPageIds((current) => event.target.checked ? [...current, page.id] : current.filter((id) => id !== page.id))} />{page.title || '无标题页面'}</label>)}</fieldset>
      {editing && collections.tags.some((tag) => tag.id === editing.id) ? <button type="button" onClick={() => { onChange({ ...collections, tags: collections.tags.filter((tag) => tag.id !== editing.id) }); setEditing(null); }} className="mt-4 flex items-center gap-1 text-[11px] text-[var(--err-ink)]"><Trash size={13} />删除个人标签（保留文档）</button> : null}
    </ModalDialog></NavigationDialogPortal> : null}
  </section>;
}

export function SidebarStarButton({ starred, onToggle }: { starred: boolean; onToggle: () => void }) {
  return <button type="button" aria-label={starred ? '取消文档星标' : '星标文档'} aria-pressed={starred} onClick={onToggle} className={cn('flex size-5 shrink-0 items-center justify-center rounded opacity-0 hover:bg-[var(--surface-hover)] group-hover/document:opacity-100 focus-visible:opacity-100', starred && 'opacity-100 text-[#e9ad16]')}><Star size={13} weight={starred ? 'fill' : 'regular'} /></button>;
}
