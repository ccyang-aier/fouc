'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Link, MagnifyingGlass } from '@phosphor-icons/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { PageScope } from '@fouc/shared/knowledge/contracts';
import { fetchReferencePages, type ReferencePageChoice } from '../../../data/reference-pages';
import styles from './block-reference.module.css';

export interface ReferenceBlockChoice { id: string; label: string; type: string }

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

export function BlockReferencePicker({ knowledgeBaseId, excludePageId, getLocalPages, subscribeLocalPages, loadBlocks, onChoose, onCancel }: {
  knowledgeBaseId?: string;
  excludePageId: string;
  getLocalPages?: () => readonly ReferencePageChoice[];
  subscribeLocalPages?: (listener: () => void) => () => void;
  loadBlocks: (scope: PageScope) => Promise<ReferenceBlockChoice[]>;
  onChoose: (scope: PageScope, blockId: string) => void;
  onCancel?: () => void;
}) {
  const [, setRevision] = useState(0);
  const [remote, setRemote] = useState<{ knowledgeBaseId: string; pages: readonly ReferencePageChoice[]; failed: boolean }>({ knowledgeBaseId: '', pages: [], failed: false });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ReferencePageChoice | null>(null);
  const [blocks, setBlocks] = useState<ReferenceBlockChoice[]>([]);
  const [blockStatus, setBlockStatus] = useState<'idle' | 'loading' | 'failed'>('idle');
  useEffect(() => subscribeLocalPages?.(() => setRevision((value) => value + 1)), [subscribeLocalPages]);
  useEffect(() => {
    if (getLocalPages || !knowledgeBaseId) return;
    const controller = new AbortController();
    fetchReferencePages(controller.signal)
      .then(pages => { if (!controller.signal.aborted) setRemote({ knowledgeBaseId, pages, failed: false }); })
      .catch(() => { if (!controller.signal.aborted) setRemote({ knowledgeBaseId, pages: [], failed: true }); });
    return () => controller.abort();
  }, [getLocalPages, knowledgeBaseId]);
  const pages = getLocalPages?.() ?? (remote.knowledgeBaseId === knowledgeBaseId ? remote.pages : []);
  const matches = pages.filter(page => !(page.id === excludePageId && page.knowledgeBaseId === knowledgeBaseId) && page.title.toLowerCase().includes(query.toLowerCase()));
  const openPage = async (page: ReferencePageChoice) => {
    setSelected(page);
    setBlockStatus('loading');
    setBlocks([]);
    try { setBlocks(await loadBlocks({ knowledgeBaseId: page.knowledgeBaseId, pageId: page.id })); setBlockStatus('idle'); }
    catch { setBlockStatus('failed'); }
  };
  return <div className={styles.picker} contentEditable={false}>
    <div className={styles.pickerHeader}><span className={styles.pickerIcon}><Link aria-hidden size={17} /></span><strong>引用文档内容</strong>{onCancel ? <button type="button" onClick={onCancel}>取消</button> : null}</div>
    {selected ? <>
      <button type="button" className={styles.back} onClick={() => { setSelected(null); setBlocks([]); }}><ArrowLeft aria-hidden size={15} />{selected.title}</button>
      <div className={styles.options} role="listbox" aria-label="选择引用块">
        {blockStatus === 'loading' ? <p>正在读取页面内容…</p> : blockStatus === 'failed' ? <p>读取失败，请重新选择页面。</p> : blocks.length ? blocks.map((block) => <button type="button" role="option" aria-selected={false} key={block.id} onClick={() => onChoose({ knowledgeBaseId: selected.knowledgeBaseId, pageId: selected.id }, block.id)}><span><small>{block.type}</small>{block.label}</span><ArrowRight aria-hidden size={15} /></button>) : <p>这个页面还没有可引用的内容。</p>}
      </div>
    </> : <>
      <div className={styles.search}><MagnifyingGlass aria-hidden size={15} /><input aria-label="搜索来源页面" placeholder="搜索来源页面…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className={styles.options} role="listbox" aria-label="选择来源页面">
        {!getLocalPages && remote.knowledgeBaseId !== knowledgeBaseId ? <p>正在加载页面…</p> : remote.failed && !getLocalPages ? <p>页面列表暂不可用。</p> : matches.length ? matches.map((page) => <button type="button" role="option" aria-selected={false} key={`${page.knowledgeBaseId}:${page.id}`} onClick={() => void openPage(page)}><span>{page.knowledgeBaseName ? <small>{page.knowledgeBaseName}</small> : null}{page.title}</span><ArrowRight aria-hidden size={15} /></button>) : <p>{query ? '没有匹配的页面' : '还没有其他可引用的页面。'}</p>}
      </div>
    </>}
  </div>;
}
