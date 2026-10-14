'use client';
import { translateFixed } from '../i18n/display';

import { getLocale, useTranslation } from '@/lib/i18n';
import { fixtureField } from '../i18n/display';
import { messages } from './i18n/dashboard-meeting-dialog';

import { useAppAlert } from '@/components/app-alert-provider';
import { CalendarBlank, LinkSimple, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { DashboardDeleteDialog } from './dashboard-actions';
import common from './dashboard-actions.module.css';
import { downloadFile } from './dashboard-download';
import { dashboardLink } from './dashboard-links';
import styles from './dashboard-meeting-dialog.module.css';
import { DashboardMemberPicker, DashboardModal } from './dashboard-modal';
import {
  dashboardPeople,
  type DashboardComment,
  type DashboardMeeting,
  type DashboardPersonId,
} from './dashboard-model';
import { dashboardTimestamp } from './dashboard-time';
import { Avatar, DashboardButton, IconButton, SegmentedControl } from './dashboard-ui';

function newMeeting(): DashboardMeeting {
  return {
    id: crypto.randomUUID(),
    title: '',
    startsAt: '2027-02-08T10:00',
    durationMinutes: 60,
    agenda: '',
    attendees: ['sarah'],
    link: '',
    comments: [],
  };
}

function localParts(value: string) {
  return { date: value.slice(0, 10), time: value.slice(11, 16) };
}

function calendarStamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
}
function calendarText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}
function foldCalendarLine(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let part = '';
  let size = 0;
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (size + bytes > 75) {
      parts.push(part);
      part = ' ';
      size = 1;
    }
    part += character;
    size += bytes;
  }
  parts.push(part);
  return parts.join('\r\n');
}
export function calendarFile(meeting: DashboardMeeting) {
  const locale = getLocale();
  const start = new Date(meeting.startsAt);
  const end = new Date(start.valueOf() + meeting.durationMinutes * 60000);
  const attendees = meeting.attendees.map((id) => dashboardPeople[id].name).join(', ');
  const description = `${fixtureField(meeting, 'agenda', locale)}${attendees ? `\n\n${translateFixed('Attendees', locale)}: ${attendees}` : ''}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fouc//Project Dashboard//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${meeting.id}@fouc.local`,
    `DTSTAMP:${calendarStamp(new Date())}`,
    `DTSTART:${calendarStamp(start)}`,
    `DTEND:${calendarStamp(end)}`,
    `SUMMARY:${calendarText(fixtureField(meeting, 'title', locale))}`,
    `DESCRIPTION:${calendarText(description)}`,
  ];
  if (meeting.link) lines.push(`URL:${new URL(meeting.link).href}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(foldCalendarLine).join('\r\n') + '\r\n';
}

function MeetingComments({
  comments,
  onChange,
  text,
  onTextChange,
}: {
  comments: DashboardComment[];
  onChange: (comments: DashboardComment[]) => void;
  text: string;
  onTextChange: (text: string) => void;
}) {
  const { t, locale } = useTranslation(messages);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  function addComment() {
    if (!text.trim()) return;
    onChange([
      ...comments,
      {
        id: crypto.randomUUID(),
        author: 'sarah',
        text: text.trim(),
        time: dashboardTimestamp(),
      },
    ]);
    onTextChange('');
  }
  return (
    <div className={styles.comments}>
      {comments.length ? (
        comments.map((comment) => (
          <article key={comment.id} className={styles.comment}>
            <Avatar id={comment.author} size={28} />
            <div className={styles.commentContent}>
              <div className={styles.commentMeta}>
                <strong>{fixtureField(dashboardPeople[comment.author], 'name', locale)}</strong>
                <span>{fixtureField(comment, 'time', locale)}</span>
              </div>
              <p>{fixtureField(comment, 'text', locale)}</p>
              {deleteId === comment.id ? (
                <div className={styles.commentActions}>
                  <span>{t('Delete comment?')}</span>
                  <button type="button" className="fouc-action" onClick={() => setDeleteId(null)}>
                    {t('Cancel')}
                  </button>
                  <button
                    type="button"
                    className="fouc-action"
                    data-variant="destructive"
                    onClick={() => {
                      onChange(comments.filter((current) => current.id !== comment.id));
                      setDeleteId(null);
                    }}
                  >
                    {t('Delete')}
                  </button>
                </div>
              ) : (
                <div className={styles.commentActions}>
                  <button
                    type="button"
                    className="fouc-action"
                    aria-pressed={!!comment.liked}
                    onClick={() =>
                      onChange(
                        comments.map((current) =>
                          current.id === comment.id
                            ? { ...current, liked: !current.liked }
                            : current,
                        ),
                      )
                    }
                  >
                    {comment.liked ? t('Liked') : t('Like')}
                  </button>
                  <button
                    type="button"
                    className="fouc-action"
                    data-variant="destructive"
                    onClick={() => setDeleteId(comment.id)}
                  >
                    {t('Delete')}
                  </button>
                </div>
              )}
            </div>
          </article>
        ))
      ) : (
        <p className={styles.empty}>{t('No comments yet.')}</p>
      )}
      <label className={common.fieldLabel}>
        {t('Add a comment')}
        <textarea
          className={common.textInput}
          rows={3}
          value={text}
          onChange={(event) => onTextChange(event.currentTarget.value)}
          placeholder={t('Share an update or an agenda item')}
        />
      </label>
      <div className={styles.commentAdd}>
        <DashboardButton type="button" tone="neutral" disabled={!text.trim()} onClick={addComment}>
          {t('Add comment')}
        </DashboardButton>
      </div>
    </div>
  );
}

export function DashboardMeetingDialog({
  meeting,
  scopeKey,
  memberIds,
  onClose,
  onSave,
  onDelete,
}: {
  meeting?: DashboardMeeting;
  scopeKey: string;
  memberIds: DashboardPersonId[];
  onClose: () => void;
  onSave: (meeting: DashboardMeeting) => void;
  onDelete?: (id: string) => void;
}) {
  const { t, locale } = useTranslation(messages);

  const [draft, setDraft] = useState(() => meeting ?? newMeeting());
  const [date, setDate] = useState(() => localParts(draft.startsAt).date);
  const [time, setTime] = useState(() => localParts(draft.startsAt).time);
  const [tab, setTab] = useState<'Details' | 'Comments'>('Details');
  const [commentText, setCommentText] = useState('');
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { notify } = useAppAlert();

  function collectMeeting(): DashboardMeeting | null {
    if (!draft.title.trim()) {
      setError('Enter a meeting title.');
      setTab('Details');
      return null;
    }
    const startsAt = new Date(`${date}T${time}`);
    if (
      !date ||
      !time ||
      !Number.isFinite(startsAt.valueOf()) ||
      !Number.isFinite(draft.durationMinutes) ||
      draft.durationMinutes < 5 ||
      draft.durationMinutes > 1440
    ) {
      setError('Choose a valid date, time and duration.');
      setTab('Details');
      return null;
    }
    if (draft.link) {
      try {
        const url = new URL(draft.link);
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
      } catch {
        setError('Use an http or https meeting link.');
        setTab('Details');
        return null;
      }
    }
    setError('');
    return {
      ...draft,
      title: draft.title.trim(),
      startsAt: `${date}T${time}`,
      link: draft.link.trim(),
    };
  }

  function save() {
    const next = collectMeeting();
    if (!next) return;
    if (commentText.trim())
      next.comments = [
        ...next.comments,
        {
          id: crypto.randomUUID(),
          author: 'sarah',
          text: commentText.trim(),
          time: dashboardTimestamp(),
        },
      ];
    onSave(next);
    notify('success', translateFixed(meeting ? 'Meeting saved' : 'Meeting created', locale));
    onClose();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        dashboardLink(window.location.href, scopeKey, { kind: 'meeting', id: draft.id }),
      );
      notify('success', t('Meeting link copied'));
    } catch {
      notify('error', t('Could not copy the meeting link'));
    }
  }

  return (
    <>
      <DashboardModal
        title={meeting ? t('Meeting details') : t('New Meeting')}
        onClose={onClose}
        wide
      >
        <div className={styles.toolbar}>
          <SegmentedControl
            items={['Details', 'Comments'] as const}
            value={tab}
            onChange={setTab}
            label={t('Meeting view')}
          />
          <span className={styles.commentCount}>
            {draft.comments.length} {t('comments')}
          </span>
          {meeting && onDelete ? (
            <IconButton
              label={t('Delete meeting')}
              className={styles.dangerIcon}
              data-variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash size={16} />
            </IconButton>
          ) : null}
        </div>
        <form
          className={common.form}
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className={common.scrollBody}>
            {tab === 'Details' ? (
              <div className={common.fields}>
                <label>
                  {t('Meeting title')}
                  <input
                    autoFocus
                    value={draft.title}
                    onChange={(event) => {
                      setDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }));
                      setError('');
                    }}
                    placeholder={t('Give it a name')}
                  />
                </label>
                <div className={common.fieldGrid}>
                  <label>
                    {t('Date')}
                    <input
                      type="date"
                      value={date}
                      onInput={(event) => setDate(event.currentTarget.value)}
                    />
                  </label>
                  <label>
                    {t('Time')}
                    <input
                      type="time"
                      value={time}
                      onInput={(event) => setTime(event.currentTarget.value)}
                    />
                  </label>
                </div>
                <label>
                  {t('Duration (minutes)')}
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    step="5"
                    value={draft.durationMinutes}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        durationMinutes: Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  {t('Agenda')}
                  <textarea
                    rows={4}
                    value={draft.agenda}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        agenda: event.target.value,
                      }))
                    }
                    placeholder={t('Topics, decisions and next steps')}
                  />
                </label>
                <label>
                  {t('Meeting link')}
                  <input
                    type="url"
                    value={draft.link}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        link: event.target.value,
                      }))
                    }
                    placeholder={t('https://…')}
                  />
                </label>
                <fieldset className={common.memberField}>
                  <legend>{t('Attendees')}</legend>
                  <DashboardMemberPicker
                    selected={draft.attendees}
                    onChange={(attendees) => setDraft((current) => ({ ...current, attendees }))}
                    ids={Array.from(new Set([...memberIds, ...draft.attendees]))}
                  />
                </fieldset>
                {error ? (
                  <p role="alert" className={common.error}>
                    {translateFixed(error, locale)}
                  </p>
                ) : null}
              </div>
            ) : (
              <MeetingComments
                comments={draft.comments}
                onChange={(comments) => setDraft((current) => ({ ...current, comments }))}
                text={commentText}
                onTextChange={setCommentText}
              />
            )}
          </div>
          <footer>
            <div className={styles.exports}>
              {meeting ? (
                <DashboardButton type="button" tone="neutral" onClick={() => void copyLink()}>
                  <LinkSimple size={13} />
                  {t('Copy link')}
                </DashboardButton>
              ) : null}
              <DashboardButton
                type="button"
                tone="neutral"
                onClick={() => {
                  const next = collectMeeting();
                  if (next)
                    downloadFile(
                      `${next.title}.ics`,
                      calendarFile(next),
                      'text/calendar;charset=utf-8',
                    );
                }}
              >
                <CalendarBlank size={13} />
                {t('Export ICS')}
              </DashboardButton>
            </div>
            <DashboardButton type="button" tone="neutral" onClick={onClose}>
              {t('Cancel')}
            </DashboardButton>
            <DashboardButton type="submit">{t('Save')}</DashboardButton>
          </footer>
        </form>
      </DashboardModal>
      {deleteOpen ? (
        <DashboardDeleteDialog
          title={t('Delete meeting?')}
          description={t('“{v0}” and its comments will be removed from this dashboard.', {
            v0: fixtureField(draft, 'title', locale),
          })}
          onClose={() => setDeleteOpen(false)}
          onDelete={() => {
            onDelete?.(draft.id);
            notify('success', t('Meeting deleted'));
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
