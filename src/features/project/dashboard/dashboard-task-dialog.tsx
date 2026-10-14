'use client';
import { translateFixed } from '../i18n/display';

import { useTranslation } from '@/lib/i18n';
import { fixtureField, registerProjectFixtures } from '../i18n/display';
import { messages } from './i18n/dashboard-task-dialog';

import { useAppAlert } from '@/components/app-alert-provider';
import { Button } from '@/components/ui/button';
import { Link, Star, X } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { CommentItem } from './dashboard-comments';
import { dashboardLink } from './dashboard-links';
import {
  type DashboardAttachment,
  type DashboardComment,
  type DashboardPersonId,
  type DashboardProject,
  type DashboardTask,
} from './dashboard-model';
import { DashboardTaskComposer } from './dashboard-task-composer';
import styles from './dashboard-task-dialog.module.css';
import { DashboardTaskFields, PeopleMenu } from './dashboard-task-fields';
import { DashboardTaskSettings, taskSettingError } from './dashboard-task-settings';
import { dashboardTimestamp } from './dashboard-time';
import { AvatarGroup, IconButton, SegmentedControl } from './dashboard-ui';

type DetailTab = 'Description' | 'Comment' | 'Setting';
const tabs: DetailTab[] = ['Description', 'Comment', 'Setting'];

export function DashboardTaskDialog({
  task,
  scopeKey,
  projects,
  onClose,
  onSave,
  onOpenProject,
}: {
  task: DashboardTask;
  scopeKey: string;
  projects: DashboardProject[];
  onClose: () => void;
  onSave: (task: DashboardTask) => void;
  onOpenProject: (projectId: string) => void;
}) {
  const { t, locale } = useTranslation(messages);

  const dialog = useRef<HTMLDialogElement>(null);
  const commentsViewport = useRef<HTMLDivElement>(null);
  const commentInput = useRef<HTMLTextAreaElement>(null);
  const uploadReader = useRef<FileReader | null>(null);
  const titleId = useId();
  const commentPanelId = useId();
  const { notify } = useAppAlert();
  const [draft, setDraft] = useState(task);
  const [tab, setTab] = useState<DetailTab>('Comment');
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<DashboardComment | null>(null);
  const [attachment, setAttachment] = useState<DashboardAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState('');
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const element = dialog.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => {
      uploadReader.current?.abort();
      element?.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  function toggleCollaborator(id: DashboardPersonId) {
    setDraft((current) => ({
      ...current,
      collaborators: current.collaborators.includes(id)
        ? current.collaborators.filter((person) => person !== id)
        : [...current.collaborators, id],
    }));
  }

  function deleteComment(id: string) {
    const removedIds = new Set([id]);
    const queue = [id];
    while (queue.length) {
      const parentId = queue.shift();
      for (const comment of draft.comments) {
        if (comment.replyTo === parentId && !removedIds.has(comment.id)) {
          removedIds.add(comment.id);
          queue.push(comment.id);
        }
      }
    }
    setDraft((current) => {
      const comments = current.comments.filter((comment) => !removedIds.has(comment.id));
      return {
        ...current,
        comments,
        commentCount: comments.length,
        links: comments.filter((comment) => comment.attachment).length,
      };
    });
    if (replyTo && removedIds.has(replyTo.id)) setReplyTo(null);
  }

  function save() {
    const error = taskSettingError(draft, projects);
    if (error) {
      setSaveError(error);
      setTab('Setting');
      return;
    }
    if (attachmentLoading) return;
    setSaveError('');
    const text = commentText.trim();
    const newComment: DashboardComment | undefined =
      text || attachment
        ? {
            id: crypto.randomUUID(),
            author: 'sarah',
            text,
            time: dashboardTimestamp(),
            replyTo: replyTo?.id,
            attachment: attachment ?? undefined,
          }
        : undefined;
    const comments = newComment ? [...draft.comments, newComment] : draft.comments;
    const next = {
      ...draft,
      title: draft.title.trim(),
      detailTitle: draft.detailTitle.trim(),
      comments,
      commentCount: comments.length,
      links: comments.filter((comment) => comment.attachment).length,
    };
    onSave(next);
    setDraft(next);
    if (newComment) {
      setCommentText('');
      setReplyTo(null);
      setAttachment(null);
      setAttachmentError('');
      setTab('Comment');
      window.requestAnimationFrame(() => {
        const viewport = commentsViewport.current;
        if (viewport) viewport.scrollTop = viewport.scrollHeight;
      });
    }
    notify('success', translateFixed(newComment ? 'Comment added' : 'Changes saved', locale));
  }

  function uploadAttachment(file: File) {
    uploadReader.current?.abort();
    setAttachmentLoading(false);
    setAttachment(null);
    setAttachmentError('');
    if (file.size > 1024 * 1024) {
      setAttachmentError('Choose a file no larger than 1 MB.');
      return;
    }
    const reader = new FileReader();
    uploadReader.current = reader;
    setAttachmentLoading(true);
    reader.onload = () => {
      const size = file.size >= 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${file.size} B`;
      setAttachment({ name: file.name, size, kind: 'file', content: String(reader.result) });
      setAttachmentLoading(false);
    };
    reader.onerror = () => {
      setAttachmentError('Could not read the file. Please choose it again.');
      setAttachmentLoading(false);
    };
    reader.readAsDataURL(file);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        dashboardLink(window.location.href, scopeKey, { kind: 'task', id: draft.id }),
      );
      notify('success', t('Task link copied'));
    } catch {
      notify('error', t('Could not copy the task link'));
    }
  }

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose();
        }
      }}
    >
      <div className={styles.surface}>
        <header className={styles.header}>
          <h2 id={titleId}>{fixtureField(draft, 'detailTitle', locale)}</h2>
          <div className={styles.headerActions}>
            <IconButton
              label={draft.starred ? t('Remove from favorites') : t('Add to favorites')}
              aria-pressed={draft.starred}
              onClick={() => setDraft((current) => ({ ...current, starred: !current.starred }))}
            >
              <Star size={17} weight={draft.starred ? 'fill' : 'regular'} />
            </IconButton>
            <IconButton label={t('Copy task link')} onClick={() => void copyLink()}>
              <Link size={17} />
            </IconButton>
            <IconButton label={t('Close task details')} onClick={onClose}>
              <X size={17} />
            </IconButton>
          </div>
        </header>
        <DashboardTaskFields task={draft} onChange={setDraft} />
        <div className={styles.tabBar}>
          <SegmentedControl
            items={tabs}
            value={tab}
            onChange={(value) => setTab(value as DetailTab)}
            label={t('Task detail sections')}
          />
        </div>
        {saveError ? (
          <p role="alert" className={styles.saveError}>
            {saveError}
          </p>
        ) : null}
        {tab === 'Comment' ? (
          <>
            <div
              className={styles.commentsViewport}
              id={commentPanelId}
              ref={commentsViewport}
              aria-label={t('Task comments')}
            >
              <div className={styles.comments}>
                {draft.comments.length ? (
                  draft.comments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      onReply={() => {
                        setReplyTo(comment);
                        window.requestAnimationFrame(() => commentInput.current?.focus());
                      }}
                      onLike={() =>
                        setDraft((current) => ({
                          ...current,
                          comments: current.comments.map((item) =>
                            item.id === comment.id ? { ...item, liked: !item.liked } : item,
                          ),
                        }))
                      }
                      onDelete={() => deleteComment(comment.id)}
                    />
                  ))
                ) : (
                  <p className={styles.emptyComments}>{t('No comments yet.')}</p>
                )}
              </div>
            </div>
            <DashboardTaskComposer
              commentText={commentText}
              onChange={setCommentText}
              textareaRef={commentInput}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              attachment={attachment}
              onRemoveAttachment={() => {
                setAttachment(null);
                setAttachmentError('');
              }}
              onAttachFile={uploadAttachment}
              attachmentLoading={attachmentLoading}
              error={attachmentError}
            />
          </>
        ) : tab === 'Description' ? (
          <div className={styles.detailContent}>
            <label htmlFor={`${titleId}-description`} className={styles.sectionLabel}>
              {t('Description')}
            </label>
            <textarea
              id={`${titleId}-description`}
              className={styles.descriptionInput}
              value={draft.description}
              onChange={(event) => {
                const description = event.currentTarget.value;
                setDraft((current) => ({ ...current, description }));
              }}
              placeholder={t('Add a task description')}
            />
          </div>
        ) : (
          <DashboardTaskSettings
            task={draft}
            projects={projects}
            onChange={(next) => {
              setDraft(next);
              setSaveError('');
            }}
            onOpenProject={onOpenProject}
          />
        )}
        <footer className={styles.footer}>
          <div className={styles.collaborators}>
            <span>{t('Collaborators')}</span>
            <AvatarGroup ids={draft.collaborators} size={26} />
            <PeopleMenu
              label={t('Edit collaborators')}
              selected={draft.collaborators}
              onToggle={toggleCollaborator}
            />
          </div>
          <Button type="button" variant="outline" className={styles.cancelButton} onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            type="button"
            className={styles.saveButton}
            loading={attachmentLoading}
            onClick={save}
          >
            {t('Save')}
          </Button>
        </footer>
      </div>
    </dialog>
  );
}

registerProjectFixtures([tabs]);
