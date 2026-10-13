'use client';

import { useState } from 'react';
import { DownloadSimple, File } from '@phosphor-icons/react';
import { Avatar } from './dashboard-ui';
import { downloadFile } from './dashboard-download';
import {
  dashboardPeople,
  type DashboardAttachment,
  type DashboardComment,
} from './dashboard-model';
import styles from './dashboard-task-dialog.module.css';

export function MentionText({ text }: { text: string }) {
  return text.split(/(@[\w.]+)/g).map((part, index) =>
    part.startsWith('@') ? (
      <span key={index} className={styles.mention}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function AttachmentIcon({ kind }: { kind: DashboardAttachment['kind'] }) {
  if (kind === 'file') return <File className={styles.fileIcon} size={17} />;
  // The reference marks are the only attachment assets supplied in the video.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={styles.fileIcon}
      src={`/project-dashboard/${kind}.webp`}
      width={kind === 'figma' ? 12 : 18}
      height={17}
      alt=""
      style={{ width: kind === 'figma' ? 12 : 18 }}
    />
  );
}

function downloadAttachment(attachment: DashboardAttachment) {
  const match = attachment.content?.match(/^data:[^,]*;base64,([\s\S]*)$/);
  if (!match) return;
  // Download as bytes; attached HTML is never rendered or executed in a preview.
  const bytes = Uint8Array.from(atob(match[1]), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.name.replace(/[<>:"/\\|?*]/g, '-');
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function AttachmentPreview({ attachment }: { attachment: DashboardAttachment }) {
  const original = attachment.kind === 'file' && Boolean(attachment.content);
  const image = original && /^data:image\/(png|jpeg|gif|webp);base64,/i.test(attachment.content!);
  const notes =
    attachment.kind === 'figma'
      ? 'A clean project dashboard with a neutral canvas, rounded cards, and clear task priorities.'
      : 'Keep layouts consistent, use the shared typography scale, and make every status easy to recognize.';

  return (
    <div className={styles.attachmentPreview}>
      <strong>{original ? attachment.name : 'Reference attachment'}</strong>
      {original ? (
        <>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={styles.attachmentImage}
              src={attachment.content}
              alt={attachment.name}
            />
          ) : (
            <p>{attachment.size} · Original file</p>
          )}
          <button
            type="button"
            className={`fouc-action ${styles.downloadAttachment}`}
            onClick={() => downloadAttachment(attachment)}
          >
            <DownloadSimple size={13} />
            Download file
          </button>
        </>
      ) : (
        <>
          <p>The video provides this file name only; its original file was not supplied.</p>
          <p>{notes}</p>
          <button
            type="button"
            className={`fouc-action ${styles.downloadAttachment}`}
            onClick={() =>
              downloadFile(
                `${attachment.name}-reference-notes.txt`,
                `${attachment.name}\n\nThe source video shows this attachment label. The original file was not supplied.\n\n${notes}\n`,
              )
            }
          >
            <DownloadSimple size={13} />
            Download reference notes
          </button>
        </>
      )}
    </div>
  );
}

export function CommentItem({
  comment,
  onReply,
  onLike,
  onDelete,
}: {
  comment: DashboardComment;
  onReply: () => void;
  onLike: () => void;
  onDelete: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const person = dashboardPeople[comment.author];

  return (
    <article className={styles.comment} data-reply={Boolean(comment.replyTo)}>
      <div className={styles.commentAvatar}>
        <Avatar id={comment.author} size={27} />
      </div>
      <div className={styles.commentContent}>
        <div className={styles.commentMeta}>
          <strong>{person.name}</strong>
          <span aria-hidden>·</span>
          <time>{comment.time}</time>
        </div>
        <div className={styles.commentBubble}>
          {comment.text ? (
            <p>
              <MentionText text={comment.text} />
            </p>
          ) : null}
          {comment.attachment ? (
            <>
              <button
                type="button"
                className={`${styles.attachment} fouc-action`}
                aria-expanded={previewOpen}
                onClick={() => setPreviewOpen((open) => !open)}
              >
                <AttachmentIcon kind={comment.attachment.kind} />
                <span>{comment.attachment.name}</span>
                <small>{comment.attachment.size}</small>
              </button>
              {previewOpen ? <AttachmentPreview attachment={comment.attachment} /> : null}
            </>
          ) : null}
        </div>
        {confirmDelete ? (
          <div className={styles.commentActions}>
            <span>Delete comment{comment.replyTo ? '' : ' and its replies'}?</span>
            <button type="button" className="fouc-action" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={`${styles.delete} fouc-action`}
              data-variant="destructive"
              onClick={onDelete}
            >
              Delete
            </button>
          </div>
        ) : (
          <div className={styles.commentActions}>
            <button type="button" className="fouc-action" onClick={onReply}>
              Reply
            </button>
            <span aria-hidden>·</span>
            <button
              type="button"
              className="fouc-action"
              aria-pressed={Boolean(comment.liked)}
              onClick={onLike}
            >
              {comment.liked ? 'Liked' : 'Like'}
            </button>
            <span aria-hidden>·</span>
            <button
              type="button"
              className={`${styles.delete} fouc-action`}
              data-variant="destructive"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
