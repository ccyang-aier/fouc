'use client';

/** Local storage is a resource capability, independent of account identity. */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FilePlus } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useIdentity } from '@/features/identity/identity-provider';
import { KnowledgeWorkbench } from '../knowledge-workbench';
import { PageTreeSidebar } from '../navigation/page-tree-sidebar';
import { SIDEBAR_MAIN_ITEMS } from '../dense-sidebar/sidebar-navigation';
import { useKnowledgeBaseSelection } from '../use-knowledge-base-selection';
import { useI18n } from '../dense-sidebar/use-i18n';
import { createLocalLibraryStore, emptyLocalLibrary, newLocalDocument, type LocalDocument } from './local-library';
import { LocalDocumentEditor } from './local-document-editor';
import { subscribeOpenPageTarget } from '../editor/open-target';
import { LocalLibraryNavigation } from './local-library-navigation';
import { LocalLibraryEmptyState } from './local-library-empty-state';
import { DocumentsPage } from '../documents/documents-page';
import { LocalDocumentImport } from '../documents/local-document-import';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { DotsThree } from '@phosphor-icons/react';
import { currentDocumentLinkTarget } from '../editor/document-link';

type View = 'all-documents' | 'starred' | 'drafts' | 'trash';
type Store = ReturnType<typeof createLocalLibraryStore>;

export function LocalKnowledgeResource({ workspaceId, ...props }: { workspaceId: string; onOpenSettings: () => void; onOpenWorkspace: () => void }) {
  const [{ store, error }] = useState<{ store: Store | null; error: string | null }>(() => {
    try { return { store: createLocalLibraryStore(window.localStorage, workspaceId), error: null }; }
    catch { return { store: null, error: '无法读取本机文档，请检查浏览器存储设置。' }; }
  });
  if (!store) return <div role="status" className="flex h-full items-center justify-center text-sm text-[var(--muted)]">{error ?? '正在打开本机知识库…'}</div>;
  return <LocalKnowledgeContent workspaceId={workspaceId} store={store} {...props} />;
}

function LocalKnowledgeContent({ workspaceId, store, onOpenSettings, onOpenWorkspace }: { workspaceId: string; store: Store; onOpenSettings: () => void; onOpenWorkspace: () => void }) {
  const library = useSyncExternalStore(store.subscribe, store.getSnapshot, () => emptyLocalLibrary);
  const { session, openSignIn } = useIdentity();
  const { t } = useI18n();
  const [baseId, setBaseId] = useKnowledgeBaseSelection(`${workspaceId}:local`, currentDocumentLinkTarget(workspaceId, 'local')?.knowledgeBaseId);
  const [view, setView] = useState<View>('all-documents');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => currentDocumentLinkTarget(workspaceId, 'local')?.pageId ?? null);
  const [collapsed, setCollapsed] = useState(false);
  const [editorSidebarOpen, setEditorSidebarOpen] = useState(false);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [creation, setCreation] = useState<'document' | 'base' | 'folder' | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => subscribeOpenPageTarget((target) => {
    if (target.workspaceId !== workspaceId) return;
    const page = store.getSnapshot().documents.find((item) => item.id === target.pageId && !item.deleted);
    if (!page) return;
    setBaseId(page.baseId);
    setSelectedId(page.id);
  }), [store, workspaceId, setBaseId]);
  const base = library.bases.find((item) => item.id === baseId) ?? library.bases[0];
  const documents = library.documents.filter((item) => item.baseId === base?.id);
  const folders = library.folders.filter((folder) => folder.knowledgeBaseId === base?.id);
  const live = documents.filter((item) => !item.deleted);
  const tags = library.tags.filter((tag) => tag.baseId === base?.id);
  const activeTag = tags.find((tag) => tag.id === activeTagId);
  const listed = live.filter((item) => activeTag ? activeTag.pageIds.includes(item.id) : !folderId || item.folderId === folderId);
  const visible = documents.filter((item) => view === 'trash' ? item.deleted : !item.deleted && (view === 'starred' ? item.starred : view === 'drafts' ? item.draft : true));
  const selected = live.find((item) => item.id === selectedId);
  const counts = { 'all-documents': live.length, starred: live.filter((item) => item.starred).length, drafts: live.filter((item) => item.draft).length, trash: documents.filter((item) => item.deleted).length };
  function write(change: Parameters<Store['update']>[0]) {
    try { store.update(change); setFailure(null); return true; }
    catch { setFailure('本机保存失败，修改未保存。请检查存储空间后重试。'); return false; }
  }
  function updateDocument(id: string, patch: Partial<LocalDocument>) {
    return write((current) => ({ ...current, documents: current.documents.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item) }));
  }
  function toggleDocumentTag(tagId: string, documentId: string) {
    write((current) => ({ ...current, tags: current.tags.map((tag) => tag.id === tagId ? { ...tag, pageIds: tag.pageIds.includes(documentId) ? tag.pageIds.filter((id) => id !== documentId) : [...tag.pageIds, documentId] } : tag) }));
  }
  const title = selected ? selected.title : SIDEBAR_MAIN_ITEMS.find((item) => item.id === view)?.labelKey;
  return <KnowledgeWorkbench
    documentOpen={Boolean(selected)}
    sidebarOpen={Boolean(selected) && editorSidebarOpen}
    onCloseSidebar={() => setEditorSidebarOpen(false)}
    sidebar={<PageTreeSidebar
      collapsed={selected ? false : collapsed}
      onCollapse={() => selected ? setEditorSidebarOpen(false) : setCollapsed(true)}
      knowledgeBases={library.bases}
      activeKnowledgeBaseId={base?.id ?? null}
      onSelectKnowledgeBase={(id) => { setBaseId(id); setSelectedId(null); setFolderId(null); setActiveTagId(null); setView('all-documents'); }}
      onCreateKnowledgeBase={() => setCreation('base')}
      onOpenSettings={onOpenSettings}
      onOpenWorkspace={onOpenWorkspace}
      treeArea={<LocalLibraryNavigation
        view={view}
        counts={counts}
        selectedId={selectedId}
        activeTagId={activeTagId}
        folders={folders}
        documents={live}
        tags={tags}
        onSelectMain={(next) => { setView(next); setSelectedId(null); setFolderId(null); setActiveTagId(null); }}
        onSelectDocument={setSelectedId}
        onCreateFolder={() => setCreation(base ? 'folder' : 'base')}
        onCreateDocument={() => setCreation(base ? 'document' : 'base')}
        onCreateDocumentInFolder={(id) => { setFolderId(id); setActiveTagId(null); setSelectedId(null); setView('all-documents'); setCreation('document'); }}
        onRenameFolder={(id, name) => write((current) => ({ ...current, folders: current.folders.map((folder) => folder.id === id ? { ...folder, name } : folder) }))}
        onRemoveFolder={(id) => { if (write((current) => ({ ...current, folders: current.folders.filter((folder) => folder.id !== id), documents: current.documents.map((doc) => doc.folderId === id ? { ...doc, folderId: undefined } : doc) })) && folderId === id) setFolderId(null); }}
        onCreateDocumentInTag={(id) => { setActiveTagId(id); setFolderId(null); setSelectedId(null); setView('all-documents'); setCreation('document'); }}
        onCreateTag={(name) => { if (base) write((current) => ({ ...current, tags: [...current.tags, { id: crypto.randomUUID(), baseId: base.id, name, pageIds: [] }] })); }}
        onRenameTag={(id, name) => write((current) => ({ ...current, tags: current.tags.map((tag) => tag.id === id ? { ...tag, name } : tag) }))}
        onRemoveTag={(id) => { write((current) => ({ ...current, tags: current.tags.filter((tag) => tag.id !== id) })); if (activeTagId === id) setActiveTagId(null); }}
      />}
    />}
    onExpandSidebar={collapsed ? () => setCollapsed(false) : undefined}
    overlays={<LocalCreationDialog kind={creation} onClose={() => setCreation(null)} onCreate={(name) => {
      if (creation === 'base') {
        const id = crypto.randomUUID();
        if (!write((current) => ({ ...current, bases: [...current.bases, { id, name }] }))) return;
        setBaseId(id); setSelectedId(null);
      } else if (creation === 'folder' && base) {
        const id = crypto.randomUUID();
        if (!write((current) => ({ ...current, folders: [...current.folders, { id, knowledgeBaseId: base.id, name }] }))) return;
        setFolderId(id); setSelectedId(null); setActiveTagId(null);
      } else {
        if (!base) return;
        const document = { ...newLocalDocument(base.id, name), folderId: folderId ?? folders[0]?.id };
        if (!write((current) => ({
          ...current,
          documents: [...current.documents, document],
          tags: activeTagId ? current.tags.map((tag) => tag.id === activeTagId ? { ...tag, pageIds: [...tag.pageIds, document.id] } : tag) : current.tags,
        }))) return;
        setSelectedId(document.id);
      }
      setCreation(null);
    }} />}
  >
      {!base ? <LocalLibraryEmptyState onCreate={() => setCreation('base')} /> : selected ? <LocalDocumentEditor key={selected.id} workspaceId={workspaceId} store={store} document={selected} collectionName={base.name} onChange={(patch) => updateDocument(selected.id, patch)} onBack={() => { setSelectedId(null); setEditorSidebarOpen(false); }} onToggleSidebar={() => setEditorSidebarOpen((open) => !open)} onCreateDocument={() => setCreation('document')} /> : view === 'all-documents' ? <DocumentsPage key={`${base.id}:${folderId ?? activeTagId ?? 'all'}`}
        onExpandSidebar={collapsed ? () => setCollapsed(false) : undefined}
        documents={listed.map((item) => ({ id: item.id, title: item.title, updatedAt: item.updatedAt, creator: item.creator ?? '我', source: item.source ?? '本机文档', status: item.indexStatus ?? '暂无状态', starred: item.starred, folderId: item.folderId }))}
        folders={activeTagId ? [] : folders.map((folder) => ({ id: folder.id, name: folder.name, count: live.filter((item) => item.folderId === folder.id).length, updatedAt: live.filter((item) => item.folderId === folder.id).map((item) => item.updatedAt).sort().at(-1) }))}
        onOpen={setSelectedId} onOpenFolder={setFolderId} onCreate={() => setCreation('document')} onCreateFolder={() => setCreation('folder')}
        upload={<LocalDocumentImport onImport={(items) => write((current) => ({ ...current, documents: [...current.documents, ...items.map((item) => ({ ...newLocalDocument(base.id, item.name), folderId: folderId ?? folders[0]?.id, body: { type: 'doc', content: item.text.split(/\r?\n/).map((text) => ({ type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}) })) } }))] }))} />}
        renderMenu={(id) => <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label="文档操作" className="p-2 text-slate-500"><DotsThree size={17} weight="bold" /></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setSelectedId(id)}>打开 / 编辑</DropdownMenuItem><DropdownMenuItem onSelect={() => { const item = live.find((doc) => doc.id === id); if (item) updateDocument(id, { starred: !item.starred }); }}>切换星标</DropdownMenuItem><DropdownMenuItem onSelect={() => { const item = live.find((doc) => doc.id === id); if (item) updateDocument(id, { draft: !item.draft }); }}>切换草稿</DropdownMenuItem><DropdownMenuSub><DropdownMenuSubTrigger>标签</DropdownMenuSubTrigger><DropdownMenuSubContent>{tags.length ? tags.map((tag) => <DropdownMenuCheckboxItem key={tag.id} checked={tag.pageIds.includes(id)} onCheckedChange={() => toggleDocumentTag(tag.id, id)}>{tag.name}</DropdownMenuCheckboxItem>) : <DropdownMenuItem disabled>暂无标签</DropdownMenuItem>}</DropdownMenuSubContent></DropdownMenuSub><DropdownMenuItem onSelect={() => updateDocument(id, { deleted: true })} className="text-red-600">移至回收站</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
      /> : <section className="h-full overflow-auto px-8 py-12 sm:px-14">
        <div className="mx-auto max-w-[860px]">
          <p className="mb-4 text-xs text-[var(--muted)]">{base?.name} <span className="ml-2 rounded-full bg-[var(--surface-subtle)] px-2 py-1 text-[10px]">本机 · 个人</span></p>
          <div className="mb-7 flex items-center justify-between"><h1 className="text-[26px] font-semibold tracking-tight">{title ? t(title) : '文档'}</h1>{view !== 'trash' ? <Button size="sm" variant="outline" onClick={() => setCreation('document')}><FilePlus size={15} />新建文档</Button> : null}</div>
          <p className="mb-6 text-xs leading-6 text-[var(--muted)]">本机文档仅保存在当前浏览器。登录不会自动上传内容；团队知识库、成员授权与云端协作需要 Fouc 账户。</p>
          {session.status === 'error' ? <div role="alert" className="mb-4 rounded-lg border border-[var(--line)] px-4 py-3 text-xs text-[var(--muted-strong)]">账户服务暂不可用，本机知识库仍可使用。<button type="button" onClick={openSignIn} className="ml-2 text-[var(--accent-ink)]">登录 / 重试</button></div> : null}
          <div className="overflow-hidden rounded-xl border border-[var(--line)]">
            {visible.map((item) => <div key={item.id} className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3 last:border-0 hover:bg-[var(--surface-hover)]">
              <button type="button" disabled={item.deleted} onClick={() => setSelectedId(item.id)} className="min-w-0 flex-1 truncate text-left text-xs">{item.title || '无标题文档'}</button>
              {item.deleted ? <><Button size="sm" variant="ghost" onClick={() => updateDocument(item.id, { deleted: false })}>恢复</Button><Button size="sm" variant="ghost" onClick={() => write((current) => ({ ...current, documents: current.documents.filter((doc) => doc.id !== item.id) }))}>彻底删除</Button></> : <span className="text-[10px] text-[var(--muted)]">{new Date(item.updatedAt).toLocaleDateString()}</span>}
            </div>)}
            {!visible.length ? <div className="py-12 text-center text-xs text-[var(--muted)]">{view === 'trash' ? '回收站是空的' : '还没有文档'}</div> : null}
          </div>
        </div>
      </section>}
      {failure ? <div role="alert" className="absolute bottom-4 left-4 right-4 rounded-lg bg-[var(--err-ink)] p-3 text-xs text-white">{failure}</div> : null}
  </KnowledgeWorkbench>;
}

function LocalCreationDialog({ kind, onClose, onCreate }: { kind: 'document' | 'base' | 'folder' | null; onClose: () => void; onCreate: (name: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  useEffect(() => { if (kind) dialog.current?.showModal(); else dialog.current?.close(); }, [kind]);
  return <dialog ref={dialog} aria-label={kind === 'base' ? '新建本机知识库' : kind === 'folder' ? '新建文件夹' : '新建本机文档'} onCancel={onClose} onClose={onClose} className="m-auto w-[400px] max-w-[calc(100vw-32px)] rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-7 text-[var(--ink)] shadow-xl backdrop:bg-black/25 backdrop:backdrop-blur-sm">
    <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) { onCreate(name.trim()); setName(''); } }}>
      <h2 className="mb-5 text-base font-semibold">{kind === 'base' ? '新建本机知识库' : kind === 'folder' ? '新建文件夹' : '新建文档'}</h2>
      <label className="block text-xs">名称<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 outline-none focus:border-[var(--accent)]" /></label>
      <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => { setName(''); onClose(); }}>取消</Button><Button type="submit" disabled={!name.trim()}>创建</Button></div>
    </form>
  </dialog>;
}
