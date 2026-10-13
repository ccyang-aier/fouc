'use client';

import { At, CalendarBlank, CaretDown, Check, CircleDashed, Flame, Link, Plus, SealCheck, Star, Tag, User, X } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useAppAlert } from '@/components/app-alert-provider';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarGroup, IconButton, SegmentedControl } from './dashboard-ui';
import { dashboardPeople, type DashboardAttachment, type DashboardComment, type DashboardPersonId, type DashboardPriority, type DashboardStatus, type DashboardTask } from './dashboard-model';
import styles from './dashboard-task-dialog.module.css';

type DetailTab = 'Description' | 'Comment' | 'Setting';
const tabs: DetailTab[] = ['Description', 'Comment', 'Setting'];
const people = Object.values(dashboardPeople);
const priorities: DashboardPriority[] = ['Low', 'Medium', 'High', 'Urgent'];
const statuses: DashboardStatus[] = ['To Do', 'On Progress', 'Completed'];

function ChoiceMenu({ label, value, values, onChange, icon, compact = false }: { label: string; value: string; values: string[]; onChange: (value: string) => void; icon?: ReactNode; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <DropdownMenu open={open} onOpenChange={setOpen}>
    <DropdownMenuTrigger className={compact ? styles.priority : styles.control} aria-label={`${label}: ${value}`} data-priority={compact ? value.toLowerCase() : undefined}>
      {icon}{value}{compact ? null : <CaretDown size={13} className={styles.caret} />}
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" density="compact">
      {values.map(option => <DropdownMenuItem key={option} onSelect={() => onChange(option)}>{option}<span className={styles.menuCheck}>{option === value ? <Check size={13} /> : null}</span></DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}

function PeopleMenu({ label, selected, onToggle, children }: { label: string; selected: DashboardPersonId[]; onToggle: (id: DashboardPersonId) => void; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <DropdownMenu open={open} onOpenChange={setOpen}>
    <DropdownMenuTrigger className={`${styles.addPerson} fouc-action`} aria-label={label}>{children ?? <Plus size={13} />}</DropdownMenuTrigger>
    <DropdownMenuContent align="start" density="compact">
      {people.map(person => <DropdownMenuCheckboxItem key={person.id} checked={selected.includes(person.id)} onCheckedChange={() => onToggle(person.id)} onSelect={event => event.preventDefault()}><Avatar id={person.id} size={22} />{person.name}</DropdownMenuCheckboxItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}

function MentionText({ text }: { text: string }) {
  return text.split(/(@[\w.]+)/g).map((part, index) => part.startsWith('@') ? <span key={index} className={styles.mention}>{part}</span> : part);
}

function AttachmentIcon({ kind }: { kind: DashboardAttachment['kind'] }) {
  // These tiny file marks are extracted from the supplied video.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.fileIcon} src={`/project-dashboard/${kind}.webp`} width={kind === 'figma' ? 12 : 18} height={17} alt="" style={{ width: kind === 'figma' ? 12 : 18 }} />;
}

function AttachmentPreview({ attachment }: { attachment: DashboardAttachment }) {
  return <div className={styles.attachmentPreview}>
    <strong>{attachment.kind === 'figma' ? 'Dashboard reference notes' : 'Design guideline notes'}</strong>
    {attachment.kind === 'figma' ? <><p>A clean project dashboard with a neutral canvas, rounded cards, and clear task priorities.</p><div className={styles.swatches} aria-label="Reference colors"><i style={{ background: '#f4f4f5' }} /><i style={{ background: '#111111' }} /><i style={{ background: '#ef9355' }} /><i style={{ background: '#79a393' }} /></div></> : <><p>Keep layouts consistent, use the shared typography scale, and make every status easy to recognize.</p><p>Review the project brief before updating the final design.</p></>}
  </div>;
}

function CommentItem({ comment, onReply, onLike, onDelete }: { comment: DashboardComment; onReply: () => void; onLike: () => void; onDelete: () => void }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const person = dashboardPeople[comment.author];
  return <article className={styles.comment} data-reply={!!comment.replyTo}>
    <div className={styles.commentAvatar}><Avatar id={comment.author} size={27} /></div>
    <div className={styles.commentContent}>
      <div className={styles.commentMeta}><strong>{person.name}</strong><span aria-hidden>·</span><time>{comment.time}</time></div>
      <div className={styles.commentBubble}>
        <p><MentionText text={comment.text} /></p>
        {comment.attachment ? <><button type="button" className={`${styles.attachment} fouc-action`} aria-expanded={previewOpen} onClick={() => setPreviewOpen(open => !open)}><AttachmentIcon kind={comment.attachment.kind} /><span>{comment.attachment.name}</span><small>{comment.attachment.size}</small></button>{previewOpen ? <AttachmentPreview attachment={comment.attachment} /> : null}</> : null}
      </div>
      {confirmDelete ? <div className={styles.commentActions}><span>Delete comment?</span><button type="button" className="fouc-action" onClick={() => setConfirmDelete(false)}>Cancel</button><button type="button" className={`${styles.delete} fouc-action`} data-variant="destructive" onClick={onDelete}>Delete</button></div> : <div className={styles.commentActions}><button type="button" className="fouc-action" onClick={onReply}>Reply</button><span aria-hidden>·</span><button type="button" className="fouc-action" aria-pressed={!!comment.liked} onClick={onLike}>{comment.liked ? 'Liked' : 'Like'}</button><span aria-hidden>·</span><button type="button" className={`${styles.delete} fouc-action`} data-variant="destructive" onClick={() => setConfirmDelete(true)}>Delete</button></div>}
    </div>
  </article>;
}

export function DashboardTaskDialog({ task, onClose, onSave }: { task: DashboardTask; onClose: () => void; onSave: (task: DashboardTask) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const commentsViewport = useRef<HTMLDivElement>(null);
  const commentInput = useRef<HTMLTextAreaElement>(null);
  const editorMirror = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const commentPanelId = useId();
  const { notify } = useAppAlert();
  const [draft, setDraft] = useState(task);
  const [tab, setTab] = useState<DetailTab>('Comment');
  const [commentText, setCommentText] = useState('');
  const [caret, setCaret] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState(false);
  const [replyTo, setReplyTo] = useState<DashboardComment | null>(null);
  const mentionMatch = commentText.slice(0, caret).match(/(?:^|\s)@([\w.]*)$/);
  const mentionQuery = mentionMatch?.[1].toLowerCase();
  const mentionChoices = !mentionDismissed && mentionQuery !== undefined ? people.filter(person => `${person.handle} ${person.name}`.toLowerCase().includes(mentionQuery)) : [];
  const dueDate = new Date(`${draft.dueDate}T12:00:00`);
  const formattedDate = Number.isNaN(dueDate.valueOf()) ? 'Choose a date' : dueDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  function togglePerson(field: 'assignees' | 'collaborators', id: DashboardPersonId) {
    setDraft(current => ({ ...current, [field]: current[field].includes(id) ? current[field].filter(person => person !== id) : [...current[field], id] }));
  }

  function insertMention(id: DashboardPersonId) {
    const handle = `@${dashboardPeople[id].handle} `;
    const start = mentionMatch ? caret - (mentionMatch[1].length + 1) : caret;
    const nextText = commentText.slice(0, start) + handle + commentText.slice(caret);
    const nextCaret = start + handle.length;
    setCommentText(nextText);
    setCaret(nextCaret);
    setMentionDismissed(true);
    window.requestAnimationFrame(() => { commentInput.current?.focus(); commentInput.current?.setSelectionRange(nextCaret, nextCaret); });
  }

  function deleteComment(id: string) {
    setDraft(current => {
      const comments = current.comments.filter(comment => comment.id !== id && comment.replyTo !== id);
      return { ...current, comments, commentCount: Math.max(comments.length, current.commentCount - (current.comments.length - comments.length)) };
    });
    if (replyTo?.id === id) setReplyTo(null);
  }

  function save() {
    const text = commentText.trim();
    const newComment: DashboardComment | undefined = text ? { id: crypto.randomUUID(), author: 'sarah', text, time: 'Now', replyTo: replyTo?.id } : undefined;
    const next = newComment ? { ...draft, comments: [...draft.comments, newComment], commentCount: Math.max(draft.commentCount, draft.comments.length) + 1 } : draft;
    onSave(next);
    setDraft(next);
    if (newComment) {
      setCommentText('');
      setReplyTo(null);
      setTab('Comment');
      window.requestAnimationFrame(() => { const viewport = commentsViewport.current; if (viewport) viewport.scrollTop = viewport.scrollHeight; });
    }
    notify('success', newComment ? 'Comment added' : 'Changes saved');
  }

  async function copyLink() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('dashboardTask', draft.id);
      await navigator.clipboard.writeText(url.toString());
      notify('success', 'Task link copied');
    } catch { notify('error', 'Could not copy the task link'); }
  }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }}>
    <div className={styles.surface}>
      <header className={styles.header}>
        <h2 id={titleId}>{draft.detailTitle}</h2>
        <div className={styles.headerActions}><IconButton label={draft.starred ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={draft.starred} onClick={() => setDraft(current => ({ ...current, starred: !current.starred }))}><Star size={17} weight={draft.starred ? 'fill' : 'regular'} /></IconButton><IconButton label="Copy task link" onClick={() => void copyLink()}><Link size={17} /></IconButton><IconButton label="Close task details" onClick={onClose}><X size={17} /></IconButton></div>
      </header>
      <div className={styles.fields}>
        <div className={styles.fieldRow}><span className={styles.fieldLabel}><User size={16} />Assignee</span><div className={styles.assignees}>{draft.assignees.map(id => <button type="button" key={id} className={`${styles.assigneeChip} fouc-action`} data-person={id} aria-label={`Remove ${dashboardPeople[id].name} from assignees`} onClick={() => togglePerson('assignees', id)}>{dashboardPeople[id].name}<X size={11} /></button>)}<PeopleMenu label="Add assignees" selected={draft.assignees} onToggle={id => togglePerson('assignees', id)} /></div></div>
        <div className={styles.fieldRow}><span className={styles.fieldLabel}><Tag size={16} />Tags</span><ChoiceMenu label="Tag" value={draft.tag} values={['Mobile App', 'Website', 'Dashboard', 'Branding']} onChange={tag => setDraft(current => ({ ...current, tag }))} /></div>
        <div className={styles.fieldRow}><span className={styles.fieldLabel}><SealCheck size={16} />Status</span><ChoiceMenu label="Status" value={draft.status} values={statuses} icon={draft.status === 'Completed' ? <Check size={15} /> : <CircleDashed size={15} />} onChange={status => setDraft(current => ({ ...current, status: status as DashboardStatus, progress: status === 'Completed' ? 100 : current.progress === 100 ? 0 : current.progress }))} /></div>
        <div className={styles.fieldRow}><label className={styles.fieldLabel} htmlFor={`${titleId}-date`}><CalendarBlank size={16} />Due date</label><div className={styles.dateControl}><span>{formattedDate}</span><input id={`${titleId}-date`} type="date" value={draft.dueDate} onClick={event => event.currentTarget.showPicker?.()} onChange={event => { if (event.currentTarget.value) setDraft(current => ({ ...current, dueDate: event.currentTarget.value })); }} aria-label="Due date" /></div></div>
        <div className={styles.fieldRow}><span className={styles.fieldLabel}><Flame size={16} />Priority</span><div><ChoiceMenu compact label="Priority" value={draft.priority} values={priorities} onChange={priority => setDraft(current => ({ ...current, priority: priority as DashboardPriority }))} /></div></div>
      </div>
      <div className={styles.tabBar}><SegmentedControl items={tabs} value={tab} onChange={value => setTab(value as DetailTab)} label="Task detail sections" /></div>
      {tab === 'Comment' ? <>
        <div className={styles.commentsViewport} id={commentPanelId} ref={commentsViewport} aria-label="Task comments">
          <div className={styles.comments}>{draft.comments.length ? draft.comments.map(comment => <CommentItem key={comment.id} comment={comment} onReply={() => { setReplyTo(comment); window.requestAnimationFrame(() => commentInput.current?.focus()); }} onLike={() => setDraft(current => ({ ...current, comments: current.comments.map(item => item.id === comment.id ? { ...item, liked: !item.liked } : item) }))} onDelete={() => deleteComment(comment.id)} />) : <p className={styles.emptyComments}>No comments yet.</p>}</div>
        </div>
        <div className={styles.composer}>
          <Avatar id="sarah" size={27} />
          <div className={styles.composerBody}>
            {replyTo ? <div className={styles.replyLabel}>Replying to {dashboardPeople[replyTo.author].name}<button type="button" className="fouc-action" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X size={12} /></button></div> : null}
            <div className={styles.commentEditor}>
              <div className={styles.editorMirror} ref={editorMirror} aria-hidden><MentionText text={commentText} /></div>
              <textarea ref={commentInput} value={commentText} rows={Math.min(4, Math.max(1, commentText.split('\n').length))} placeholder="Add a comment" aria-label="Add a comment" aria-controls={mentionChoices.length ? `${titleId}-mentions` : undefined} onScroll={event => { if (editorMirror.current) editorMirror.current.scrollTop = event.currentTarget.scrollTop; }} onChange={event => { setCommentText(event.currentTarget.value); setCaret(event.currentTarget.selectionStart); setMentionDismissed(false); setMentionIndex(0); }} onSelect={event => setCaret(event.currentTarget.selectionStart)} onKeyDown={event => { if (!mentionChoices.length) return; if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setMentionIndex(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + mentionChoices.length) % mentionChoices.length); } else if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); insertMention(mentionChoices[mentionIndex % mentionChoices.length].id); } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setMentionDismissed(true); } }} />
              <div className={styles.composerTools}><button type="button" className="fouc-action" aria-label="Mention a collaborator" onClick={() => { const next = `${commentText}${commentText && !commentText.endsWith(' ') ? ' ' : ''}@`; setCommentText(next); setCaret(next.length); setMentionDismissed(false); setMentionIndex(0); commentInput.current?.focus(); }}><At size={13} /></button></div>
            </div>
            {mentionChoices.length ? <div id={`${titleId}-mentions`} className={`${styles.mentionMenu} menu-surface`} role="listbox" aria-label="Mention people">{mentionChoices.map((person, index) => <button key={person.id} type="button" role="option" aria-selected={index === mentionIndex % mentionChoices.length} data-highlighted={index === mentionIndex % mentionChoices.length || undefined} className="fouc-menu-item" onMouseDown={event => event.preventDefault()} onClick={() => insertMention(person.id)}><Avatar id={person.id} size={22} /><span>{person.name}<small>@{person.handle}</small></span></button>)}</div> : null}
          </div>
        </div>
      </> : tab === 'Description' ? <div className={styles.detailContent}><label htmlFor={`${titleId}-description`} className={styles.sectionLabel}>Description</label><textarea id={`${titleId}-description`} className={styles.descriptionInput} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.currentTarget.value }))} placeholder="Add a task description" /></div> : <div className={styles.detailContent}><label className={styles.settingField}>Task title<input value={draft.detailTitle} onChange={event => setDraft(current => ({ ...current, detailTitle: event.currentTarget.value }))} /></label><label className={styles.settingField}>Progress <span>{draft.progress}%</span><input type="range" min="0" max="100" value={draft.progress} onChange={event => { const progress = Number(event.currentTarget.value); setDraft(current => ({ ...current, progress, status: progress === 100 ? 'Completed' : current.status === 'Completed' ? 'On Progress' : current.status })); }} /></label></div>}
      <footer className={styles.footer}>
        <div className={styles.collaborators}><span>Collaborators</span><AvatarGroup ids={draft.collaborators} size={26} /><PeopleMenu label="Edit collaborators" selected={draft.collaborators} onToggle={id => togglePerson('collaborators', id)} /></div>
        <Button type="button" variant="outline" className={styles.cancelButton} onClick={onClose}>Cancel</Button><Button type="button" className={styles.saveButton} onClick={save}>Save</Button>
      </footer>
    </div>
  </dialog>;
}
