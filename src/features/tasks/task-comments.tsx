'use client';

import type { TaskBoardDetail, TaskComment } from '@fouc/shared/tasks';
import { ChatCircle, Trash } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { AppAlert } from '@/components/app-alert';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { useTranslation } from '@/lib/i18n';
import type { TaskBoardClient } from './task-board-client';
import { messages } from './task-comments.messages';
import styles from './task-comments.module.css';

export function TaskComments({
  board,
  taskId,
  actorId,
  client,
  onChanged,
  onDirtyChange,
}: {
  board: TaskBoardDetail;
  taskId: string;
  actorId: string;
  client: TaskBoardClient;
  onChanged: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { t, locale } = useTranslation(messages);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<'postFailed' | 'removeFailed' | null>(null);
  const active = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);
  const canComment = board.permission === 'owner' || board.permission === 'editor';
  const actor = board.members.find((member) => member.userId === actorId);
  const commentCount = board.tasks.find(task => task.id === taskId)?.commentCount;

  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    client.comments(board.id, taskId, controller.signal).then(
      (items) => {
        if (controller.signal.aborted) return;
        setComments(items);
        setFailed(false);
        setLoading(false);
      },
      () => {
        if (controller.signal.aborted) return;
        setFailed(true);
        setLoading(false);
      },
    );
    return () => {
      active.current = false;
      controller.abort();
    };
  }, [board.id, client, commentCount, revision, taskId]);

  useEffect(() => {
    onDirtyChange(Boolean(body.trim()));
  }, [body, onDirtyChange]);

  async function post() {
    if (!body.trim() || posting || !canComment) return;
    setPosting(true);
    setError(null);
    try {
      const comment = await client.addComment(board.id, taskId, body.trim());
      if (!active.current) return;
      setComments((current) => [...current, comment]);
      setBody('');
      onChanged();
      input.current?.focus({ preventScroll: true });
    } catch {
      if (active.current) setError('postFailed');
    } finally {
      if (active.current) setPosting(false);
    }
  }

  async function remove(id: string) {
    if (removing) return;
    setRemoving(id);
    setError(null);
    try {
      await client.removeComment(board.id, taskId, id);
      if (!active.current) return;
      setComments((current) => current.filter((comment) => comment.id !== id));
      setConfirming(null);
      onChanged();
    } catch {
      if (active.current) setError('removeFailed');
    } finally {
      if (active.current) setRemoving(null);
    }
  }

  return (
    <section className={styles.section} aria-label={t('comments')}>
      <div className={styles.heading}>
        <ChatCircle size={17} aria-hidden />
        <h3>{t('comments')}</h3>
        {!loading && !failed && <span className={styles.count}>{comments.length}</span>}
      </div>
      {loading ? (
        <div className={styles.skeleton} role="status" aria-label={t('loading')}>
          <span /><div><span /><span /></div>
        </div>
      ) : failed ? (
        <AppAlert tone="error" title={t('loadFailed')} action={
          <Button variant="ghost" size="sm" onClick={() => {
            setLoading(true);
            setRevision((value) => value + 1);
          }}>{t('retry')}</Button>
        } />
      ) : comments.length === 0 ? (
        <div className={styles.empty}>
          <p>{t('empty')}</p>
          {canComment && <span>{t('emptyHint')}</span>}
        </div>
      ) : (
        <ol className={styles.list}>
          {comments.map((comment) => (
            <li key={comment.id} className={styles.comment}>
              <UserAvatar name={comment.authorName} image={comment.authorImage} className={styles.avatar} />
              <div className={styles.commentBody}>
                <div className={styles.byline}>
                  <strong>{comment.authorName}</strong>
                  <time dateTime={comment.createdAt}>
                    {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(comment.createdAt))}
                  </time>
                  {canComment && (board.permission === 'owner' || comment.authorId === actorId) && (
                    <Button variant="ghost" size="icon-sm" className={styles.delete}
                      data-variant="destructive" aria-label={t('delete')}
                      disabled={Boolean(removing)} onClick={() => setConfirming(comment.id)}>
                      <Trash size={14} />
                    </Button>
                  )}
                </div>
                <p>{comment.body}</p>
                {confirming === comment.id && (
                  <div className={styles.confirm} role="group" aria-label={t('deleteConfirm')}>
                    <span>{t('deleteConfirm')}</span>
                    <Button variant="ghost" size="sm" disabled={Boolean(removing)} onClick={() => setConfirming(null)}>{t('cancel')}</Button>
                    <Button variant="ghost" size="sm" className={styles.danger} data-variant="destructive"
                      loading={removing === comment.id} onClick={() => void remove(comment.id)}>{t('confirmDelete')}</Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {canComment && !loading && !failed && (
        <div className={styles.composer}>
          <UserAvatar name={actor?.name} image={actor?.image} className={styles.avatar} />
          <div className={styles.editor}>
            <textarea ref={input} aria-label={t('placeholder')} placeholder={t('placeholder')} value={body}
              maxLength={4000} disabled={posting} rows={3} onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void post();
                }
              }} />
            <div className={styles.composerActions}>
              <span>{t('shortcut')}</span>
              {body.trim() && <Button variant="ghost" size="sm" className={styles.danger} data-variant="destructive" disabled={posting} onClick={() => setBody('')}>{t('clear')}</Button>}
              <Button variant="outline" size="sm" loading={posting} disabled={!body.trim()} onClick={() => void post()}>{t('publish')}</Button>
            </div>
          </div>
        </div>
      )}
      {error && <AppAlert tone="error" title={t(error)} onClose={() => setError(null)} />}
    </section>
  );
}
