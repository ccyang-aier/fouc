'use client';

import { useState } from 'react';
import type { NodeViewProps } from '@tiptap/react';
import { MediaBlockView } from '../media-core/media-block-view';

export function VideoNodeView(props: NodeViewProps & { localWorkspaceId?: string; workspaceId?: string }) {
  return <MediaBlockView {...props} kind="video" renderPreview={(source) => <VideoPreview key={source.url} src={source.url} />} />;
}

function VideoPreview({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="p-8 text-xs text-[var(--err-ink)]">视频无法播放，请检查格式或更换资源。</span> : <video src={src} controls preload="metadata" onError={() => setFailed(true)} />;
}
