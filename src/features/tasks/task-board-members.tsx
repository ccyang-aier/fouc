'use client';

import { useCallback, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { CaretDown, Check, ClockCounterClockwise, Eye, MagnifyingGlass, PencilSimple, Plus, UserMinus, Users } from '@phosphor-icons/react';
import type { TaskBoardDetail, TaskBoardMemberRole } from '@fouc/shared/tasks';
import { AppAlert } from '@/components/app-alert';
import { AvatarGroup } from '@/components/avatar-group';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/i18n';
import { getOverlayRoot } from '@/lib/overlay-root';
import { usePageVisible } from '@/lib/page-visibility';
import { formatRelativeTime } from '@/lib/relative-time';
import { TaskBoardError, type TaskBoardClient } from './task-board-client';
import { messages } from './task-board-members.messages';
import styles from './task-board-members.module.css';

export function TaskBoardMembers({ board, client, onChanged, onEditSettings }: {
  board: TaskBoardDetail; client: TaskBoardClient;
  onChanged: (board: TaskBoardDetail) => void; onEditSettings: () => void;
}) {
  const { t, locale } = useTranslation(messages);
  const visible = usePageVisible();
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  const [memberQuery, setMemberQuery] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [role, setRole] = useState<TaskBoardMemberRole>('viewer');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<'failed' | 'accessChanged' | null>(null);
  const controls = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const memberSearchInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const visibilityButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const inviteFocusRequested = useRef(false);
  const nestedMenu = useRef<string | null>(null);
  const mutating = useRef(false);
  const searchId = useId();
  const memberSearchId = useId();
  const popoverId = useId();
  const isOwner = board.permission === 'owner';
  const displayed = open && visible;
  const membersQuery = useQuery({ queryKey: ['task-members'], queryFn: ({ signal }) => client.projectMembers(signal), enabled: displayed && isOwner && board.visibility === 'invited' });
  const members = board.visibility === 'private' ? board.members.filter(member => member.role === 'owner') : board.members;
  const memberSearch = memberQuery.trim().toLocaleLowerCase();
  const filteredMembers = members.filter(member => `${member.name} ${member.email}`.toLocaleLowerCase().includes(memberSearch));
  const available = (membersQuery.data ?? []).filter(candidate => !members.some(member => member.userId === candidate.userId));
  const search = query.trim().toLocaleLowerCase();
  const candidates = available.filter(member => `${member.name} ${member.email}`.toLocaleLowerCase().includes(search));
  const selected = available.find(member => member.userId === selectedId);
  const close = useCallback(() => setOpen(false), []);
  const updatedAt = new Date(board.updatedAt);
  const updatedLabel = t('lastUpdated', { time: updatedAt.toLocaleString(locale, { hour12: false }) });

  useLayoutEffect(() => {
    if (!displayed || !host || !panel.current || !controls.current) return;
    const surface = panel.current;
    const anchor = controls.current;
    let restoreFocus = true;
    function place() {
      const bounds = anchor.getBoundingClientRect();
      const root = host!.getBoundingClientRect();
      const inset = 8;
      const leftEdge = root.width ? root.left : 0;
      const rightEdge = root.width ? root.right : window.innerWidth;
      const topEdge = root.height ? root.top : 0;
      const bottomEdge = root.height ? root.bottom : window.innerHeight;
      const width = Math.min(380, rightEdge - leftEdge - inset * 2);
      const below = bottomEdge - bounds.bottom - inset * 2;
      const above = bounds.top - topEdge - inset * 2;
      const useAbove = below < Math.min(surface.scrollHeight, 180) && above > below;
      const maxHeight = Math.max(100, useAbove ? above : below);
      const next = {
        width,
        left: Math.max(leftEdge + inset, Math.min(bounds.right - width, rightEdge - width - inset)),
        top: useAbove ? Math.max(topEdge + inset, bounds.top - inset - Math.min(surface.scrollHeight, maxHeight)) : bounds.bottom + inset,
        maxHeight,
      };
      setPosition(current => current.width === next.width && current.left === next.left && current.top === next.top && current.maxHeight === next.maxHeight ? current : next);
    }
    function outside(event: PointerEvent) {
      const target = event.target as HTMLElement;
      if (surface.contains(target) || anchor.contains(target) || target.closest('[data-task-members-menu]')?.getAttribute('data-task-members-menu') === popoverId) return;
      restoreFocus = false;
      close();
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented || nestedMenu.current) return;
      event.preventDefault();
      close();
    }
    place();
    (memberSearchInput.current ?? surface).focus({ preventScroll: true });
    const observer = new ResizeObserver(place);
    observer.observe(surface);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      nestedMenu.current = null;
      const opener = returnFocus.current;
      if (restoreFocus && opener?.isConnected && (surface.contains(document.activeElement) || document.activeElement === document.body)) opener.focus({ preventScroll: true });
    };
  }, [displayed, host, close, popoverId]);

  useLayoutEffect(() => {
    if (!displayed || !inviteFocusRequested.current || (board.visibility === 'invited' && membersQuery.isPending)) return;
    const target = searchInput.current ?? visibilityButton.current ?? panel.current;
    target?.focus({ preventScroll: true });
    if (target === searchInput.current) target?.scrollIntoView({ block: 'nearest' });
    inviteFocusRequested.current = false;
  }, [displayed, board.visibility, membersQuery.isPending, available.length]);

  function openPanel(button: HTMLButtonElement, invite: boolean) {
    returnFocus.current = button;
    inviteFocusRequested.current = invite;
    setHost(getOverlayRoot() ?? document.body);
    if (invite && displayed) {
      const waitingForDirectory = board.visibility === 'invited' && membersQuery.isPending;
      const target = searchInput.current ?? visibilityButton.current ?? (waitingForDirectory ? null : panel.current);
      target?.focus({ preventScroll: true });
      if (target) inviteFocusRequested.current = false;
      if (target === searchInput.current) target?.scrollIntoView({ block: 'nearest' });
    }
    setOpen(invite || !open);
  }

  function menuChanged(key: string, value: boolean) {
    if (value) nestedMenu.current = key;
    else if (nestedMenu.current === key) nestedMenu.current = null;
  }

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

  return <div ref={controls} className={styles.controls}>
    <span className={styles.updated} title={updatedLabel}><ClockCounterClockwise size={14} /><time dateTime={board.updatedAt} aria-label={updatedLabel}>{formatRelativeTime(updatedAt.getTime(), locale)}</time></span>
    <button type="button" className={styles.avatarTrigger} aria-label={t('count', { count: members.length })} aria-haspopup="dialog" aria-expanded={displayed} aria-controls={displayed ? popoverId : undefined} onClick={event => openPanel(event.currentTarget, false)}>
      <AvatarGroup className={styles.avatarStack} members={members.map(({ userId, name, image }) => ({ id: userId, name, image }))} maxVisible={3} size={28} />
    </button>
    {isOwner ? <Button type="button" size="sm" className={styles.invite} aria-haspopup="dialog" aria-expanded={displayed} aria-controls={displayed ? popoverId : undefined} onClick={event => openPanel(event.currentTarget, true)}><Users size={15} weight="fill" />{t('invite')}</Button> : null}
    {displayed && host ? createPortal(<div ref={panel} id={popoverId} className={`menu-surface ${styles.popover}`} style={position} role="dialog" aria-modal="false" aria-label={t('title')} tabIndex={-1}>
      <div className={styles.body}>
      <label className={styles.search} htmlFor={memberSearchId}>
        <MagnifyingGlass size={15} aria-hidden />
        <input ref={memberSearchInput} id={memberSearchId} value={memberQuery} aria-label={t('searchMembers')} placeholder={t('searchMembers')} onChange={event => setMemberQuery(event.target.value)} />
      </label>
      {board.visibility === 'private' && isOwner ? <Button ref={visibilityButton} type="button" variant="outline" className={styles.visibilityButton} onClick={() => { close(); onEditSettings(); }}>{t('settings')}</Button> : null}

      <section className={styles.members} aria-label={t('members')}>
        <div className={styles.memberList}>
          {filteredMembers.map(member => <div className={styles.memberRow} key={member.userId}>
            <UserAvatar name={member.name} image={member.image} className={styles.avatar} />
            <div className={styles.person}><strong>{member.name || member.email}</strong><small>{member.email}</small></div>
            {isOwner && member.role !== 'owner' ? <DropdownMenu modal={false} onOpenChange={value => menuChanged(member.userId, value)}>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className={styles.roleButton} aria-label={t('memberRole', { name: member.name || member.email, role: t(member.role) })} loading={pending === member.userId} disabled={Boolean(pending)}>
                  {t(member.role)}<CaretDown size={12} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" density="compact" className={styles.permissionMenu} data-task-members-menu={popoverId}>
                <DropdownMenuRadioGroup value={member.role} onValueChange={next => setAccess(member.userId, next)}>
                  <DropdownMenuRadioItem value="viewer" className={styles.roleChoice}><Eye size={15} aria-hidden />{t('viewer')}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="editor" className={styles.roleChoice}><PencilSimple size={15} aria-hidden />{t('editor')}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                {board.visibility === 'invited' ? <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => void change(member.userId, () => client.removeMember(board.id, member.userId))}><UserMinus size={15} aria-hidden />{t('remove')}</DropdownMenuItem>
                </> : null}
              </DropdownMenuContent>
            </DropdownMenu> : <span className={styles.roleBadge}>{t(member.role)}</span>}
          </div>)}
          {!filteredMembers.length ? <p className={styles.empty}>{t('noMatchingMembers')}</p> : null}
        </div>
      </section>

      {isOwner && board.visibility === 'invited' ? <section className={styles.addMember} aria-label={t('add')}>
        {membersQuery.isPending ? <p className={styles.empty} role="status">{t('loading')}</p> : membersQuery.isError ? <AppAlert tone="error" title={t('discoveryFailed')} action={<Button type="button" variant="outline" size="sm" onClick={() => { void membersQuery.refetch(); }}>{t('retry')}</Button>} /> : available.length ? <>
          <label className={styles.search} htmlFor={searchId}>
            <MagnifyingGlass size={15} aria-hidden />
            <input ref={searchInput} id={searchId} value={query} aria-label={t('search')} placeholder={t('search')} onChange={event => setQuery(event.target.value)} disabled={Boolean(pending)} />
          </label>
          <div className={styles.candidates}>
            {candidates.length ? candidates.map(member => <button type="button" className={`fouc-action ${styles.candidate}`} key={member.userId} aria-pressed={selectedId === member.userId} onClick={() => setSelectedId(current => current === member.userId ? '' : member.userId)} disabled={Boolean(pending)}>
              <UserAvatar name={member.name} image={member.image} className={styles.candidateAvatar} />
              <span className={styles.person}><strong>{member.name || member.email}</strong><small>{member.email}</small></span>
              <span className={styles.selection} aria-hidden>{selectedId === member.userId ? <Check size={12} weight="bold" /> : null}</span>
            </button>) : <p className={styles.empty}>{t('noResults')}</p>}
          </div>
          <div className={styles.addActions}>
            <DropdownMenu modal={false} onOpenChange={value => menuChanged('new-member', value)}>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" aria-label={t('selectedRole')} disabled={Boolean(pending)}>{t(role)}<CaretDown size={12} /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" density="compact" className={styles.permissionMenu} data-task-members-menu={popoverId}>
                <DropdownMenuRadioGroup value={role} onValueChange={next => { if (next === 'viewer' || next === 'editor') setRole(next); }}>
                  <DropdownMenuRadioItem value="viewer" className={styles.roleChoice}><Eye size={15} aria-hidden />{t('viewer')}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="editor" className={styles.roleChoice}><PencilSimple size={15} aria-hidden />{t('editor')}</DropdownMenuRadioItem>
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
    </div>, host) : null}
  </div>;
}
