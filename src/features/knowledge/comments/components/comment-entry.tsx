'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { DotsThree, TrashSimple, User, ThumbsUp } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { CommentEntry } from '@fouc/shared/knowledge/comments';
import { formatCommentTime } from '../comments-view-model';
import styles from './comments.module.css';

export type CommentAuthor = { name: string; image?: string | null };

export interface CommentEntryItemProps {
  entry: CommentEntry;
  author?: CommentAuthor;
  isOwn: boolean;
  deleting: boolean;
  canComment: boolean;
  isReply?: boolean;
  action?: ReactNode;
  onDelete: (commentId: string) => void;
  onLike: (commentId: string, liked: boolean) => void;
  liking: boolean;
}

export function CommentEntryItem({ entry, author, isOwn, deleting, canComment, isReply, action, onDelete, onLike, liking }: CommentEntryItemProps) {
  return <article className={styles.entry} data-reply={isReply}>
    {author?.image
      ? <Image className={styles.avatar} src={author.image} alt="" width={30} height={30} unoptimized />
      : <span className={styles.avatar} aria-hidden><User size={18} /></span>}
    <div className={styles.entryContent}>
      <div className={styles.entryHeader}>
        <span className={styles.author} title={author?.name}>{author?.name || (isOwn ? '我' : '成员')}</span>
        <time className={styles.time} dateTime={entry.createdAt}>{formatCommentTime(entry.createdAt)}</time>
        <div className={styles.entryActions}>
          {action}
          {isOwn && canComment && <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" className={styles.iconButton} aria-label={deleting ? '正在删除评论' : '我的评论操作'} disabled={deleting}><DotsThree size={18} weight="bold" aria-hidden /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onDelete(entry.id)} disabled={deleting} aria-label="删除我的评论"><TrashSimple size={14} aria-hidden />删除我的评论</DropdownMenuItem></DropdownMenuContent>
          </DropdownMenu>}
        </div>
      </div>
      <p className={styles.entryBody}>{entry.bodyMd}</p>
      <button type="button" className={styles.likeButton} aria-label={entry.liked ? '取消点赞' : '点赞'} aria-pressed={entry.liked} disabled={!canComment || liking} onClick={() => onLike(entry.id, !entry.liked)}><ThumbsUp size={13} weight={entry.liked ? 'fill' : 'regular'} aria-hidden /><span>{entry.likeCount || '赞'}</span></button>
    </div>
  </article>;
}
