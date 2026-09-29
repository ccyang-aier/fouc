'use client';

import { FileText } from '@phosphor-icons/react';
import type { NodeViewProps } from '@tiptap/react';
import { MediaBlockView } from '../media-core/media-block-view';
import type { ResolvedMedia } from '../media-core/media-block-view';

function formatSize(size: number | null): string { return size === null ? '' : size < 1024 ? `${size} B` : size < 1024 ** 2 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 ** 2).toFixed(1)} MB`; }

export function FileNodeView(props: NodeViewProps & { localWorkspaceId?: string; workspaceId?: string }) {
  const title = String(props.node.attrs.title || '附件');
  return <MediaBlockView {...props} kind="file" renderPreview={(source) => <FilePreview source={source} title={title} />} />;
}

function FilePreview({ source, title }: { source: ResolvedMedia; title: string }) {
  return <div className="flex w-full items-center gap-3 p-5 text-left">
    <span className="grid size-11 shrink-0 place-items-center rounded-[9px] bg-[#edf3fb] text-[#3a72b9]"><FileText aria-hidden size={23} weight="duotone" /></span>
    <span className="min-w-0 flex-1"><strong className="block truncate text-[13px] font-semibold text-[#2c3d54]">{source.name || title}</strong><small className="mt-0.5 block text-[11px] text-[#8b99ad]">{formatSize(source.size) || source.mime || '附件'}</small></span>
    <a href={source.url} download={source.name || title} className="rounded-[6px] border border-[#dbe5f1] bg-white px-3 py-1.5 text-[11px] font-medium text-[#2d6eb9] hover:bg-[#f0f6fd]">下载</a>
  </div>;
}
