'use client';

import { useRef, useState, type ReactNode } from 'react';
import { DotsThree, TrashSimple, ThumbsUp, PencilSimple, LinkSimple } from '@phosphor-icons/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { CommentEntry } from '@fouc/shared/knowledge/comments';
import { formatCommentTime } from '../comments-view-model';
import { CommentAvatar, type CommentAuthor } from './comment-avatar';
import { CommentComposer } from './comment-composer';
import styles from './comments.module.css';

export type { CommentAuthor } from './comment-avatar';

export interface CommentEntryItemProps {
  entry: CommentEntry;
  author?: CommentAuthor;
  isOwn: boolean;
  deleting: boolean;
  canComment: boolean;
  isReply?: boolean;
  action?: ReactNode;
  badge?: ReactNode;
  composer?: ReactNode;
  replyTo?: string;
  onDelete: (commentId: string) => void;
  onLike: (commentId: string, liked: boolean) => void;
  liking: boolean;
  edit: { pending: boolean; error: string | null };
  onEdit: (commentId: string, bodyMd: string) => Promise<boolean>;
  onCopyLink: (commentId: string) => Promise<boolean>;
}

export function CommentEntryItem({ entry, author, isOwn, deleting, canComment, isReply, action, badge, composer, replyTo, onDelete, onLike, liking, edit, onEdit, onCopyLink }: CommentEntryItemProps) {
  const [editing, setEditing] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const entryRef = useRef<HTMLElement>(null);
  return <article ref={entryRef} className={styles.entry} data-reply={isReply} data-comment-id={entry.id}>
    <CommentAvatar author={author} />
    <div className={styles.entryContent}>
      <div className={styles.entryHeader}>
        <span className={styles.author} title={author?.name}>{author?.name || (isOwn ? '我' : '成员')}</span>
        <time className={styles.time} dateTime={entry.createdAt}>{formatCommentTime(entry.createdAt)}</time>
        {replyTo && <span className={styles.replyTarget}>回复 <span>{replyTo}</span></span>}
        {badge}
        <div className={styles.entryActions}>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild><button type="button" className={styles.iconButton} aria-label="评论操作" disabled={deleting || edit.pending}><DotsThree size={18} weight="bold" aria-hidden /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" onCloseAutoFocus={event => { if (editing) { event.preventDefault(); entryRef.current?.querySelector('textarea')?.focus(); } }}>
              {isOwn && canComment && <DropdownMenuItem onSelect={() => { setEditing(true); setCopyStatus('idle'); }}><PencilSimple size={14} aria-hidden />编辑</DropdownMenuItem>}
              <DropdownMenuItem onSelect={() => { void onCopyLink(entry.id).then(success => setCopyStatus(success ? 'copied' : 'error')); }}><LinkSimple size={14} aria-hidden />复制链接</DropdownMenuItem>
              {isOwn && canComment && <DropdownMenuItem className="text-[var(--err-ink)]" onSelect={() => onDelete(entry.id)} disabled={deleting}><TrashSimple size={14} aria-hidden />删除</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {editing && isOwn && canComment ? <div className={styles.editComposer}><CommentComposer placeholder="编辑评论…" initialBodyMd={entry.bodyMd} submitLabel="保存" sendingLabel="保存中…" sending={edit.pending} error={edit.error} onCancel={() => setEditing(false)} onSubmit={async body => {
        const success = await onEdit(entry.id, body);
        if (success) setEditing(false);
        return success;
      }} minHeight={48} /></div> : <div className={styles.entryBody}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a> }}>{entry.bodyMd}</ReactMarkdown></div>}
      <div className={styles.entryToolbar}>
        <button type="button" className={styles.likeButton} aria-label={entry.liked ? '取消点赞' : '点赞'} aria-pressed={entry.liked} disabled={!canComment || liking} onClick={() => onLike(entry.id, !entry.liked)}><ThumbsUp size={16} weight={entry.liked ? 'fill' : 'regular'} aria-hidden /><span>{entry.likeCount || '赞'}</span></button>
        {action}
      </div>
      {copyStatus !== 'idle' && <p className={copyStatus === 'error' ? styles.composerError : styles.copyStatus} role={copyStatus === 'error' ? 'alert' : 'status'}>{copyStatus === 'copied' ? '链接已复制' : '复制失败，请重试。'}</p>}
      {composer}
    </div>
  </article>;
}
