import { File, FileCode, FilePdf, FileText, ImageSquare } from '@phosphor-icons/react';
import type { ChannelAttachment } from '@fouc/shared/chats';

export function channelFileKind({ mime, name }: Pick<ChannelAttachment, 'mime' | 'name'>) {
  if (mime.startsWith('image/') || /\.(?:png|jpe?g|gif|webp|avif|svg)$/i.test(name)) return 'image';
  if (mime.includes('pdf') || /\.pdf$/i.test(name)) return 'pdf';
  if (/json|javascript|typescript|xml|yaml/.test(mime) || /\.(?:json|js|ts|tsx|jsx|py|rs|go|css|html|xml|ya?ml|sh|sql)$/i.test(name)) return 'code';
  if (/text|word|document|sheet|presentation/.test(mime) || /\.(?:md|txt|csv|docx?|xlsx?|pptx?)$/i.test(name)) return 'document';
  return 'file';
}

const glyphs = {
  image: { Icon: ImageSquare, color: '#8b72be' }, pdf: { Icon: FilePdf, color: '#c66f68' },
  code: { Icon: FileCode, color: '#588fbc' }, document: { Icon: FileText, color: '#0bb9dc' }, file: { Icon: File, color: 'var(--muted-strong)' },
};

export function ChannelFileIcon({ attachment, size = 28, className }: {
  attachment: Pick<ChannelAttachment, 'mime' | 'name'>; size?: number; className?: string;
}) {
  const { Icon, color } = glyphs[channelFileKind(attachment)];
  return <Icon size={size} className={className} style={{ color }} weight="fill" aria-hidden />;
}
