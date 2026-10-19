'use client';

import type { TaskCommentImage } from '@fouc/shared/tasks';
import { ArrowClockwise, ImageSquare } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import type { TaskBoardClient } from './task-board-client';
import { messages } from './task-comments.messages';
import styles from './task-comment-images.module.css';

export function TaskCommentImages({ images, ...scope }: {
  images: TaskCommentImage[]; boardId: string; taskId: string; commentId: string; client: TaskBoardClient;
}) {
  return images.length > 0 && <div className={styles.images}>{images.map(image => <CommentImage key={image.id} image={image} {...scope} />)}</div>;
}

function CommentImage({ image, boardId, taskId, commentId, client }: {
  image: TaskCommentImage; boardId: string; taskId: string; commentId: string; client: TaskBoardClient;
}) {
  const { t } = useTranslation(messages);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let ownedUrl: string | undefined;
    client.commentImage(boardId, taskId, commentId, image.id, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      ownedUrl = URL.createObjectURL(blob); setUrl(ownedUrl); setFailed(false);
    }, () => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); if (ownedUrl) URL.revokeObjectURL(ownedUrl); };
  }, [attempt, boardId, taskId, commentId, image.id, client]);
  if (failed) return <button type="button" className={`fouc-action ${styles.placeholder}`} data-surface="muted" aria-label={t('imageRetry', { name: image.name })}
    onClick={() => { setUrl(null); setFailed(false); setAttempt(value => value + 1); }}><ArrowClockwise size={17} aria-hidden /><span>{t('retry')}</span></button>;
  if (!url) return <div className={styles.placeholder} role="status" aria-label={t('imageLoading')}><ImageSquare size={18} aria-hidden /></div>;
  return <a className={styles.image} href={url} target="_blank" rel="noreferrer" aria-label={t('viewImage', { name: image.name })}>
    {/* Secured image bytes are fetched through the authenticated transport, including the desktop cookie bridge. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} alt={image.name} loading="lazy" onError={() => setFailed(true)} />
  </a>;
}
