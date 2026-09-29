'use client';

import { useState } from 'react';
import { ArrowSquareOut, Globe, LinkSimple, PencilSimple } from '@phosphor-icons/react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { safeKnowledgeUrl } from '@fouc/shared/knowledge/schema';
import styles from './embed.module.css';

function previewUrl(value: string): string | null {
  const safe = safeKnowledgeUrl(value, 'media');
  if (!safe || !/^https?:\/\//i.test(safe)) return null;
  const url = new URL(safe);
  const hostname = url.hostname.replace(/^www\./, '');
  if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
    const id = url.pathname.startsWith('/shorts/') ? url.pathname.split('/')[2] : url.searchParams.get('v');
    if (id && /^[\w-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  }
  if (hostname === 'youtu.be') {
    const id = url.pathname.slice(1);
    if (/^[\w-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  }
  if (hostname === 'vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
  }
  return safe;
}

export function EmbedNodeView({ node, editor, updateAttributes, HTMLAttributes }: NodeViewProps) {
  const source = String(node.attrs.url || '');
  const title = String(node.attrs.title || '网页嵌入');
  const preview = previewUrl(source);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(source);
  const [error, setError] = useState('');

  const save = () => {
    const safe = previewUrl(draft);
    if (!safe) { setError('请输入完整的 http:// 或 https:// 地址'); return; }
    updateAttributes({ url: draft.trim(), title: node.attrs.title || new URL(draft).hostname });
    setError('');
    setEditing(false);
  };

  return <NodeViewWrapper as="div" {...HTMLAttributes} data-fouc-node="embed" data-block-id={node.attrs.blockId} className={styles.root}>
    <div className={styles.header} contentEditable={false}>
      <span className={styles.title}><Globe aria-hidden size={16} />{title}</span>
      <span className={styles.actions}>
        {preview ? <a href={source} target="_blank" rel="noopener noreferrer" title="打开原网页" aria-label="打开原网页"><ArrowSquareOut aria-hidden size={16} /></a> : null}
        {editor.isEditable && source ? <button type="button" title="编辑嵌入" aria-label="编辑嵌入" onClick={() => { setDraft(source); setEditing(true); }}><PencilSimple aria-hidden size={16} /></button> : null}
      </span>
    </div>
    {preview && !editing ? <div className={styles.preview} contentEditable={false}><iframe title={title} src={preview} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-forms allow-popups allow-presentation" allowFullScreen /></div> : null}
    {(!source || editing) && editor.isEditable ? <div className={styles.setup} contentEditable={false}>
      <span className={styles.setupIcon}><LinkSimple aria-hidden size={22} /></span>
      <strong>嵌入网页</strong>
      <p>支持网页、YouTube 和 Vimeo 链接。</p>
      <input aria-label="嵌入标题" value={String(node.attrs.title || '')} placeholder="标题（可选）" onChange={(event) => updateAttributes({ title: event.target.value })} />
      <div className={styles.urlRow}><input type="url" aria-label="嵌入链接" value={draft} placeholder="https://…" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') save(); }} /><button type="button" onClick={save}>嵌入</button></div>
      {error ? <span role="alert" className={styles.error}>{error}</span> : null}
      {editing ? <button type="button" className={styles.cancel} onClick={() => setEditing(false)}>取消</button> : null}
    </div> : null}
    {preview && !editing ? <div className={styles.footer} contentEditable={false}><span>{new URL(source).hostname}</span><span>若网页拒绝嵌入，可在右上角打开原网页。</span></div> : null}
  </NodeViewWrapper>;
}
