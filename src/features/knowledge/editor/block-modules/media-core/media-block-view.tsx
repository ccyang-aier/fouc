'use client';

import { useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, ReactNode } from 'react';
import { ArrowSquareOut, CloudArrowUp, LinkSimple, PencilSimple, Trash } from '@phosphor-icons/react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { safeKnowledgeUrl } from '@fouc/shared/knowledge/schema';
import { readLocalAsset, saveLocalAsset } from '../../../assets/local-assets';
import { knowledgeAssetsApi } from '../../../assets/assets-api';
import { useAssetUploads } from '../../../assets/use-asset-uploads';
import styles from './media-block.module.css';

export type MediaKind = 'image' | 'video' | 'audio' | 'file';
export interface ResolvedMedia { url: string; name: string; mime: string; size: number | null }

const LABELS: Record<MediaKind, string> = { image: '图片', video: '视频', audio: '音频', file: '文件' };
const ACCEPT: Record<MediaKind, string> = { image: 'image/*', video: 'video/*', audio: 'audio/*', file: '*' };

function useResolvedMedia(source: string, localWorkspaceId?: string, workspaceId?: string) {
  const sourceKey = `${localWorkspaceId ? `local:${localWorkspaceId}` : `remote:${workspaceId ?? ''}`}:${source}`;
  const [result, setResult] = useState<{ sourceKey: string; value: ResolvedMedia | null; error: string | null }>({ sourceKey: '', value: null, error: null });
  useEffect(() => {
    let canceled = false;
    let objectUrl: string | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const safe = safeKnowledgeUrl(source, 'media');
    if (!safe?.startsWith('asset:')) return;
    if (localWorkspaceId) {
      readLocalAsset(localWorkspaceId, safe).then((asset) => {
        if (canceled) return;
        if (!asset) { setResult({ sourceKey, value: null, error: '本机资源不存在，可能已被浏览器清理' }); return; }
        objectUrl = URL.createObjectURL(asset.blob);
        setResult({ sourceKey, value: { url: objectUrl, name: asset.name, mime: asset.mime, size: asset.size }, error: null });
      }).catch(() => { if (!canceled) setResult({ sourceKey, value: null, error: '无法读取本机资源' }); });
    } else if (workspaceId) {
      const refresh = () => knowledgeAssetsApi.download(workspaceId, safe.slice(6)).then((grant) => {
        if (canceled) return;
        setResult({ sourceKey, value: { url: grant.url, name: '', mime: '', size: null }, error: null });
        refreshTimer = setTimeout(refresh, Math.max(10_000, new Date(grant.expiresAt).getTime() - Date.now() - 60_000));
      }).catch(() => { if (!canceled) setResult({ sourceKey, value: null, error: '无法读取团队资源，请检查权限或存储服务。' }); });
      void refresh();
    }
    return () => { canceled = true; if (refreshTimer) clearTimeout(refreshTimer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [source, sourceKey, localWorkspaceId, workspaceId]);
  if (!source) return { value: null, error: null };
  const safe = safeKnowledgeUrl(source, 'media');
  if (!safe) return { value: null, error: '资源地址不安全或格式无效' };
  if (!safe.startsWith('asset:')) return { value: { url: safe, name: '', mime: '', size: null }, error: null };
  if (!localWorkspaceId && !workspaceId) return { value: null, error: '此资源尚未连接可访问的存储服务' };
  return result.sourceKey === sourceKey ? result : { value: null, error: null };
}

export function MediaBlockView({ kind, localWorkspaceId, workspaceId, renderPreview, ...props }: NodeViewProps & {
  kind: MediaKind;
  localWorkspaceId?: string;
  workspaceId?: string;
  renderPreview: (source: ResolvedMedia) => ReactNode;
}) {
  const { node, editor, updateAttributes, HTMLAttributes } = props;
  const [editing, setEditing] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const source = String(node.attrs.src ?? '');
  const resolved = useResolvedMedia(source, localWorkspaceId, workspaceId);
  const uploads = useAssetUploads({ workspaceId: workspaceId ?? '', onUploaded: (asset) => {
    updateAttributes({ src: `asset:${asset.hash}`, title: asset.name, mime: asset.mime, alt: kind === 'image' ? asset.name : node.attrs.alt });
    setEditing(false);
  } });
  const latestUpload = uploads.items.at(-1);

  const importFile = async (file: File) => {
    if (!localWorkspaceId && !workspaceId) return;
    if (kind !== 'file' && !file.type.startsWith(`${kind}/`)) { setError(`请选择${LABELS[kind]}文件`); return; }
    setError(null);
    if (workspaceId && !localWorkspaceId) { uploads.addFiles([file]); return; }
    setProgress(0);
    try {
      const stored = await saveLocalAsset(localWorkspaceId!, file, (ratio) => setProgress(ratio));
      updateAttributes({ src: stored, title: file.name, mime: file.type || null, alt: kind === 'image' ? file.name : node.attrs.alt });
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '文件保存失败');
    } finally { setProgress(null); }
  };

  const saveUrl = () => {
    const safe = safeKnowledgeUrl(urlDraft, 'media');
    if (!safe || !/^https?:\/\//i.test(safe)) { setError('请输入完整的 http:// 或 https:// 地址'); return; }
    updateAttributes({ src: safe, title: node.attrs.title || new URL(safe).pathname.split('/').at(-1) || LABELS[kind] });
    setError(null);
    setEditing(false);
  };

  const title = String(node.attrs.title || resolved.value?.name || LABELS[kind]);
  const caption = String(node.attrs.caption || '');

  return (
    <NodeViewWrapper as="figure" {...HTMLAttributes} data-fouc-node={kind} data-block-id={node.attrs.blockId} data-kind={kind} className={styles.root}
      onDragOver={(event: ReactDragEvent<HTMLElement>) => { if ((!localWorkspaceId && !workspaceId) || !editor.isEditable || !event.dataTransfer.types.includes('Files')) return; event.preventDefault(); setDragging(true); }}
      onDragLeave={(event: ReactDragEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={(event: ReactDragEvent<HTMLElement>) => { if ((!localWorkspaceId && !workspaceId) || !editor.isEditable) return; event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void importFile(file); }}
    >
      <div className={styles.header} contentEditable={false}>
        <span className={styles.kind}><span aria-hidden className={styles.kindDot} />{LABELS[kind]}</span>
        <div className={styles.actions}>
          {source && resolved.value ? <a href={resolved.value.url} target="_blank" rel="noopener noreferrer" aria-label={`打开${LABELS[kind]}`} title={`打开${LABELS[kind]}`} className={styles.action}><ArrowSquareOut aria-hidden size={15} /></a> : null}
          {editor.isEditable && source ? <button type="button" className={styles.action} title="更换资源" aria-label="更换资源" onClick={() => { setUrlDraft(/^https?:/.test(source) ? source : ''); setEditing(true); }}><PencilSimple aria-hidden size={15} /></button> : null}
          {editor.isEditable && source ? <button type="button" className={styles.action} title="清除资源" aria-label="清除资源" onClick={() => updateAttributes({ src: '' })}><Trash aria-hidden size={15} /></button> : null}
        </div>
      </div>
      {source && resolved.value && !editing ? <div className={styles.preview} contentEditable={false}>{renderPreview(resolved.value)}</div> : null}
      {source && resolved.error && !editing ? <div className={styles.errorState} role="status">{resolved.error}{editor.isEditable ? <button type="button" onClick={() => setEditing(true)}>更换资源</button> : null}</div> : null}
      {(!source || editing) && editor.isEditable ? (
        <div className={styles.setup} data-dragging={String(dragging)} contentEditable={false}>
          <div className={styles.setupIcon}><CloudArrowUp aria-hidden size={23} weight="duotone" /></div>
          <strong>{source ? `更换${LABELS[kind]}` : `添加${LABELS[kind]}`}</strong>
          <p>{localWorkspaceId || workspaceId ? '拖入文件，或从本机选择' : '粘贴可访问的网络地址'}</p>
          {localWorkspaceId || workspaceId ? <><button type="button" className={styles.primary} disabled={progress !== null} onClick={() => inputRef.current?.click()}>选择文件</button><input ref={inputRef} type="file" accept={ACCEPT[kind]} className={styles.hiddenInput} aria-label={`选择${LABELS[kind]}文件`} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ''; }} /></> : null}
          {progress !== null ? <div className={styles.progress} role="status">正在保存 · {Math.round(progress * 100)}%<span style={{ width: `${progress * 100}%` }} /></div> : null}
          {latestUpload && latestUpload.phase !== 'done' ? <div className={styles.progress} role="status">
            {latestUpload.phase === 'error' ? latestUpload.error?.detail || '上传失败，请重试' : latestUpload.phase === 'hashing' ? '正在计算文件指纹' : latestUpload.phase === 'preparing' ? '正在准备上传' : latestUpload.phase === 'uploading' ? '正在上传' : latestUpload.phase === 'confirming' ? '正在确认文件' : '已取消'}
            {latestUpload.phase === 'hashing' || latestUpload.phase === 'uploading' ? ` · ${Math.round(latestUpload.progress * 100)}%` : null}
            <span style={{ width: `${latestUpload.progress * 100}%` }} />
            {latestUpload.phase === 'error' || latestUpload.phase === 'canceled' ? <button type="button" onClick={() => uploads.retry(latestUpload.id)}>重试</button> : <button type="button" onClick={() => uploads.cancel(latestUpload.id)}>取消</button>}
          </div> : null}
          <div className={styles.urlRow}><LinkSimple aria-hidden size={15} /><input type="url" aria-label={`${LABELS[kind]}网络地址`} placeholder="https://…" value={urlDraft} onChange={(event) => setUrlDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveUrl(); }} /><button type="button" onClick={saveUrl}>使用地址</button></div>
          {editing ? <button type="button" className={styles.cancel} onClick={() => { setEditing(false); setError(null); }}>取消</button> : null}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>
      ) : null}
      {source && !editing ? <div className={styles.meta} contentEditable={false}>
        {kind === 'image' ? <input aria-label="图片替代文本" disabled={!editor.isEditable} placeholder="图片替代文本" value={String(node.attrs.alt || '')} onChange={(event) => updateAttributes({ alt: event.target.value })} /> : <span className={styles.title}>{title}</span>}
        {editor.isEditable ? <input aria-label={`${LABELS[kind]}说明`} placeholder="添加说明…" value={caption} onChange={(event) => updateAttributes({ caption: event.target.value })} /> : caption ? <span>{caption}</span> : null}
      </div> : null}
    </NodeViewWrapper>
  );
}
