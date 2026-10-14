'use client';
import { translateFixed } from '../i18n/display';

import { useTranslation } from '@/lib/i18n';
import { fixtureField } from '../i18n/display';
import { messages } from './i18n/dashboard-task-composer';

import { At, Paperclip, X } from '@phosphor-icons/react';
import { useId, useRef, useState, type RefObject } from 'react';
import { MentionText } from './dashboard-comments';
import {
  dashboardPeople,
  type DashboardAttachment,
  type DashboardComment,
  type DashboardPersonId,
} from './dashboard-model';
import styles from './dashboard-task-dialog.module.css';
import { Avatar } from './dashboard-ui';

const people = Object.values(dashboardPeople);

interface DashboardTaskComposerProps {
  commentText: string;
  onChange: (text: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  replyTo: DashboardComment | null;
  onCancelReply: () => void;
  attachment: DashboardAttachment | null;
  onRemoveAttachment: () => void;
  onAttachFile: (file: File) => void;
  attachmentLoading: boolean;
  error: string;
}

export function DashboardTaskComposer({
  commentText,
  onChange,
  textareaRef,
  replyTo,
  onCancelReply,
  attachment,
  onRemoveAttachment,
  onAttachFile,
  attachmentLoading,
  error,
}: DashboardTaskComposerProps) {
  const { t, locale } = useTranslation(messages);

  const editorMirror = useRef<HTMLDivElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const mentionsId = useId();
  const [caret, setCaret] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState(false);
  const mentionMatch = commentText.slice(0, caret).match(/(?:^|\s)@([\w.]*)$/);
  const mentionQuery = mentionMatch?.[1].toLowerCase();
  const mentionChoices =
    !mentionDismissed && mentionQuery !== undefined
      ? people.filter((person) =>
          `${person.handle} ${person.name}`.toLowerCase().includes(mentionQuery),
        )
      : [];

  function insertMention(id: DashboardPersonId) {
    const handle = `@${dashboardPeople[id].handle} `;
    const start = mentionMatch ? caret - (mentionMatch[1].length + 1) : caret;
    const nextText = commentText.slice(0, start) + handle + commentText.slice(caret);
    const nextCaret = start + handle.length;
    onChange(nextText);
    setCaret(nextCaret);
    setMentionDismissed(true);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  return (
    <div className={styles.composer} aria-busy={attachmentLoading || undefined}>
      <Avatar id="sarah" size={27} />
      <div className={styles.composerBody}>
        {replyTo ? (
          <div className={styles.replyLabel}>
            {t('Replying to')}
            {fixtureField(dashboardPeople[replyTo.author], 'name', locale)}
            <button
              type="button"
              className="fouc-action"
              aria-label={t('Cancel reply')}
              onClick={onCancelReply}
            >
              <X size={12} />
            </button>
          </div>
        ) : null}
        <div className={styles.commentEditor}>
          <div className={styles.editorMirror} ref={editorMirror} aria-hidden>
            <MentionText text={commentText} />
          </div>
          <textarea
            ref={textareaRef}
            value={commentText}
            rows={Math.min(4, Math.max(1, commentText.split('\n').length))}
            placeholder={t('Add a comment')}
            aria-label={t('Add a comment')}
            aria-controls={mentionChoices.length ? mentionsId : undefined}
            onScroll={(event) => {
              if (editorMirror.current)
                editorMirror.current.scrollTop = event.currentTarget.scrollTop;
            }}
            onChange={(event) => {
              const text = event.currentTarget.value;
              const caret = event.currentTarget.selectionStart;
              onChange(text);
              setCaret(caret);
              setMentionDismissed(false);
              setMentionIndex(0);
            }}
            onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
            onKeyDown={(event) => {
              if (!mentionChoices.length) return;
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const direction = event.key === 'ArrowDown' ? 1 : -1;
                setMentionIndex(
                  (current) =>
                    (current + direction + mentionChoices.length) % mentionChoices.length,
                );
              } else if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                insertMention(mentionChoices[mentionIndex % mentionChoices.length].id);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setMentionDismissed(true);
              }
            }}
          />
          <div className={styles.composerTools}>
            <button
              type="button"
              className="fouc-action"
              aria-label={t('Attach a file')}
              onClick={() => attachmentInput.current?.click()}
            >
              <Paperclip size={13} />
            </button>
            <button
              type="button"
              className="fouc-action"
              aria-label={t('Mention a collaborator')}
              onClick={() => {
                const next = `${commentText}${commentText && !commentText.endsWith(' ') ? ' ' : ''}@`;
                onChange(next);
                setCaret(next.length);
                setMentionDismissed(false);
                setMentionIndex(0);
                textareaRef.current?.focus();
              }}
            >
              <At size={13} />
            </button>
          </div>
        </div>
        <input
          ref={attachmentInput}
          type="file"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onAttachFile(file);
            event.currentTarget.value = '';
          }}
        />
        {attachment ? (
          <div className={styles.pendingAttachment}>
            <Paperclip size={13} />
            <span title={fixtureField(attachment, 'name', locale)}>
              {fixtureField(attachment, 'name', locale)}
            </span>
            <small>{attachment.size}</small>
            <button
              type="button"
              className="fouc-action"
              aria-label={t('Remove attached file')}
              onClick={onRemoveAttachment}
            >
              <X size={13} />
            </button>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className={styles.attachmentError}>
            {translateFixed(error, locale)}
          </p>
        ) : null}
        {mentionChoices.length ? (
          <div
            id={mentionsId}
            className={`${styles.mentionMenu} menu-surface`}
            role="listbox"
            aria-label={t('Mention people')}
          >
            {mentionChoices.map((person, index) => (
              <button
                key={person.id}
                type="button"
                role="option"
                aria-selected={index === mentionIndex % mentionChoices.length}
                data-highlighted={index === mentionIndex % mentionChoices.length || undefined}
                className="fouc-menu-item"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertMention(person.id)}
              >
                <Avatar id={person.id} size={22} />
                <span>
                  {fixtureField(person, 'name', locale)}
                  <small>@{person.handle}</small>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
