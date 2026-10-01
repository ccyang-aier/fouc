'use client';

import { Check } from '@phosphor-icons/react';
import type { CommentThreadGroup, OrphanAnchorGroup } from '../comments-view-model';
import { CommentEntryItem, type CommentAuthor } from './comment-entry';
import { CommentComposer } from './comment-composer';
import styles from './comments.module.css';

export interface CommentThreadCardProps {
  group: CommentThreadGroup;
  active: boolean;
  canComment: boolean;
  currentUserId: string | null;
  authors?: ReadonlyMap<string, CommentAuthor>;
  replying: boolean;
  onToggleReply: (threadId: string, open: boolean) => void;
  reply: { pending: boolean; threadId: string | null; error: string | null };
  resolve: { pending: boolean; threadId: string | null; error: string | null };
  deletingCommentId: string | null;
  deleteError?: { commentId: string | null; message: string } | null;
  like: { pending: boolean; commentId: string | null; error: string | null };
  onLike: (commentId: string, liked: boolean) => void;
  onLocate: (threadId: string) => void;
  onReply: (threadId: string, bodyMd: string) => void;
  onResolve: (threadId: string) => void;
  onReopen: (threadId: string) => void;
  onDeleteComment: (commentId: string) => void;
}

export function CommentThreadCard({ group, active, canComment, currentUserId, authors, replying, onToggleReply, reply, resolve, deletingCommentId, deleteError, like, onLike, onLocate, onReply, onResolve, onReopen, onDeleteComment }: CommentThreadCardProps) {
  const resolved = group.resolved;
  const resolvePending = resolve.pending && resolve.threadId === group.threadId;
  const replyPending = reply.pending && reply.threadId === group.threadId;
  return <article className={styles.thread} data-comment-card={group.threadId} data-active={active} aria-label={`评论线程：${group.excerpt || (group.thread.anchorKind === 'page' ? '页面评论' : '原文已不存在')}`}>
    {group.thread.kind === 'issue' && <span className={styles.issueBadge}>问题</span>}
    {group.thread.anchorKind === 'selection' && <button type="button" className={styles.excerpt} disabled={!group.anchor} onClick={() => onLocate(group.threadId)} title={group.anchor ? '在正文中定位该评论' : '原文已不存在'}><span>{group.excerpt || '该评论的原文已不存在'}</span></button>}
    <div className={styles.entries}>
      {group.thread.comments.map((entry, index) => <CommentEntryItem key={entry.id} entry={entry} author={authors?.get(entry.authorId)} isOwn={currentUserId === entry.authorId} deleting={deletingCommentId === entry.id} canComment={canComment} isReply={index > 0} onDelete={onDeleteComment} onLike={onLike} liking={like.pending && like.commentId === entry.id}
        action={index === 0 && group.thread.kind === 'issue' ? <button type="button" className={styles.resolve} aria-pressed={resolved} aria-label={resolved ? '重新打开' : '标记解决'} disabled={resolvePending || !canComment} onClick={() => (resolved ? onReopen : onResolve)(group.threadId)}>
          <span className={styles.resolveBox} aria-hidden>{resolved && <Check size={12} weight="bold" />}</span>
          <span>{resolvePending ? (resolved ? '重开中…' : '解决中…') : resolved ? '已解决' : '未解决'}</span>
        </button> : undefined} />)}
    </div>
    {like.error && group.thread.comments.some(entry => entry.id === like.commentId) && <p className={styles.error} role="alert">{like.error}</p>}
    {resolve.error && resolve.threadId === group.threadId && <p className={styles.error} role="alert">{resolve.error}</p>}
    {deleteError && group.thread.comments.some(entry => entry.id === deleteError.commentId) && <p className={styles.error} role="alert">{deleteError.message}</p>}
    {reply.error && reply.threadId === group.threadId && !replying && <p className={styles.error} role="alert">{reply.error}</p>}
    {canComment ? (replying ? <div className={styles.replyComposer}><CommentComposer placeholder="回复…" submitLabel="回复" sendingLabel="发送中…" sending={replyPending} error={reply.threadId === group.threadId ? reply.error : null} onSubmit={bodyMd => onReply(group.threadId, bodyMd)} onCancel={() => onToggleReply(group.threadId, false)} autoFocus minHeight={44} /></div>
      : <button type="button" className={styles.replyButton} aria-expanded={false} onClick={() => onToggleReply(group.threadId, true)}>回复…</button>)
      : <p className={styles.sectionLabel}>只读：当前权限不能评论</p>}
  </article>;
}

export function OrphanAnchorCard({ orphan, onRemove, canRemove }: { orphan: OrphanAnchorGroup; canRemove: boolean; onRemove: (threadId: string) => void }) {
  return <article className={styles.orphan} data-comment-card={orphan.threadId} aria-label="无关联线程的评论锚点">
    <p>此锚点没有对应的评论线程；原文保持不变。</p><p>{orphan.excerpt}</p>
    {canRemove && <button type="button" className={styles.textButton} onClick={() => onRemove(orphan.threadId)}>移除锚点</button>}
  </article>;
}
