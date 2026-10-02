'use client';

import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { getOverlayRoot } from '@/lib/overlay-root';
import { ChatsCircle, WarningCircle, X } from '@phosphor-icons/react';
import type { CommentThreadKind } from '@fouc/shared/knowledge/comments';
import { defaultCommentFilters, filterCommentGroups, type CommentSidebarModel } from '../comments-view-model';
import { CommentThreadCard, OrphanAnchorCard, type CommentThreadCardProps, type CommentReplyTarget } from './comment-thread-card';
import { CommentComposer } from './comment-composer';
import { CommentFilterControls } from './comment-filters';
import styles from './comments.module.css';

const narrowQuery = '(max-width: 700px)';
const readNarrowView = () => window.matchMedia(narrowQuery).matches;
function subscribeNarrowView(onChange: () => void) {
  const media = window.matchMedia(narrowQuery);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

export interface CommentsSidebarProps extends Pick<CommentThreadCardProps,
  'workspaceId' | 'canComment' | 'currentUserId' | 'authors' | 'reply' | 'resolve' | 'deletingCommentId' | 'deleteError' | 'like' | 'onLike' | 'onLocate' | 'onResolve' | 'onReopen' | 'onDeleteComment'
  | 'edit' | 'onEdit' | 'onCopyLink'
> {
  model: CommentSidebarModel;
  replyTarget: CommentReplyTarget | null;
  onReplyTargetChange: (target: CommentReplyTarget | null) => void;
  onReply: (target: CommentReplyTarget, bodyMd: string, mentions: string[]) => Promise<boolean>;
  activeThreadId: string | null;
  onRemoveOrphan: (threadId: string) => void;
  status: 'loading' | 'error' | 'ready';
  errorText: string | null;
  onRetry: () => void;
  onClose: () => void;
  create: { pending: boolean; error: string | null };
  onCreate: (bodyMd: string, kind: CommentThreadKind, mentions: string[]) => Promise<boolean>;
}

export function CommentsSidebar({ model, replyTarget, onReplyTargetChange, onReply, activeThreadId, onRemoveOrphan, status, errorText, onRetry, onClose, create, onCreate, ...card }: CommentsSidebarProps) {
  const narrow = useSyncExternalStore(subscribeNarrowView, readNarrowView, () => false);
  // Locating a quoted comment clears filters so its thread is always visible.
  const [choice, setChoice] = useState({ activeThreadId, value: defaultCommentFilters });
  const filters = choice.activeThreadId === activeThreadId ? choice.value : defaultCommentFilters;
  const groups = filterCommentGroups([...model.groups, ...model.unanchored], filters);
  const filtered = Object.keys(filters).some(key => filters[key as keyof typeof filters] !== defaultCommentFilters[key as keyof typeof filters]);
  const orphans = filtered ? [] : model.orphans;
  const replyEntry = [...model.groups, ...model.unanchored].find(group => group.threadId === replyTarget?.threadId)?.thread.comments.find(entry => entry.id === replyTarget?.commentId);
  const replyAuthor = replyEntry ? card.authors?.get(replyEntry.authorId) ?? { name: card.currentUserId === replyEntry.authorId ? '我' : '成员' } : undefined;
  const replyComposer = card.canComment && replyEntry && replyTarget ? <div key={replyTarget.commentId} className={styles.inlineReply}>
    <CommentComposer workspaceId={card.workspaceId} placeholder={`回复 ${replyAuthor?.name}…`} submitLabel="发送回复" sendingLabel="发送中…" sending={card.reply.pending} error={card.reply.threadId === replyTarget.threadId ? card.reply.error : null} replyTo={replyAuthor} authors={card.authors} onSubmit={(body, _kind, mentions) => onReply(replyTarget, body, mentions)} onCancel={() => onReplyTargetChange(null)} minHeight={36} />
  </div> : null;
  const sidebar = <aside aria-label="页面评论" className={styles.sidebar}>
    <header className={styles.header}><h2 className={styles.heading}>评论</h2>
      {status === 'ready' && <span className={styles.count}>{model.counts.total}</span>}
      <button type="button" className={`${styles.iconButton} ${styles.close}`} aria-label="收起评论栏" title="收起评论栏" onClick={onClose}><X size={16} aria-hidden /></button>
    </header>
    <CommentFilterControls value={filters} onChange={value => setChoice({ activeThreadId, value })} />
    <div className={styles.body} aria-label="评论列表" tabIndex={0}>
      {status === 'loading' ? <div role="status" aria-label="正在加载评论">{[0, 1, 2].map(index => <div key={index} className={styles.skeleton}><span /><span /><span /></div>)}</div>
        : status === 'error' ? <div role="alert" className={styles.status}><WarningCircle size={24} aria-hidden /><strong>评论加载失败</strong><p>{errorText}</p><button type="button" className={styles.textButton} onClick={onRetry}>重试</button></div>
        : !groups.length && !orphans.length ? <div className={styles.status}><ChatsCircle size={26} aria-hidden /><strong>{filtered ? '没有符合条件的评论' : '还没有评论'}</strong><p>{filtered ? '试试调整筛选条件。' : card.canComment ? '分享想法，或将需要跟进的事项作为问题发表。' : '页面的讨论会显示在这里。'}</p>{filtered && <button type="button" className={styles.textButton} onClick={() => setChoice({ activeThreadId, value: defaultCommentFilters })}>清除筛选</button>}</div>
        : <>{groups.map(group => <CommentThreadCard key={group.threadId} group={group} active={activeThreadId === group.threadId} onStartReply={onReplyTargetChange} replyTarget={replyTarget} replyComposer={replyComposer} {...card} />)}
          {!!orphans.length && <section aria-label="无关联线程的锚点"><p className={styles.sectionLabel}>孤立锚点</p>{orphans.map(orphan => <OrphanAnchorCard key={orphan.threadId} orphan={orphan} canRemove={card.canComment} onRemove={onRemoveOrphan} />)}</section>}
        </>}
    </div>
    <footer className={styles.footer}>
      {card.canComment ? <CommentComposer workspaceId={card.workspaceId} placeholder="写下评论，分享你的想法…" submitLabel="发表" sendingLabel="发送中…" sending={create.pending} error={create.error} authors={card.authors} onSubmit={async (body, kind, mentions) => {
        const success = await onCreate(body, kind, mentions);
        if (success) setChoice({ activeThreadId, value: defaultCommentFilters });
        return success;
      }} allowIssue persistent autoFocus={false} minHeight={36} /> : <p className={styles.startHint}>当前权限仅可查看评论</p>}
    </footer>
  </aside>;
  // The shell clips its main column; the mobile rail needs the overlay host.
  return narrow ? createPortal(sidebar, getOverlayRoot() ?? document.body) : sidebar;
}
