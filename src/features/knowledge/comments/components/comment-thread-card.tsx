'use client';

import { ArrowUpRight, Chat, CheckCircle, WarningCircle, Quotes } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { CommentThreadGroup, OrphanAnchorGroup } from '../comments-view-model';
import { CommentEntryItem, type CommentAuthor } from './comment-entry';
import styles from './comments.module.css';

export type CommentReplyTarget = { threadId: string; commentId: string };

export interface CommentThreadCardProps {
  group: CommentThreadGroup;
  active: boolean;
  canComment: boolean;
  currentUserId: string | null;
  authors?: ReadonlyMap<string, CommentAuthor>;
  onStartReply: (target: CommentReplyTarget) => void;
  reply: { pending: boolean; threadId: string | null; error: string | null };
  resolve: { pending: boolean; threadId: string | null; error: string | null };
  deletingCommentId: string | null;
  deleteError?: { commentId: string | null; message: string } | null;
  like: { pending: boolean; commentId: string | null; error: string | null };
  onLike: (commentId: string, liked: boolean) => void;
  onLocate: (threadId: string) => void;
  onResolve: (threadId: string) => void;
  onReopen: (threadId: string) => void;
  onDeleteComment: (commentId: string) => void;
  edit: { pending: boolean; commentId: string | null; error: string | null };
  onEdit: (commentId: string, bodyMd: string) => Promise<boolean>;
  onCopyLink: (commentId: string) => Promise<boolean>;
  replyTarget?: CommentReplyTarget | null;
  replyComposer?: ReactNode;
}

export function CommentThreadCard({ group, active, canComment, currentUserId, authors, onStartReply, reply, resolve, deletingCommentId, deleteError, like, onLike, onLocate, onResolve, onReopen, onDeleteComment, edit, onEdit, onCopyLink, replyTarget, replyComposer }: CommentThreadCardProps) {
  const resolved = group.resolved;
  const resolvePending = resolve.pending && resolve.threadId === group.threadId;
  return <article className={styles.thread} data-comment-card={group.threadId} data-active={active} aria-label={`评论线程：${group.excerpt || (group.thread.anchorKind === 'page' ? '页面评论' : '原文已不存在')}`}>
    {group.thread.anchorKind === 'selection' && <div className={styles.excerpt} data-unavailable={!group.anchor}>
      <Quotes size={16} weight="fill" aria-hidden />
      <div><div className={styles.excerptHeading}><span className={styles.excerptLabel}>引用正文</span><button type="button" className={styles.locate} disabled={!group.anchor} onClick={() => onLocate(group.threadId)} title={group.anchor ? '在正文中定位该评论' : '原文已不存在'}>定位原文<ArrowUpRight size={13} aria-hidden /></button></div><p title={group.excerpt}>{group.excerpt || '该评论的原文已不存在'}</p></div>
    </div>}
    <div className={styles.entries}>
      {group.thread.comments.map((entry, index) => {
        const target = group.thread.comments.find(comment => comment.id === entry.replyToCommentId);
        const replyTo = index > 0 ? target ? authors?.get(target.authorId)?.name || (currentUserId === target.authorId ? '我' : '成员') : '已删除的评论' : undefined;
        return <CommentEntryItem key={entry.id} entry={entry} author={authors?.get(entry.authorId)} isOwn={currentUserId === entry.authorId} deleting={deletingCommentId === entry.id} canComment={canComment} isReply={index > 0} replyTo={replyTo} onDelete={onDeleteComment} onLike={onLike} liking={like.pending && like.commentId === entry.id}
          edit={{ pending: edit.pending && edit.commentId === entry.id, error: edit.commentId === entry.id ? edit.error : null }} onEdit={onEdit} onCopyLink={onCopyLink}
          composer={replyTarget?.threadId === group.threadId && replyTarget.commentId === entry.id ? replyComposer : undefined}
          badge={index === 0 && (resolved || group.thread.kind === 'issue') ? <span className={styles.issueBadge} data-resolved={resolved}>{resolved ? <CheckCircle size={14} /> : <WarningCircle size={14} />}{resolved ? '已解决' : '待解决'}</span> : undefined}
          threadAction={index === 0 && canComment ? <DropdownMenuItem disabled={resolvePending} onSelect={() => (resolved ? onReopen : onResolve)(group.threadId)}><CheckCircle size={14} aria-hidden />{resolvePending ? (resolved ? '重新打开中…' : '标记中…') : resolved ? '重新打开' : '标记为已解决'}</DropdownMenuItem> : undefined}
          action={<>
            {canComment && <button type="button" className={styles.replyButton} disabled={reply.pending} onClick={() => onStartReply({ threadId: group.threadId, commentId: entry.id })}><Chat size={16} aria-hidden />回复</button>}
          </>} />;
      })}
    </div>
    {like.error && group.thread.comments.some(entry => entry.id === like.commentId) && <p className={styles.error} role="alert">{like.error}</p>}
    {resolve.error && resolve.threadId === group.threadId && <p className={styles.error} role="alert">{resolve.error}</p>}
    {deleteError && group.thread.comments.some(entry => entry.id === deleteError.commentId) && <p className={styles.error} role="alert">{deleteError.message}</p>}
  </article>;
}

export function OrphanAnchorCard({ orphan, onRemove, canRemove }: { orphan: OrphanAnchorGroup; canRemove: boolean; onRemove: (threadId: string) => void }) {
  return <article className={styles.orphan} data-comment-card={orphan.threadId} aria-label="无关联线程的评论锚点">
    <p>此锚点没有对应的评论线程；原文保持不变。</p><p>{orphan.excerpt}</p>
    {canRemove && <button type="button" className={styles.textButton} onClick={() => onRemove(orphan.threadId)}>移除锚点</button>}
  </article>;
}
