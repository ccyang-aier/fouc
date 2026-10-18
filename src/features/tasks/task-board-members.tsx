'use client';

import { useId, useRef, useState } from 'react';
import { CaretDown, Check, LockSimple, MagnifyingGlass, Plus, UserPlus, UsersThree } from '@phosphor-icons/react';
import type { ProjectTaskMember, TaskBoardDetail, TaskBoardMemberRole } from '@fouc/shared/tasks';
import { AppAlert } from '@/components/app-alert';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/i18n';
import { TaskBoardError, type TaskBoardClient } from './task-board-client';
import { TaskDialog } from './task-board-dialogs';
import { messages } from './task-board-members.messages';
import styles from './task-board-members.module.css';

const scopeIcons = { private: LockSimple, project: UsersThree, invited: UserPlus };
const scopeDescriptions = { private: 'privateDescription', project: 'projectDescription', invited: 'invitedDescription' } as const;

export function TaskBoardMembers({ board, projectMembers, client, onChanged, onClose, onEditSettings, membersLoading = false, membersError = false, onRetry }: {
  board: TaskBoardDetail; projectMembers: ProjectTaskMember[]; client: TaskBoardClient;
  onChanged: (board: TaskBoardDetail) => void; onClose: () => void; onEditSettings: () => void;
  membersLoading?: boolean; membersError?: boolean; onRetry?: () => void;
}) {
  const { t } = useTranslation(messages);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [role, setRole] = useState<TaskBoardMemberRole>('viewer');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<'failed' | 'accessChanged' | null>(null);
  const mutating = useRef(false);
  const searchId = useId();
  const isOwner = board.permission === 'owner';
  const members = board.visibility === 'private' ? board.members.filter(member => member.role === 'owner') : board.members;
  const available = projectMembers.filter(candidate => !members.some(member => member.userId === candidate.userId));
  const search = query.trim().toLocaleLowerCase();
  const candidates = available.filter(member => `${member.name} ${member.email}`.toLocaleLowerCase().includes(search));
  const selected = available.find(member => member.userId === selectedId);
  const ScopeIcon = scopeIcons[board.visibility];

  async function change(key: string, action: () => Promise<TaskBoardDetail>, adding = false) {
    if (mutating.current) return;
    mutating.current = true;
    setPending(key);
    setError(null);
    try {
      onChanged(await action());
      if (adding) { setSelectedId(''); setQuery(''); setRole('viewer'); }
    } catch (cause) {
      setError(cause instanceof TaskBoardError && [401, 403, 404].includes(cause.status) ? 'accessChanged' : 'failed');
    } finally {
      mutating.current = false;
      setPending(null);
    }
  }

  function setAccess(userId: string, next: string) {
    if (next !== 'viewer' && next !== 'editor') return;
    const member = members.find(person => person.userId === userId);
    if (!member || member.role === next) return;
    void change(userId, () => board.visibility === 'project' && next === 'viewer'
      ? client.removeMember(board.id, userId)
      : client.setMember(board.id, userId, next));
  }

  return <TaskDialog title={t('title')} description={board.name} onClose={onClose} busy={Boolean(pending)} wide>
    <div className={styles.body}>
      <div className={styles.scope}>
        <ScopeIcon size={21} weight="duotone" aria-hidden />
        <div><strong>{t(board.visibility)}</strong><p>{t(scopeDescriptions[board.visibility])}</p></div>
      </div>
      {board.visibility === 'private' && isOwner ? <Button type="button" variant="outline" className={styles.visibilityButton} onClick={onEditSettings}>{t('settings')}</Button> : null}

      <section className={styles.members} aria-label={t('members')}>
        <div className={styles.sectionTitle}><h3>{t('members')}</h3><span>{t('count', { count: members.length })}</span></div>
        <div className={styles.memberList}>
          {members.map(member => <div className={styles.memberRow} key={member.userId}>
            <UserAvatar name={member.name} image={member.image} className={styles.avatar} />
            <div className={styles.person}><strong>{member.name || member.email}</strong><small>{member.email}</small></div>
            {isOwner && member.role !== 'owner' ? <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className={styles.roleButton} aria-label={t('memberRole', { name: member.name || member.email, role: t(member.role) })} loading={pending === member.userId} disabled={Boolean(pending)}>
                  {t(member.role)}<CaretDown size={12} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" density="compact">
                <DropdownMenuRadioGroup value={member.role} onValueChange={next => setAccess(member.userId, next)}>
                  <DropdownMenuRadioItem value="viewer">{t('viewer')}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="editor">{t('editor')}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                {board.visibility === 'invited' ? <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => void change(member.userId, () => client.removeMember(board.id, member.userId))}>{t('remove')}</DropdownMenuItem>
                </> : null}
              </DropdownMenuContent>
            </DropdownMenu> : <span className={styles.roleBadge}>{t(member.role)}</span>}
          </div>)}
        </div>
      </section>

      {isOwner && board.visibility === 'invited' ? <section className={styles.addMember} aria-label={t('add')}>
        <div className={styles.sectionTitle}><h3>{t('add')}</h3></div>
        {membersLoading ? <p className={styles.empty} role="status">{t('loading')}</p> : membersError ? <AppAlert tone="error" title={t('discoveryFailed')} action={onRetry ? <Button type="button" variant="outline" size="sm" onClick={onRetry}>{t('retry')}</Button> : undefined} /> : available.length ? <>
          <label className={styles.search} htmlFor={searchId}>
            <MagnifyingGlass size={15} aria-hidden />
            <input id={searchId} data-autofocus autoFocus value={query} aria-label={t('search')} placeholder={t('search')} onChange={event => setQuery(event.target.value)} disabled={Boolean(pending)} />
          </label>
          <div className={styles.candidates}>
            {candidates.length ? candidates.map(member => <button type="button" className={`fouc-action ${styles.candidate}`} key={member.userId} aria-pressed={selectedId === member.userId} onClick={() => setSelectedId(current => current === member.userId ? '' : member.userId)} disabled={Boolean(pending)}>
              <UserAvatar name={member.name} image={member.image} className={styles.candidateAvatar} />
              <span className={styles.person}><strong>{member.name || member.email}</strong><small>{member.email}</small></span>
              <span className={styles.selection} aria-hidden>{selectedId === member.userId ? <Check size={12} weight="bold" /> : null}</span>
            </button>) : <p className={styles.empty}>{t('noResults')}</p>}
          </div>
          <div className={styles.addActions}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" aria-label={t('selectedRole')} disabled={Boolean(pending)}>{t(role)}<CaretDown size={12} /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" density="compact">
                <DropdownMenuRadioGroup value={role} onValueChange={next => { if (next === 'viewer' || next === 'editor') setRole(next); }}>
                  <DropdownMenuRadioItem value="viewer">{t('viewer')}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="editor">{t('editor')}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" size="sm" loading={pending === 'add'} disabled={!selected || Boolean(pending)} onClick={() => {
              if (selected) void change('add', () => client.setMember(board.id, selected.userId, role), true);
            }}><Plus size={13} />{t('add')}</Button>
          </div>
        </> : <p className={styles.empty}>{t('allAdded')}</p>}
      </section> : null}
      {error ? <AppAlert tone="error" title={t(error)} /> : null}
    </div>
    <footer><Button type="button" variant="outline" onClick={onClose} disabled={Boolean(pending)}>{t('done')}</Button></footer>
  </TaskDialog>;
}
