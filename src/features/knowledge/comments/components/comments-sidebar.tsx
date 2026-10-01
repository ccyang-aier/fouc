'use client';

import { useState } from 'react';
import { ChatsCircle, WarningCircle, X } from '@phosphor-icons/react';
import type { CommentThreadKind } from '@fouc/shared/knowledge/comments';
import { defaultCommentFilters, filterCommentGroups, type CommentSidebarModel } from '../comments-view-model';
import { CommentThreadCard, OrphanAnchorCard, type CommentThreadCardProps } from './comment-thread-card';
import { CommentComposer } from './comment-composer';
import { CommentFilterControls } from './comment-filters';
import styles from './comments.module.css';

export interface CommentsSidebarProps extends Pick<CommentThreadCardProps,
  'canComment' | 'currentUserId' | 'authors' | 'reply' | 'resolve' | 'deletingCommentId' | 'deleteError' | 'like' | 'onLike' | 'onLocate' | 'onReply' | 'onResolve' | 'onReopen' | 'onDeleteComment'
> {
  model: CommentSidebarModel;
  replyingThreadId: string | null;
  onToggleReply: (threadId: string, open: boolean) => void;
  activeThreadId: string | null;
  onRemoveOrphan: (threadId: string) => void;
  status: 'loading' | 'error' | 'ready';
  errorText: string | null;
  onRetry: () => void;
  onClose: () => void;
  create: { pending: boolean; error: string | null };
  onCreate: (bodyMd: string, kind: CommentThreadKind) => Promise<boolean>;
}

export function CommentsSidebar({ model, replyingThreadId, onToggleReply, activeThreadId, onRemoveOrphan, status, errorText, onRetry, onClose, create, onCreate, ...card }: CommentsSidebarProps) {
  // Locating a quoted comment clears filters so its thread is always visible.
  const [choice, setChoice] = useState({ activeThreadId, value: defaultCommentFilters });
  const filters = choice.activeThreadId === activeThreadId ? choice.value : defaultCommentFilters;
  const groups = filterCommentGroups([...model.groups, ...model.unanchored], filters);
  const filtered = Object.keys(filters).some(key => filters[key as keyof typeof filters] !== defaultCommentFilters[key as keyof typeof filters]);
  const orphans = filtered ? [] : model.orphans;
  return <aside aria-label="页面评论" className={styles.sidebar}>
    <header className={styles.header}><h2 className={styles.heading}>评论</h2>
      {status === 'ready' && <span className={styles.count}>{model.counts.total}</span>}
      <button type="button" className={`${styles.iconButton} ${styles.close}`} aria-label="收起评论栏" title="收起评论栏" onClick={onClose}><X size={16} aria-hidden /></button>
    </header>
    <CommentFilterControls value={filters} onChange={value => setChoice({ activeThreadId, value })} />
    <div className={styles.body} aria-label="评论列表" tabIndex={0}>
      {status === 'loading' ? <div role="status" aria-label="正在加载评论">{[0, 1, 2].map(index => <div key={index} className={styles.skeleton}><span /><span /><span /></div>)}</div>
        : status === 'error' ? <div role="alert" className={styles.status}><WarningCircle size={24} aria-hidden /><strong>评论加载失败</strong><p>{errorText}</p><button type="button" className={styles.textButton} onClick={onRetry}>重试</button></div>
        : !groups.length && !orphans.length ? <div className={styles.status}><ChatsCircle size={26} aria-hidden /><strong>{filtered ? '没有符合条件的评论' : '还没有评论'}</strong><p>{filtered ? '试试调整筛选条件。' : card.canComment ? '分享想法，或将需要跟进的事项作为问题发表。' : '页面的讨论会显示在这里。'}</p>{filtered && <button type="button" className={styles.textButton} onClick={() => setChoice({ activeThreadId, value: defaultCommentFilters })}>清除筛选</button>}</div>
        : <>{groups.map(group => <CommentThreadCard key={group.threadId} group={group} active={activeThreadId === group.threadId} replying={replyingThreadId === group.threadId} onToggleReply={onToggleReply} {...card} />)}
          {!!orphans.length && <section aria-label="无关联线程的锚点"><p className={styles.sectionLabel}>孤立锚点</p>{orphans.map(orphan => <OrphanAnchorCard key={orphan.threadId} orphan={orphan} canRemove={card.canComment} onRemove={onRemoveOrphan} />)}</section>}
        </>}
    </div>
    <footer className={styles.footer}>
      {card.canComment ? <CommentComposer placeholder="写下评论，分享你的想法…" submitLabel="发表评论" sendingLabel="发送中…" sending={create.pending} error={create.error} onSubmit={async (body, kind) => {
        const success = await onCreate(body, kind);
        if (success) setChoice({ activeThreadId, value: defaultCommentFilters });
        return success;
      }} allowIssue persistent autoFocus={false} minHeight={48} /> : <p className={styles.startHint}>当前权限仅可查看评论</p>}
    </footer>
  </aside>;
}
