'use client';

/**
 * Inline status strip for auth panels (A04): fixed Chinese copy with one of
 * four token-driven tones. Errors are assertive announcements; success and
 * informational states are polite.
 */

import type { ReactNode } from 'react';
import { CheckCircle, Info, WarningCircle, XCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export type AuthStatusTone = 'error' | 'success' | 'info' | 'warning';

const toneStyles: Record<AuthStatusTone, { wrap: string; icon: string; iconSurface: string }> = {
  error: {
    wrap: 'border-[color-mix(in_srgb,var(--err-ink)_28%,transparent)] bg-[color-mix(in_srgb,var(--err-ink)_7%,var(--panel))]',
    icon: 'text-[var(--err-ink)]',
    iconSurface: 'bg-[color-mix(in_srgb,var(--err-ink)_10%,transparent)]',
  },
  success: {
    wrap: 'border-[color-mix(in_srgb,var(--ok-ink)_26%,transparent)] bg-[color-mix(in_srgb,var(--ok-ink)_7%,var(--panel))]',
    icon: 'text-[var(--ok-ink)]',
    iconSurface: 'bg-[color-mix(in_srgb,var(--ok-ink)_10%,transparent)]',
  },
  info: {
    wrap: 'border-[var(--accent-soft-line)] bg-[var(--accent-soft)]',
    icon: 'text-[var(--accent-ink)]',
    iconSurface: 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]',
  },
  warning: {
    wrap: 'border-[var(--warn-soft-line)] bg-[var(--warn-soft)]',
    icon: 'text-[var(--warn-ink)]',
    iconSurface: 'bg-[color-mix(in_srgb,var(--warn-ink)_12%,transparent)]',
  },
};

const toneIcons: Record<AuthStatusTone, typeof CheckCircle> = {
  error: XCircle,
  success: CheckCircle,
  info: Info,
  warning: WarningCircle,
};

export function AuthStatusMessage({
  tone,
  title,
  description,
  action,
}: {
  tone: AuthStatusTone;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const style = toneStyles[tone];
  const Icon = toneIcons[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={cn('flex items-start gap-3 rounded-[9px] border px-3.5 py-3', style.wrap)}
    >
      <span className={cn('mt-px flex size-7 shrink-0 items-center justify-center rounded-[7px]', style.iconSurface)}>
        <Icon className={cn('size-[15px]', style.icon)} weight="fill" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="text-[12px] font-semibold leading-[18px] text-[var(--ink)]">{title}</strong>
        {description ? <span className="text-[11.5px] leading-[18px] text-[var(--muted-strong)]">{description}</span> : null}
        {action ? <span className="mt-1.5 flex flex-wrap items-center gap-2">{action}</span> : null}
      </span>
    </div>
  );
}
