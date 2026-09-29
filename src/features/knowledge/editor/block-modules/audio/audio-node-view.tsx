'use client';

import { useState } from 'react';
import type { NodeViewProps } from '@tiptap/react';
import { MediaBlockView } from '../media-core/media-block-view';

export function AudioNodeView(props: NodeViewProps & { localWorkspaceId?: string; workspaceId?: string }) {
  return <MediaBlockView {...props} kind="audio" renderPreview={(source) => <AudioPreview key={source.url} src={source.url} />} />;
}

function AudioPreview({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="p-8 text-xs text-[var(--err-ink)]">音频无法播放，请检查格式或更换资源。</span> : <audio src={src} controls preload="metadata" onError={() => setFailed(true)} />;
}
