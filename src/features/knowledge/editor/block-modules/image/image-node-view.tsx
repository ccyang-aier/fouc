'use client';

import { useState } from 'react';
import type { NodeViewProps } from '@tiptap/react';
import { MediaBlockView } from '../media-core/media-block-view';

export function ImageNodeView(props: NodeViewProps & { localWorkspaceId?: string; workspaceId?: string }) {
  return <MediaBlockView {...props} kind="image" renderPreview={(source) => <ImagePreview key={source.url} src={source.url} alt={String(props.node.attrs.alt || source.name || '')} />} />;
}

function ImagePreview({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  // Object URLs and user supplied hosts cannot use the Next image proxy.
  // eslint-disable-next-line @next/next/no-img-element
  return failed ? <span className="p-8 text-xs text-[var(--err-ink)]">图片加载失败，请检查地址或更换资源。</span> : <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}
