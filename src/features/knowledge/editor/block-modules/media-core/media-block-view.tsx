'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, ReactNode } from 'react';
import { ArrowSquareOut, Image as ImageIcon, MusicNotes, Paperclip, PencilSimple, Video } from '@phosphor-icons/react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { safeKnowledgeUrl } from '@fouc/shared/knowledge/schema';
import { readLocalAsset, saveLocalAsset } from '../../../assets/local-assets';
import { knowledgeAssetsApi } from '../../../assets/assets-api';
import { useAssetUploads } from '../../../assets/use-asset-uploads';
import { takeInsertedMedia } from './insert-media';
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
  kind: MediaKind; localWorkspaceId?: string; workspaceId?: string;
  renderPreview: (source: ResolvedMedia) => ReactNode;
}) {
  const { node, editor, updateAttributes, HTMLAttributes } = props;
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const source = String(node.attrs.src ?? '');
  const resolved = useResolvedMedia(source, localWorkspaceId, workspaceId);
  const uploaded = useCallback((asset: { hash: string; name: string; mime: string }) => {
    updateAttributes({ src: 'asset:' + asset.hash, title: asset.name, mime: asset.mime, ...(kind === 'image' ? { alt: asset.name } : {}) });
  }, [updateAttributes, kind]);
  const uploads = useAssetUploads({ workspaceId: workspaceId ?? '', onUploaded: uploaded });
  const { addFiles } = uploads;
  const latestUpload = uploads.items.at(-1);
  const importFile = useCallback(async (file: File) => {
    if (!localWorkspaceId && !workspaceId) { setError('文档尚未连接资源存储。'); return; }
    if (kind !== 'file' && !file.type.startsWith(kind + '/')) { setError('请选择' + LABELS[kind] + '文件'); return; }
    setError(null);
    if (workspaceId && !localWorkspaceId) { addFiles([file]); return; }
    setProgress(0);
    try {
      const stored = await saveLocalAsset(localWorkspaceId!, file, ratio => setProgress(ratio));
      updateAttributes({ src: stored, title: file.name, mime: file.type || null, ...(kind === 'image' ? { alt: file.name } : {}) });
    } catch (cause) { setError(cause instanceof Error ? cause.message : '文件保存失败'); }
    finally { setProgress(null); }
  }, [localWorkspaceId, workspaceId, kind, updateAttributes, addFiles]);
  useEffect(() => {
    const file = takeInsertedMedia(String(node.attrs.blockId));
    if (file) queueMicrotask(() => { void importFile(file); });
  }, [node.attrs.blockId, importFile]);
  const busy = progress !== null || !!(latestUpload && !['done', 'error', 'canceled'].includes(latestUpload.phase));
  const title = String(node.attrs.title || resolved.value?.name || LABELS[kind]);
  const caption = String(node.attrs.caption || '');
  const percentage = Math.round((progress ?? latestUpload?.progress ?? 0) * 100);
  return <NodeViewWrapper as="figure" {...HTMLAttributes} data-fouc-node={kind} data-kind={kind} data-block-id={node.attrs.blockId}
    data-empty={String(!source)} data-dragging={String(dragging)} className={styles.root}
    onDragOver={(event: ReactDragEvent<HTMLElement>) => { if (!editor.isEditable || !event.dataTransfer.types.includes('Files')) return; event.preventDefault(); setDragging(true); }}
    onDragLeave={(event: ReactDragEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={(event: ReactDragEvent<HTMLElement>) => { if (!editor.isEditable) return; event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void importFile(file); }}>
    <input ref={inputRef} type="file" accept={ACCEPT[kind]} className={styles.hiddenInput} aria-label={'选择' + LABELS[kind] + '文件'} data-document-export-omit
      onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ''; }} />
    {source && resolved.value && <div className={styles.preview} contentEditable={false}>
      {kind === 'audio' && <div className={styles.audioTitle}><MusicNotes size={20} aria-hidden /><span>{title}</span></div>}
      {renderPreview(resolved.value)}
    </div>}
    {source && !resolved.value && !resolved.error && <div className={styles.loading} role="status">正在加载{LABELS[kind]}…</div>}
    {source && resolved.value && <div className={styles.actions} contentEditable={false} data-document-export-omit>
      <a href={resolved.value.url} target="_blank" rel="noopener noreferrer" aria-label={'打开' + LABELS[kind]} className={styles.action}><ArrowSquareOut size={15} aria-hidden /></a>
      {editor.isEditable && <button type="button" className={styles.action} aria-label={'更换' + LABELS[kind]} onClick={() => inputRef.current?.click()}><PencilSimple size={15} aria-hidden /></button>}
    </div>}
    {!source && editor.isEditable && !busy && <button type="button" className={styles.pick} contentEditable={false} data-document-export-omit onClick={() => inputRef.current?.click()}>
      <IconForMedia kind={kind} />添加{LABELS[kind]}
    </button>}
    {busy && <div className={styles.progress} contentEditable={false} data-document-export-omit role="status">
      <span>正在保存{LABELS[kind]} · {percentage}%</span><progress max={100} value={percentage} />
      {latestUpload && <button type="button" onClick={() => uploads.cancel(latestUpload.id)}>取消</button>}
    </div>}
    {(error || resolved.error || latestUpload?.phase === 'error' || latestUpload?.phase === 'canceled') && <div className={styles.error} contentEditable={false} role="status" data-document-export-omit>
      {error || resolved.error || latestUpload?.error?.detail || '上传已取消'}
      <button type="button" onClick={() => { if (latestUpload && ['error', 'canceled'].includes(latestUpload.phase)) uploads.retry(latestUpload.id); else inputRef.current?.click(); }}>重试</button>
    </div>}
    {source && (editor.isEditable || caption) && <figcaption className={styles.caption} contentEditable={false}>
      {editor.isEditable ? <input aria-label={LABELS[kind] + '说明'} placeholder="添加说明…" value={caption} onChange={event => updateAttributes({ caption: event.target.value })} /> : caption}
    </figcaption>}
  </NodeViewWrapper>;
}
function IconForMedia({ kind }: { kind: MediaKind }) {
  const Icon = { image: ImageIcon, video: Video, audio: MusicNotes, file: Paperclip }[kind];
  return <Icon size={18} aria-hidden />;
}
