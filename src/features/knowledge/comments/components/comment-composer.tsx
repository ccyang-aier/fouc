'use client';

import { useEffect, useRef, useState } from 'react';
import { At, CircleNotch, Image as ImageIcon, LinkSimple, WarningCircle } from '@phosphor-icons/react';
import { commentBodySchema, type CommentThreadKind } from '@fouc/shared/knowledge/comments';
import { CommentEditor, type CommentEditorHandle } from './comment-editor';
import { useAssetUploads } from '../../assets/use-asset-uploads';
import { UploadQueueItem } from '../../assets/components/upload-queue-item';
import { safeKnowledgeUrl } from '@fouc/shared/knowledge/schema';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { CommentAuthor } from './comment-avatar';
import styles from './comments.module.css';

export interface CommentComposerProps {
  knowledgeBaseId: string;
  placeholder: string;
  submitLabel: string;
  sendingLabel: string;
  sending: boolean;
  error?: string | null;
  onSubmit: (bodyMd: string, kind: CommentThreadKind, mentions: string[]) => void | Promise<boolean>;
  onCancel?: () => void;
  autoFocus?: boolean;
  minHeight?: number;
  allowIssue?: boolean;
  persistent?: boolean;
  replyTo?: CommentAuthor;
  focusKey?: string;
  authors?: ReadonlyMap<string, CommentAuthor>;
  initialBodyMd?: string;
}

/** Shared write surface: drafts survive failures; formatted text remains Markdown. */
export function CommentComposer({ knowledgeBaseId, placeholder, submitLabel, sendingLabel, sending, error, onSubmit, onCancel, autoFocus = true, minHeight = 36, allowIssue = false, persistent = false, replyTo, focusKey, authors, initialBodyMd = '' }: CommentComposerProps) {
  const [body, setBody] = useState(initialBodyMd);
  const [issue, setIssue] = useState(false);
  const [touched, setTouched] = useState(false);
  const [mentioned, setMentioned] = useState<string[]>([]);
  const [link, setLink] = useState('');
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const ref = useRef<CommentEditorHandle>(null);
  const input = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const uploads = useAssetUploads({ knowledgeBaseId, onUploaded: asset => ref.current?.insertImage(asset.hash, asset.name) });
  const activeUploads = uploads.items.filter(item => !['done', 'canceled', 'error'].includes(item.phase));
  const uploading = activeUploads.length > 0;
  const uploadItems = useRef(uploads.items);
  useEffect(() => { uploadItems.current = uploads.items; }, [uploads.items]);
  const cancelUpload = uploads.cancel;
  useEffect(() => () => { for (const item of uploadItems.current) cancelUpload(item.id); }, [cancelUpload]);
  const valid = commentBodySchema.safeParse(body.trim()).success;
  const submit = async () => {
    setTouched(true);
    if (!valid || sending || uploading || submitting.current) return;
    submitting.current = true;
    try {
      const mentions = mentioned.filter(id => body.includes(`@${authors?.get(id)?.name}`));
      if (await onSubmit(body.trim(), issue ? 'issue' : 'comment', mentions)) {
        ref.current?.clear(); uploads.clearFinished(); setBody(''); setIssue(false); setTouched(false); setMentioned([]);
      }
    } finally { submitting.current = false; }
  };
  return <div className={styles.composer} data-persistent={persistent}>
    {replyTo && <div className={styles.composerHeading}><span>回复 <strong>{replyTo.name}</strong></span><button type="button" className={styles.cancelReply} disabled={sending} onClick={onCancel}>取消</button></div>}
    <div className={styles.composerBox}>
      <CommentEditor ref={ref} knowledgeBaseId={knowledgeBaseId} initialBody={initialBodyMd} placeholder={placeholder} disabled={sending} autoFocus={autoFocus} focusKey={focusKey} minHeight={minHeight} onChange={setBody} onSubmit={() => void submit()} onCancel={onCancel} />
      <div className={styles.composerActions}>
        <div className={styles.composeTools}>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild><button type="button" className={styles.iconButton} disabled={sending || !authors?.size} aria-label="提及成员" title="提及成员"><At size={18} weight="regular" aria-hidden /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto" onCloseAutoFocus={event => { event.preventDefault(); ref.current?.focus(); }}>
              {Array.from(authors ?? []).map(([id, author]) => <DropdownMenuItem key={id} onSelect={() => { ref.current?.insertText(`@${author.name} `); setMentioned(value => [...new Set([...value, id])]); }}>@{author.name}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" className={styles.iconButton} disabled={sending || !knowledgeBaseId} aria-label="上传评论图片" title="上传图片" onClick={() => input.current?.click()}><ImageIcon size={18} weight="regular" aria-hidden /></button>
          <input ref={input} type="file" accept="image/*" multiple hidden aria-label="选择评论图片" onChange={event => {
            const files = Array.from(event.target.files ?? []);
            if (files.some(file => !file.type.startsWith('image/'))) { setImageError('请选择图片文件。'); }
            else { setImageError(null); uploads.addFiles(files); }
            event.target.value = '';
          }} />
          <DropdownMenu modal={false} open={linkOpen} onOpenChange={open => { setLinkOpen(open); if (open) { setLink(''); setLinkInvalid(false); } }}>
            <DropdownMenuTrigger asChild><button type="button" className={styles.iconButton} disabled={sending} aria-label="插入评论链接" title="插入链接"><LinkSimple size={18} weight="regular" aria-hidden /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" onCloseAutoFocus={event => { event.preventDefault(); ref.current?.focus(); }}>
              <form className={styles.linkForm} onSubmit={event => { event.preventDefault(); const href = safeKnowledgeUrl(link.trim(), 'link'); if (!href) { setLinkInvalid(true); return; } ref.current?.insertLink(href); setLinkOpen(false); }} onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation(); }}>
                <label>链接地址<input autoFocus aria-label="评论链接地址" placeholder="https://" value={link} onChange={event => { setLink(event.target.value); setLinkInvalid(false); }} aria-invalid={linkInvalid} /></label>
                {linkInvalid && <p role="alert">请输入有效、安全的链接地址。</p>}<button type="submit" className={styles.textButton}>插入链接</button>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
          {allowIssue && <label className={styles.issueChoice}><input type="checkbox" checked={issue} disabled={sending} onChange={event => setIssue(event.target.checked)} />作为问题</label>}
        </div>
        <span className={styles.sendHint}>Ctrl / ⌘ + Enter 发送</span>
        <button type="button" className={styles.sendButton} onClick={() => void submit()} disabled={sending || uploading || !valid} aria-label={sending ? sendingLabel : submitLabel} title={`${submitLabel} · Ctrl / ⌘ + Enter`}>
          <span>{sending ? sendingLabel : submitLabel}</span>{sending && <CircleNotch size={15} className="animate-spin" aria-hidden />}
        </button>
      </div>
    </div>
    {uploads.items.some(item => item.phase !== 'done') && <ul className={styles.uploadQueue} aria-label="评论图片上传">{uploads.items.filter(item => item.phase !== 'done').map(item => <UploadQueueItem key={item.id} item={item} onCancel={uploads.cancel} onRetry={uploads.retry} onRemove={uploads.remove} />)}</ul>}
    {imageError && <p className={styles.composerError} role="alert">{imageError}</p>}
    {touched && !valid && <p className={styles.composerError}><WarningCircle size={12} aria-hidden />评论内容不能为空，且不超过 50000 字符。</p>}
    {error && <p className={styles.composerError} role="alert"><WarningCircle size={12} aria-hidden />{error}</p>}
    {onCancel && !replyTo && <button type="button" className={styles.cancelReply} disabled={sending} onClick={onCancel}>取消</button>}
  </div>;
}
