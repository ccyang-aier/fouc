'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { safeKnowledgeUrl } from '@fouc/shared/knowledge/schema';
import { knowledgeAssetsApi } from '../../assets/assets-api';
import styles from './comments.module.css';

export function CommentImage({ source, alt, workspaceId }: { source: string; alt: string; workspaceId: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const safe = safeKnowledgeUrl(source, 'media');
  const hash = safe?.startsWith('asset:') ? safe.slice(6) : null;
  const grant = useQuery({
    queryKey: ['knowledge', workspaceId, 'comment-image', hash],
    enabled: !!hash && !!workspaceId,
    queryFn: ({ signal }) => knowledgeAssetsApi.download(workspaceId, hash!, signal),
    refetchInterval: query => query.state.data ? Math.max(10_000, Date.parse(query.state.data.expiresAt) - Date.now() - 60_000) : false,
    retry: false,
  });
  const url = hash ? grant.data?.url : safe;
  if (!safe) return <span className={styles.imageStatus} role="alert">图片地址无效</span>;
  if (hash && !workspaceId) return <span className={styles.imageStatus} role="alert">图片尚未关联工作空间</span>;
  if (url && failedUrl === url) return <span className={styles.imageStatus} role="alert">图片加载失败<button type="button" onClick={() => { setFailedUrl(null); if (hash) void grant.refetch(); }}>重试</button></span>;
  if (!url) return <span className={styles.imageStatus} role={grant.isError ? 'alert' : 'status'}>{grant.isError ? '图片加载失败' : '正在加载图片…'}{grant.isError && <button type="button" onClick={() => void grant.refetch()}>重试</button>}</span>;
  // Authorized asset URLs and user images bypass the Next image proxy.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.commentImage} src={url} alt={alt} loading="lazy" onError={() => setFailedUrl(url)} />;
}

export function CommentMarkdown({ body, workspaceId }: { body: string; workspaceId: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={(url, key) => safeKnowledgeUrl(url, key === 'src' ? 'media' : 'link') ?? ''} components={{
    a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>,
    img: ({ src, alt }) => typeof src === 'string' ? <CommentImage source={src} alt={alt ?? ''} workspaceId={workspaceId} /> : null,
  }}>{body}</ReactMarkdown>;
}
