'use client';

/**
 * The online-members bar of the page header (B07): a compact avatar stack of
 * unique accounts and agent tasks, plus the current user. The dropdown
 * exposes names and live editing status without crowding the document.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { Sparkle } from '@phosphor-icons/react';
import type { Awareness } from 'y-protocols/awareness';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { awarenessColorFor, readAwarenessMembers } from '../../collaboration/awareness';
import type { AwarenessIdentity, AwarenessMember } from '../../collaboration/awareness';
import styles from './awareness-members.module.css';

interface AwarenessMembersSnapshot {
  members: AwarenessMember[];
  ownClientId: number;
}

const emptySnapshot: AwarenessMembersSnapshot = { members: [], ownClientId: 0 };

/**
 * Cached snapshots per awareness instance: `useSyncExternalStore` requires a
 * stable value until the store reports a change, and the awareness is that
 * store (the 'change' event covers additions, updates and removals).
 */
const snapshotCache = new WeakMap<Awareness, AwarenessMembersSnapshot>();

function awarenessSnapshot(awareness: Awareness): AwarenessMembersSnapshot {
  const cached = snapshotCache.get(awareness);
  if (cached) return cached;
  const snapshot: AwarenessMembersSnapshot = { members: readAwarenessMembers(awareness, awareness.clientID), ownClientId: awareness.clientID };
  snapshotCache.set(awareness, snapshot);
  return snapshot;
}

/** Live members of one page session's awareness; empty while there is none. */
export function useAwarenessMembers(awareness: Awareness | null): AwarenessMembersSnapshot {
  const subscribe = useCallback((notify: () => void) => {
    if (!awareness) return () => {};
    snapshotCache.delete(awareness);
    const onChange = () => {
      snapshotCache.delete(awareness);
      notify();
    };
    awareness.on('change', onChange);
    return () => {
      awareness.off('change', onChange);
    };
  }, [awareness]);
  const getSnapshot = useCallback(() => (awareness ? awarenessSnapshot(awareness) : emptySnapshot), [awareness]);
  return useSyncExternalStore(subscribe, getSnapshot, () => emptySnapshot);
}

const MAX_VISIBLE = 3;

function memberInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? [...trimmed][0]!.toUpperCase() : '?';
}

function memberTitle(member: AwarenessMember): string {
  return `${member.user.name} · ${member.isEditing ? '正在编辑' : '在线'}`;
}

function memberKey(member: AwarenessMember): string {
  return JSON.stringify([member.kind, member.user.id, member.kind === 'agent' ? member.taskId ?? member.clientId : null]);
}

function MemberAvatar({ member, large = false }: { member: AwarenessMember; large?: boolean }) {
  const image = member.user.image;
  return (
    <span
      title={memberTitle(member)}
      className={cn(styles.avatar, large && styles.largeAvatar)}
    >
      {memberInitial(member.user.name)}
      {typeof image === 'string' && image
        ? (
            <span
              aria-hidden
              className={styles.image}
              style={{ backgroundImage: `url(${JSON.stringify(image)})` }}
            />
          )
        : null}
      {member.kind === 'agent' && (
        <span
          aria-hidden
          className={styles.agentBadge}
        >
          <Sparkle aria-hidden size={9} weight="fill" />
        </span>
      )}
    </span>
  );
}

/** One unified header stack, with a keyboard-accessible live member list. */
export function AwarenessMembers({ awareness, identity }: { awareness: Awareness | null; identity: AwarenessIdentity }) {
  const { members } = useAwarenessMembers(awareness);
  const own: AwarenessMember = {
    clientId: awareness?.clientID ?? 0,
    user: { id: identity.userId, name: identity.name, image: identity.image },
    color: awarenessColorFor(identity.userId),
    kind: 'human',
    isEditing: false,
  };
  const participants = [own, ...members.filter((member) => member.kind !== 'human' || member.user.id !== identity.userId)];
  const visible = participants.slice(0, MAX_VISIBLE);
  const overflow = participants.length - visible.length;
  const label = awareness ? `${participants.length} 位在线成员` : '当前文档成员';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={label} title="查看文档成员" className={styles.trigger}>
          <span aria-hidden className={styles.stack}>
            {visible.map((member) => <MemberAvatar key={memberKey(member)} member={member} />)}
            {overflow > 0 ? <span className={styles.overflow} title={`还有 ${overflow} 位在线成员`}>{overflow > 99 ? '99+' : `+${overflow}`}</span> : null}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={9} className={styles.menu} aria-label="文档成员">
        <div className={styles.menuHeading}>
          <span>文档成员</span>
          <span className={styles.total}>{participants.length}</span>
        </div>
        <div className={styles.members}>
          {participants.map((member, index) => (
            <DropdownMenuItem key={memberKey(member)} className={styles.memberRow} onSelect={(event) => event.preventDefault()}>
              <MemberAvatar member={member} large />
              <span className={styles.memberInfo}>
                <span className={styles.memberName}><span className={styles.name}>{member.user.name}</span>{index === 0 ? <span className={styles.you}>你</span> : null}{member.kind === 'agent' ? <span className={styles.agentLabel}>AI</span> : null}</span>
                <span className={cn(styles.memberStatus, member.isEditing && styles.editing)}>
                  <span aria-hidden className={styles.statusDot} />
                  {index === 0 ? '当前文档' : member.isEditing ? '正在编辑' : '在线浏览'}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
