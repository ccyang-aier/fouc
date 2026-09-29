'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Link, MagnifyingGlass } from '@phosphor-icons/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { fetchKnowledgePages } from '../../../data/pages-api';
import styles from './block-reference.module.css';

export interface ReferenceBlockChoice { id: string; label: string; type: string }
interface PageChoice { id: string; title: string }

export function listReferenceBlocks(root: ProseMirrorNode): ReferenceBlockChoice[] {
  const blocks: ReferenceBlockChoice[] = [];
  root.descendants((node) => {
    const id = node.attrs.blockId;
    if (typeof id !== 'string' || !id) return;
    const label = node.textContent.trim().slice(0, 100);
    blocks.push({ id, label: label || `空白 ${node.type.name}`, type: node.type.name });
  });
  return blocks;
}

export function BlockReferencePicker({ workspaceId, excludePageId, getLocalPages, subscribeLocalPages, loadBlocks, onChoose, onCancel }: {
  workspaceId?: string;
  excludePageId: string;
  getLocalPages?: () => readonly PageChoice[];
  subscribeLocalPages?: (listener: () => void) => () => void;
  loadBlocks: (pageId: string) => Promise<ReferenceBlockChoice[]>;
  onChoose: (pageId: string, blockId: string) => void;
  onCancel?: () => void;
}) {
  const [, setRevision] = useState(0);
  const [remote, setRemote] = useState<{ workspaceId: string; pages: readonly PageChoice[]; failed: boolean }>({ workspaceId: '', pages: [], failed: false });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PageChoice | null>(null);
  const [blocks, setBlocks] = useState<ReferenceBlockChoice[]>([]);
  const [blockStatus, setBlockStatus] = useState<'idle' | 'loading' | 'failed'>('idle');
  useEffect(() => subscribeLocalPages?.(() => setRevision((value) => value + 1)), [subscribeLocalPages]);
  useEffect(() => {
    if (getLocalPages || !workspaceId) return;
    const controller = new AbortController();
    fetchKnowledgePages(workspaceId, {}, controller.signal)
      .then((items) => setRemote({ workspaceId, pages: items.filter((item) => item.kind !== 'row').map((item) => ({ id: item.id, title: item.title })), failed: false }))
      .catch(() => { if (!controller.signal.aborted) setRemote({ workspaceId, pages: [], failed: true }); });
    return () => controller.abort();
  }, [getLocalPages, workspaceId]);
  const pages = getLocalPages?.() ?? (remote.workspaceId === workspaceId ? remote.pages : []);
  const matches = pages.filter((page) => page.id !== excludePageId && page.title.toLowerCase().includes(query.toLowerCase()));
  const openPage = async (page: PageChoice) => {
    setSelected(page);
    setBlockStatus('loading');
    setBlocks([]);
    try { setBlocks(await loadBlocks(page.id)); setBlockStatus('idle'); }
    catch { setBlockStatus('failed'); }
  };
  return <div className={styles.picker} contentEditable={false}>
    <div className={styles.pickerHeader}><span className={styles.pickerIcon}><Link aria-hidden size={17} /></span><strong>引用文档内容</strong>{onCancel ? <button type="button" onClick={onCancel}>取消</button> : null}</div>
    {selected ? <>
      <button type="button" className={styles.back} onClick={() => { setSelected(null); setBlocks([]); }}><ArrowLeft aria-hidden size={15} />{selected.title}</button>
      <div className={styles.options} role="listbox" aria-label="选择引用块">
        {blockStatus === 'loading' ? <p>正在读取页面内容…</p> : blockStatus === 'failed' ? <p>读取失败，请重新选择页面。</p> : blocks.length ? blocks.map((block) => <button type="button" role="option" aria-selected={false} key={block.id} onClick={() => onChoose(selected.id, block.id)}><span><small>{block.type}</small>{block.label}</span><ArrowRight aria-hidden size={15} /></button>) : <p>这个页面还没有可引用的内容。</p>}
      </div>
    </> : <>
      <div className={styles.search}><MagnifyingGlass aria-hidden size={15} /><input aria-label="搜索来源页面" placeholder="搜索来源页面…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className={styles.options} role="listbox" aria-label="选择来源页面">
        {!getLocalPages && remote.workspaceId !== workspaceId ? <p>正在加载页面…</p> : remote.failed && !getLocalPages ? <p>页面列表暂不可用。</p> : matches.length ? matches.map((page) => <button type="button" role="option" aria-selected={false} key={page.id} onClick={() => void openPage(page)}><span>{page.title}</span><ArrowRight aria-hidden size={15} /></button>) : <p>{query ? '没有匹配的页面' : '还没有其他可引用的页面。'}</p>}
      </div>
    </>}
  </div>;
}
