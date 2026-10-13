'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, LinkSimple, X } from '@phosphor-icons/react';
import { useAppAlert } from '@/components/app-alert-provider';
import { Avatar, DashboardButton, IconButton } from './dashboard-ui';
import { dashboardPeople, type DashboardPersonId, type DashboardPriority, type DashboardTask } from './dashboard-model';
import styles from './dashboard-actions.module.css';

export type DashboardAction = 'Create Task' | 'New Project' | 'Send a invoice' | 'Draft a Proposal' | 'Create a contract' | 'Add a form' | 'Invite' | 'Help Center' | 'Notifications' | 'Dev Sync Meeting' | 'ABC Project Meeting' | 'New Meeting';

function useModal(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); previousFocus?.focus(); };
  }, []);
  return { ref, onCancel: (event: React.SyntheticEvent) => { event.preventDefault(); onClose(); }, onClick: (event: React.MouseEvent<HTMLDialogElement>) => { if (event.target !== event.currentTarget) return; const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } };
}

export function DashboardActionDialog({ action, onClose, onCreate, invited, onInvite }: { action: DashboardAction; onClose: () => void; onCreate: (task: DashboardTask) => void; invited: DashboardPersonId[]; onInvite: (ids: DashboardPersonId[]) => void }) {
  const modal = useModal(onClose);
  const titleId = useId();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<DashboardPriority>('Medium');
  const [memberIds, setMemberIds] = useState<DashboardPersonId[]>(invited);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const { notify } = useAppAlert();
  const isDocument = ['Send a invoice', 'Draft a Proposal', 'Create a contract', 'Add a form'].includes(action);
  const isCreate = isDocument || action === 'Create Task' || action === 'New Project' || action === 'New Meeting';

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); }
    catch { notify('error', 'Could not copy the link'); }
  }
  function create() {
    if (!name.trim()) { setError('Enter a name to continue.'); return; }
    const id = crypto.randomUUID();
    onCreate({ id, title: name.trim(), detailTitle: name.trim(), description: description.trim(), priority, status: 'To Do', tag: isDocument ? 'Document' : action === 'New Meeting' ? 'Meeting' : 'Mobile App', dueDate: '2027-02-02', progress: 0, assignees: ['sarah'], cardPeople: ['sarah'], collaborators: ['sarah'], comments: [], commentCount: 0, links: 0, color: 'green', starred: false });
    notify('success', isDocument ? 'Draft saved' : action === 'New Meeting' ? 'Meeting added to your projects' : `${action === 'New Project' ? 'Project' : 'Task'} created`);
    onClose();
  }

  return <dialog {...modal} aria-labelledby={titleId} className={styles.dialog}>
    <header><h2 id={titleId}>{action === 'Invite' ? 'Invite collaborators' : action}</h2><IconButton label="Close dialog" onClick={onClose}><X /></IconButton></header>
    {isCreate ? <form onSubmit={event => { event.preventDefault(); create(); }}>
      <div className={styles.fields}><label>{isDocument ? 'Document title' : action === 'New Project' ? 'Project name' : action === 'New Meeting' ? 'Meeting name' : 'Task name'}<input autoFocus value={name} onChange={event => { setName(event.target.value); setError(''); }} placeholder={isDocument ? 'Enter a document title' : 'Give it a name'} aria-invalid={Boolean(error)} /></label><label>Description<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Add a description" rows={3} /></label><label>Priority<select value={priority} onChange={event => setPriority(event.target.value as DashboardPriority)}>{['Low', 'Medium', 'High', 'Urgent'].map(value => <option key={value}>{value}</option>)}</select></label>{error ? <p role="alert" className={styles.error}>{error}</p> : null}</div>
      <footer><DashboardButton tone="neutral" onClick={onClose}>Cancel</DashboardButton><DashboardButton type="submit">{isDocument ? 'Save draft' : 'Create'}</DashboardButton></footer>
    </form> : action === 'Invite' ? <>
      <div className={styles.memberList}>{Object.values(dashboardPeople).filter(person => person.id !== 'sarah').map(person => <label key={person.id}><Avatar id={person.id} size={32} /><span><strong>{person.name}</strong><small>{person.role}</small></span><input type="checkbox" checked={memberIds.includes(person.id)} onChange={event => setMemberIds(ids => event.target.checked ? [...ids, person.id] : ids.filter(id => id !== person.id))} /></label>)}</div>
      <footer><DashboardButton tone="neutral" onClick={() => { void copyLink(); }}>{copied ? <Check size={15} /> : <LinkSimple size={15} />}{copied ? 'Copied' : 'Copy link'}</DashboardButton><DashboardButton onClick={() => { onInvite(memberIds); notify('success', 'Collaborators updated'); onClose(); }}>Save</DashboardButton></footer>
    </> : action === 'Help Center' ? <><div className={styles.helpContent}><h3>Working with your projects</h3><p>Create a task or project, then click its name to edit the details. Use Comment to discuss the work and mention a collaborator with @.</p><p>Track your work in the activity map. Hover over a month in Milestone Tracker to see target and actual tasks.</p><p>Your changes are saved on this device for the selected Fouc project.</p></div><footer><DashboardButton onClick={onClose}>Got it</DashboardButton></footer></> : action === 'Notifications' ? <><div className={styles.helpContent}><h3>You’re all caught up</h3><p>Project updates and comments are available in Inbox.</p></div><footer><DashboardButton onClick={onClose}>Done</DashboardButton></footer></> : <><div className={styles.helpContent}><p>{action === 'Dev Sync Meeting' ? 'Monday, Feb 8, 2027 · 10:00 AM' : 'Tuesday, Feb 9, 2027 · 09:00 AM'}</p><h3>Agenda</h3><p>Review project progress, discuss the current design and agree on the next steps.</p><div className={styles.meetingMembers}>{(['jerome', 'kiara', 'brooklyn'] as const).map(id => <span key={id}><Avatar id={id} size={28} />{dashboardPeople[id].name}</span>)}</div></div><footer><DashboardButton tone="neutral" onClick={() => { void copyLink(); }}>{copied ? 'Copied' : 'Copy meeting link'}</DashboardButton><DashboardButton onClick={onClose}>Done</DashboardButton></footer></>}
  </dialog>;
}

export function DashboardDeleteDialog({ task, onClose, onDelete }: { task: DashboardTask; onClose: () => void; onDelete: () => void }) {
  const modal = useModal(onClose);
  const titleId = useId();
  return <dialog {...modal} className={styles.dialog} aria-labelledby={titleId}><header><h2 id={titleId}>Delete project?</h2><IconButton label="Close delete dialog" onClick={onClose}><X /></IconButton></header><div className={styles.helpContent}><p>“{task.title}” and its comments will be removed from this project.</p></div><footer><DashboardButton tone="neutral" onClick={onClose}>Cancel</DashboardButton><DashboardButton className={styles.danger} onClick={onDelete}>Delete project</DashboardButton></footer></dialog>;
}
