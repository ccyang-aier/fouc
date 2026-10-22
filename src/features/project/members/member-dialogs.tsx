'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CaretDown, Copy, X } from '@phosphor-icons/react';
import { canManageProjectMember, type ProjectMember, type ProjectMemberRole, type ProjectMembers } from '@fouc/shared/projects';
import { AppAlert } from '@/components/app-alert';
import { useAppAlert } from '@/components/app-alert-provider';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/user-avatar';
import { usePageVisible } from '@/lib/page-visibility';
import { useTranslation } from '@/lib/i18n';
import { MemberRoleBadge } from './member-collection';
import { messages } from './members.messages';
import styles from './members.module.css';

export type MemberAction = { kind: 'add'; email: string; role: ProjectMemberRole } | { kind: 'role'; userId: string; role: ProjectMemberRole } | { kind: 'remove'; userId: string };

function MemberModal({ title, onClose, busy, children, alert = false }: {
  title: string; onClose: () => void; busy: boolean; children: ReactNode; alert?: boolean;
}) {
  const { t } = useTranslation(messages);
  const ref = useRef<HTMLDialogElement>(null);
  const visible = usePageVisible();
  const id = useId();
  useEffect(() => {
    const node = ref.current;
    if (!node || !visible) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node.showModal(); node.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    return () => { node.close(); if (opener?.isConnected && document.activeElement === document.body) opener.focus({ preventScroll: true }); };
  }, [visible]);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={id} aria-busy={busy} role={alert ? 'alertdialog' : undefined}
    onKeyDown={event => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.currentTarget.querySelector('[role="menu"][data-state="open"]')) return;
      event.preventDefault(); event.stopPropagation(); if (!busy) onClose();
    }}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => {
      if (busy || event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <header className={styles.dialogHeader}><h2 id={id}>{title}</h2><Button type="button" variant="ghost" size="icon-sm" aria-label={t('close')} disabled={busy} onClick={onClose}><X size={16} /></Button></header>
    {children}
  </dialog>;
}

function RolePicker({ role, actorRole, onChange, disabled }: { role: ProjectMemberRole; actorRole: ProjectMembers['actorRole']; onChange: (role: ProjectMemberRole) => void; disabled: boolean }) {
  const { t } = useTranslation(messages);
  return <DropdownMenu><DropdownMenuTrigger type="button" className={styles.roleTrigger} disabled={disabled} aria-label={t('role')}><MemberRoleBadge role={role} /><CaretDown size={12} /></DropdownMenuTrigger>
    <DropdownMenuContent density="compact" align="start"><DropdownMenuRadioGroup value={role} onValueChange={value => onChange(value as ProjectMemberRole)}>
      {(['member', 'admin', 'guest'] as const).filter(value => canManageProjectMember(actorRole, value)).map(value => <DropdownMenuRadioItem value={value} key={value} indicator="none">{t(value)}</DropdownMenuRadioItem>)}
    </DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>;
}

export function MemberDialog({ member, actorRole, busy, error, onClose, onSubmit }: {
  member?: ProjectMember; actorRole: ProjectMembers['actorRole']; busy: boolean; error: string | null;
  onClose: () => void; onSubmit: (action: MemberAction) => Promise<boolean>;
}) {
  const { t, locale } = useTranslation(messages);
  const { notify } = useAppAlert();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectMemberRole>(member?.role === 'owner' ? 'member' : member?.role ?? 'member');
  const [removing, setRemoving] = useState(false);
  const manageable = !member || canManageProjectMember(actorRole, member.role);
  async function submit() { if (await onSubmit(member ? { kind: 'role', userId: member.userId, role } : { kind: 'add', email: email.trim(), role })) onClose(); }
  return <MemberModal title={t(removing ? 'removeTitle' : member ? 'details' : 'add')} onClose={onClose} busy={busy} alert={removing}>
    {removing && member ? <>
      <p className={styles.removeDescription}>{t('removeDescription', { name: member.name })}</p>
      {error && <div className={styles.dialogError}><AppAlert tone="error" title={error} /></div>}
      <footer><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setRemoving(false)} autoFocus>{t('cancel')}</Button><Button type="button" variant="ghost" size="sm" className={styles.danger} data-variant="destructive" loading={busy} onClick={async () => { if (await onSubmit({ kind: 'remove', userId: member.userId })) onClose(); }}>{t('remove')}</Button></footer>
    </> : <form onSubmit={event => { event.preventDefault(); if (!busy) void submit(); }}>
      <div className={styles.dialogBody}>
        {member ? <>
          <div className={styles.profile}><UserAvatar name={member.name} image={member.image} /><div><h3>{member.name}</h3><span>{member.email}</span></div></div>
          <dl className={styles.profileFields}><div><dt>{t('email')}</dt><dd><span>{member.email}</span><Button type="button" variant="ghost" size="icon-sm" className={styles.copyButton} aria-label={t('copyEmail')} onClick={async () => { try { await navigator.clipboard.writeText(member.email); notify('success', t('copied')); } catch { notify('error', t('failed')); } }}><Copy size={14} /></Button></dd></div>
            <div><dt>{t('joined')}</dt><dd><time dateTime={member.joinedAt}>{new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(member.joinedAt))}</time></dd></div>
            <div><dt>{t('role')}</dt><dd>{manageable ? <RolePicker role={role} actorRole={actorRole} onChange={setRole} disabled={busy} /> : <MemberRoleBadge role={member.role} />}</dd></div>
          </dl>
        </> : <>
          <label className={styles.field}>{t('email')}<input data-autofocus type="email" value={email} required maxLength={254} placeholder={t('emailPlaceholder')} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>
          <p className={styles.emailHint}>{t('emailHint')}</p>
          <div className={styles.field}><span>{t('role')}</span><RolePicker role={role} actorRole={actorRole} onChange={setRole} disabled={busy} /></div>
        </>}
        {error && <AppAlert tone="error" title={error} />}
      </div>
      <footer>{member && manageable && <Button type="button" variant="ghost" size="sm" data-variant="destructive" className={styles.remove} disabled={busy} onClick={() => setRemoving(true)}>{t('remove')}</Button>}
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>{t(member ? 'done' : 'cancel')}</Button>
        {manageable && (!member || member.role !== role) && <Button type="submit" size="sm" loading={busy} disabled={!member && !email.trim()}>{t(member ? 'save' : 'add')}</Button>}
      </footer>
    </form>}
  </MemberModal>;
}
