'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, FileText, MagnifyingGlass, PencilSimple } from '@phosphor-icons/react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { fetchKnowledgePages } from '../../../data/pages-api';
import { requestOpenPageBlock } from '../../open-target';
import styles from './page-link.module.css';

interface PageChoice { id: string; title: string }

export function PageLinkNodeView({ workspaceId, getLocalPages, ...props }: NodeViewProps & { workspaceId?: string; getLocalPages?: () => readonly PageChoice[] }) {
  const { node, editor, updateAttributes, HTMLAttributes } = props;
  const pageId = String(node.attrs.pageId || '');
  const title = String(node.attrs.title || '页面链接');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<{ workspaceId: string; pages: readonly PageChoice[]; status: 'idle' | 'failed' }>({ workspaceId: '', pages: [], status: 'idle' });
  const selecting = open || !pageId;

  useEffect(() => {
    if (!selecting || getLocalPages || !workspaceId) return;
    const controller = new AbortController();
    fetchKnowledgePages(workspaceId, {}, controller.signal)
      .then((items) => { setRemote({ workspaceId, pages: items.filter((item) => item.kind !== 'row').map((item) => ({ id: item.id, title: item.title })), status: 'idle' }); })
      .catch(() => { if (!controller.signal.aborted) setRemote({ workspaceId, pages: [], status: 'failed' }); });
    return () => controller.abort();
  }, [selecting, workspaceId, getLocalPages]);

  const pages = getLocalPages?.() ?? (remote.workspaceId === workspaceId ? remote.pages : []);
  const status = getLocalPages ? 'idle' : remote.workspaceId === workspaceId ? remote.status : 'loading';
  const matches = pages.filter((page) => page.title.toLowerCase().includes(query.toLowerCase())).slice(0, 30);

  return <NodeViewWrapper as="div" {...HTMLAttributes} data-fouc-node="page-link" data-block-id={node.attrs.blockId} className={styles.root}>
    {pageId && !open ? <div className={styles.card} contentEditable={false}>
      <span className={styles.icon}><FileText aria-hidden size={20} weight="duotone" /></span>
      <span className={styles.cardText}><strong>{title}</strong><small>工作空间页面</small></span>
      {editor.isEditable ? <button type="button" className={styles.edit} title="更换页面" aria-label="更换页面" onClick={() => setOpen(true)}><PencilSimple aria-hidden size={16} /></button> : null}
      {workspaceId ? <button type="button" className={styles.open} title="打开页面" aria-label={`打开${title}`} onClick={() => requestOpenPageBlock({ workspaceId, pageId })}><ArrowRight aria-hidden size={17} /></button> : null}
    </div> : editor.isEditable ? <div className={styles.picker} contentEditable={false}>
      <div className={styles.pickerTitle}><FileText aria-hidden size={17} />选择工作空间内的页面</div>
      <div className={styles.search}><MagnifyingGlass aria-hidden size={16} /><input autoFocus aria-label="搜索页面" placeholder="搜索页面名称…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className={styles.results} role="listbox" aria-label="页面选择">
        {status === 'loading' ? <p>正在加载页面…</p> : status === 'failed' ? <p>页面列表暂不可用，请稍后重试。</p> : matches.length ? matches.map((page) => <button type="button" role="option" aria-selected={page.id === pageId} key={page.id} onClick={() => { updateAttributes({ pageId: page.id, title: page.title }); setOpen(false); setQuery(''); }}><FileText aria-hidden size={15} /><span>{page.title}</span>{page.id === pageId ? <small>当前</small> : null}</button>) : <p>{query ? '没有匹配的页面' : '此工作空间暂无页面'}</p>}
      </div>
      {pageId ? <button type="button" className={styles.cancel} onClick={() => setOpen(false)}>取消</button> : null}
    </div> : <div className={styles.unconfigured} contentEditable={false}>尚未选择页面</div>}
  </NodeViewWrapper>;
}
