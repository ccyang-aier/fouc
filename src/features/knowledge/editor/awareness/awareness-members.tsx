'use client';

/**
 * The online-members bar of the page header (B07): a compact avatar stack of
 * everyone the shared awareness reports — people and agents alike — fed by
 * `useAwarenessMembers`. Presence data is read from the B04 session's
 * awareness exactly as the pure module shapes it; nothing is kept in local
 * state beyond the subscribed snapshot. An empty page renders nothing.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { Sparkle } from '@phosphor-icons/react';
import type { Awareness } from 'y-protocols/awareness';
import { cn } from '@/lib/utils';
import { readAwarenessMembers } from '../../collaboration/awareness';
import type { AwarenessMember } from '../../collaboration/awareness';

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

const MAX_VISIBLE = 5;

function memberInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? [...trimmed][0]!.toUpperCase() : '?';
}

function memberTitle(member: AwarenessMember): string {
  return `${member.user.name} · ${member.isEditing ? '正在编辑' : '在线'}`;
}

function MemberAvatar({ member }: { member: AwarenessMember }) {
  const image = member.user.image;
  return (
    <span
      title={memberTitle(member)}
      className="relative inline-flex size-[22px] shrink-0 items-center justify-center overflow-visible rounded-full border-2 bg-[var(--raise)] text-[10px] font-semibold text-[var(--ink)]"
      style={{ borderColor: member.color }}
    >
      {typeof image === 'string' && image
        ? (
            <span
              aria-hidden
              className="size-full rounded-full bg-cover bg-center"
              style={{ backgroundImage: `url(${JSON.stringify(image)})` }}
            />
          )
        : memberInitial(member.user.name)}
      {member.kind === 'agent' && (
        <span
          aria-hidden
          className="absolute -bottom-[3px] -right-[3px] inline-flex size-[11px] items-center justify-center rounded-full bg-[var(--panel)] text-[var(--accent-ink)] shadow-[0_0_0_1px_var(--line)]"
        >
          <Sparkle aria-hidden className="size-[7px]" weight="fill" />
        </span>
      )}
    </span>
  );
}

/** The header's presence stack: at most five avatars, then “+N”. */
export function AwarenessMembers({ awareness }: { awareness: Awareness | null }) {
  const { members } = useAwarenessMembers(awareness);
  if (members.length === 0) return null;
  const visible = members.slice(0, MAX_VISIBLE);
  const overflow = members.length - visible.length;
  return (
    <div role="group" aria-label="在线成员" className="flex items-center">
      <div className={cn('flex items-center -space-x-1.5', overflow > 0 && 'mr-1.5')}>
        {visible.map((member) => <MemberAvatar key={member.clientId} member={member} />)}
        {overflow > 0 && (
          <span
            title={`还有 ${overflow} 位在线成员`}
            className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 border-[var(--line-strong)] bg-[var(--surface-subtle)] text-[9px] font-semibold text-[var(--muted-strong)]"
          >
            +{overflow}
          </span>
        )}
      </div>
    </div>
  );
}
