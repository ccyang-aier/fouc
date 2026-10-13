'use client';

import { useState } from 'react';
import { CalendarBlank, LinkSimple, Trash } from '@phosphor-icons/react';
import { useAppAlert } from '@/components/app-alert-provider';
import { Avatar, DashboardButton, IconButton, SegmentedControl } from './dashboard-ui';
import { DashboardMemberPicker, DashboardModal } from './dashboard-modal';
import { DashboardDeleteDialog } from './dashboard-actions';
import { downloadFile } from './dashboard-download';
import { dashboardLink } from './dashboard-links';
import { dashboardTimestamp } from './dashboard-time';
import {
  dashboardPeople,
  type DashboardComment,
  type DashboardMeeting,
  type DashboardPersonId,
} from './dashboard-model';
import common from './dashboard-actions.module.css';
import styles from './dashboard-meeting-dialog.module.css';

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
function calendarFile(meeting: DashboardMeeting) {
  const start = new Date(meeting.startsAt);
  const end = new Date(start.valueOf() + meeting.durationMinutes * 60000);
  const attendees = meeting.attendees.map((id) => dashboardPeople[id].name).join(', ');
  const description = `${meeting.agenda}${attendees ? `\n\nAttendees: ${attendees}` : ''}`;
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
    `SUMMARY:${calendarText(meeting.title)}`,
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
                <strong>{dashboardPeople[comment.author].name}</strong>
                <span>{comment.time}</span>
              </div>
              <p>{comment.text}</p>
              {deleteId === comment.id ? (
                <div className={styles.commentActions}>
                  <span>Delete comment?</span>
                  <button type="button" className="fouc-action" onClick={() => setDeleteId(null)}>
                    Cancel
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
                    Delete
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
                    {comment.liked ? 'Liked' : 'Like'}
                  </button>
                  <button
                    type="button"
                    className="fouc-action"
                    data-variant="destructive"
                    onClick={() => setDeleteId(comment.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </article>
        ))
      ) : (
        <p className={styles.empty}>No comments yet.</p>
      )}
      <label className={common.fieldLabel}>
        Add a comment
        <textarea
          className={common.textInput}
          rows={3}
          value={text}
          onChange={(event) => onTextChange(event.currentTarget.value)}
          placeholder="Share an update or an agenda item"
        />
      </label>
      <div className={styles.commentAdd}>
        <DashboardButton type="button" tone="neutral" disabled={!text.trim()} onClick={addComment}>
          Add comment
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
    notify('success', meeting ? 'Meeting saved' : 'Meeting created');
    onClose();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        dashboardLink(window.location.href, scopeKey, { kind: 'meeting', id: draft.id }),
      );
      notify('success', 'Meeting link copied');
    } catch {
      notify('error', 'Could not copy the meeting link');
    }
  }

  return (
    <>
      <DashboardModal title={meeting ? 'Meeting details' : 'New Meeting'} onClose={onClose} wide>
        <div className={styles.toolbar}>
          <SegmentedControl
            items={['Details', 'Comments'] as const}
            value={tab}
            onChange={setTab}
            label="Meeting view"
          />
          <span className={styles.commentCount}>{draft.comments.length} comments</span>
          {meeting && onDelete ? (
            <IconButton
              label="Delete meeting"
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
                  Meeting title
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
                    placeholder="Give it a name"
                  />
                </label>
                <div className={common.fieldGrid}>
                  <label>
                    Date
                    <input
                      type="date"
                      value={date}
                      onInput={(event) => setDate(event.currentTarget.value)}
                    />
                  </label>
                  <label>
                    Time
                    <input
                      type="time"
                      value={time}
                      onInput={(event) => setTime(event.currentTarget.value)}
                    />
                  </label>
                </div>
                <label>
                  Duration (minutes)
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
                  Agenda
                  <textarea
                    rows={4}
                    value={draft.agenda}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        agenda: event.target.value,
                      }))
                    }
                    placeholder="Topics, decisions and next steps"
                  />
                </label>
                <label>
                  Meeting link
                  <input
                    type="url"
                    value={draft.link}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        link: event.target.value,
                      }))
                    }
                    placeholder="https://…"
                  />
                </label>
                <fieldset className={common.memberField}>
                  <legend>Attendees</legend>
                  <DashboardMemberPicker
                    selected={draft.attendees}
                    onChange={(attendees) => setDraft((current) => ({ ...current, attendees }))}
                    ids={Array.from(new Set([...memberIds, ...draft.attendees]))}
                  />
                </fieldset>
                {error ? (
                  <p role="alert" className={common.error}>
                    {error}
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
                  Copy link
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
                Export ICS
              </DashboardButton>
            </div>
            <DashboardButton type="button" tone="neutral" onClick={onClose}>
              Cancel
            </DashboardButton>
            <DashboardButton type="submit">Save</DashboardButton>
          </footer>
        </form>
      </DashboardModal>
      {deleteOpen ? (
        <DashboardDeleteDialog
          title="Delete meeting?"
          description={`“${draft.title}” and its comments will be removed from this dashboard.`}
          onClose={() => setDeleteOpen(false)}
          onDelete={() => {
            onDelete?.(draft.id);
            notify('success', 'Meeting deleted');
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
