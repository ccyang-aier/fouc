'use client';

/**
 * The B04 sync indicator of the page editor (E03): one pill that names where
 * the document stands — loading, local-only, syncing, synced, offline or
 * rejected — derived entirely from `syncIndicatorView`, never from invented
 * state. Label changes announce politely; the hint rides along as tooltip.
 */

import { SpinnerGap } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { SyncIndicatorView, SyncTone } from '../editor-state';

const toneClasses: Record<SyncTone, string> = {
  quiet: 'border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted-strong)]',
  progress: 'border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]',
  ok: 'border-[color-mix(in_srgb,var(--ok-ink)_24%,transparent)] bg-[color-mix(in_srgb,var(--ok-ink)_8%,transparent)] text-[var(--ok-ink)]',
  warn: 'border-[var(--warn-soft-line)] bg-[var(--warn-soft)] text-[var(--warn-ink)]',
  error: 'border-[color-mix(in_srgb,var(--err-ink)_24%,transparent)] bg-[color-mix(in_srgb,var(--err-ink)_8%,transparent)] text-[var(--err-ink)]',
};

const dotClasses: Record<SyncTone, string> = {
  quiet: 'bg-[var(--muted)]',
  progress: 'bg-[var(--accent)]',
  ok: 'bg-[var(--ok-ink)]',
  warn: 'bg-[var(--warn-ink)]',
  error: 'bg-[var(--err-ink)]',
};

export function SyncIndicator({ view }: { view: SyncIndicatorView }) {
  return (
    <span
      role="status"
      title={view.hint}
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
        toneClasses[view.tone],
      )}
    >
      {view.busy ? (
        <SpinnerGap aria-hidden className="size-3 animate-spin" />
      ) : (
        <span
          aria-hidden
          className={cn('size-1.5 rounded-full transition-colors', dotClasses[view.tone], view.tone === 'progress' && 'animate-pulse')}
        />
      )}
      {view.label}
    </span>
  );
}
