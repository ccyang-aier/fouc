'use client';

/**
 * Shared presentation primitives of the organization UI (O02): the four-state
 * list shell (loading / unauthenticated / forbidden / error, plus empty and
 * ready), the modal + confirm dialogs, the toast region and the small badges.
 * Everything composes the workbench design tokens (globals.css) the way the
 * existing knowledge and connector surfaces do.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Warning, WarningCircle, XCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { MemberRole, TeamspaceAccess } from './client';
import { isOrganizationDataError, organizationErrorTextOf } from './errors';
import { defaultAccessLabel, deriveListState, memberRoleLabels } from './view-model';
import type { OrganizationListState } from './view-model';

/** Maps an infinite query result onto the pure list state machine. */
export function queryListState(query: { status: 'pending' | 'error' | 'success'; error: unknown; data?: { pages: { items: unknown[] }[] } | null }): OrganizationListState {
  return deriveListState({
    status: query.status,
    errorCode: query.error === null ? null : isOrganizationDataError(query.error) ? query.error.code : 'NETWORK',
    itemCount: query.data ? query.data.pages.reduce((total, page) => total + page.items.length, 0) : null,
  });
}

export function flattenPages<T>(data: { pages: { items: T[] }[] } | undefined | null): T[] {
  return data ? data.pages.flatMap((page) => page.items) : [];
}

function CenteredState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
      {icon ? <div className="text-[var(--muted)]">{icon}</div> : null}
      <p className="mt-3 text-[12.5px] font-medium text-[var(--ink-soft)]">{title}</p>
      {hint ? <p className="mt-1.5 max-w-[420px] text-[11px] leading-relaxed text-[var(--muted)]">{hint}</p> : null}
      {action ? <div className="mt-3.5">{action}</div> : null}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="px-2 py-3" aria-hidden>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-3 border-b border-[var(--line)] px-2 py-3 last:border-b-0">
          <span className="size-7 animate-pulse rounded-full bg-[var(--raise)]" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-2.5 w-[132px] animate-pulse rounded bg-[var(--raise)]" />
            <span className="block h-2 w-[210px] animate-pulse rounded bg-[var(--raise)]" />
          </span>
          <span className="h-5 w-16 animate-pulse rounded bg-[var(--raise)]" />
        </div>
      ))}
    </div>
  );
}

export function SectionHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{title}</h3>
        {hint ? <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0 pb-0.5">{action}</div> : null}
    </div>
  );
}

export function ListStateShell(props: {
  state: OrganizationListState;
  error?: unknown;
  onRetry?: () => void;
  emptyIcon?: ReactNode;
  emptyTitle: string;
  emptyHint?: string;
  emptyAction?: ReactNode;
  children: ReactNode;
}) {
  switch (props.state) {
    case 'loading':
      return <SkeletonRows />;
    case 'unauthenticated':
      return <CenteredState icon={<WarningCircle className="size-6" aria-hidden />} title="需要登录" hint="组织信息需要已验证的登录会话；请在登录知识服务后重试。" />;
    case 'forbidden':
      return <CenteredState icon={<Warning className="size-6" aria-hidden />} title="没有查看权限" hint="访客角色无法浏览工作区的成员、群组与团队空间目录。" />;
    case 'error':
      return (
        <CenteredState
          icon={<XCircle className="size-6" aria-hidden />}
          title="加载失败"
          hint={organizationErrorTextOf(props.error)}
          action={props.onRetry ? (
            <button type="button" onClick={props.onRetry} className="rounded-[6px] border border-[var(--line)] bg-panel px-3 py-1.5 text-[11px] font-medium text-[var(--ink-soft)] outline-none transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
              重试
            </button>
          ) : undefined}
        />
      );
    case 'empty':
      return <CenteredState icon={props.emptyIcon} title={props.emptyTitle} hint={props.emptyHint} action={props.emptyAction} />;
    default:
      return <>{props.children}</>;
  }
}

/** Modal dialog: Escape closes, backdrop click closes, the first field is focused. */
export function ModalDialog({ open, onClose, title, description, children, footer, width = 'w-[440px]' }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop absolute inset-0 z-50 flex items-start justify-center overflow-auto pt-[12vh]" role="presentation" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        className={cn('modal-surface flex flex-col gap-4 rounded-[10px] px-5 py-4 outline-none', width)}
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{title}</h2>
          {description ? <p className="text-[11.5px] leading-relaxed text-[var(--muted-strong)]">{description}</p> : null}
        </div>
        {children}
        <div className="flex justify-end gap-2 pt-0.5">{footer}</div>
      </div>
    </div>
  );
}

export function DialogButton({ variant = 'outline', ...props }: { variant?: 'primary' | 'outline' | 'danger' } & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] px-3 text-[11.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-45',
        variant === 'primary' && 'bg-[var(--accent)] text-white shadow-[0_4px_12px_color-mix(in_srgb,var(--accent)_22%,transparent)] hover:bg-[var(--accent-strong)]',
        variant === 'outline' && 'border border-[var(--line)] bg-panel text-[var(--ink-soft)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)]',
        variant === 'danger' && 'bg-[var(--err-ink)] text-white hover:opacity-90',
        props.className,
      )}
    />
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel, busy }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  busy?: boolean;
}) {
  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={title}
      width="w-[400px]"
      footer={
        <>
          <DialogButton onClick={onClose}>取消</DialogButton>
          <DialogButton variant="danger" disabled={busy} onClick={onConfirm} autoFocus>{confirmLabel}</DialogButton>
        </>
      }
    >
      <div className="text-[11.5px] leading-relaxed text-[var(--ink-soft)]">{body}</div>
    </ModalDialog>
  );
}

export type ToastMessage = { kind: 'success' | 'error'; text: string } | null;

export function useOrganizationToast() {
  const [toast, setToast] = useState<ToastMessage>(null);
  const timerRef = useRef<number | null>(null);
  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); }, []);
  function notify(kind: 'success' | 'error', text: string, duration = kind === 'error' ? 4200 : 2600) {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setToast({ kind, text });
    timerRef.current = window.setTimeout(() => setToast(null), duration);
  }
  return { toast, notify };
}

export function ToastRegion({ toast }: { toast: ToastMessage }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none absolute bottom-5 left-1/2 z-[60] flex max-w-[76%] -translate-x-1/2 translate-y-2 items-center gap-2 rounded-[7px] border px-3.5 py-2 text-[11px] font-medium text-white opacity-0 shadow-[0_8px_24px_rgba(28,33,42,0.2)] transition-[opacity,transform]',
        toast && 'translate-y-0 opacity-100',
        toast?.kind === 'error' ? 'border-white/10 bg-[var(--err-ink)]' : 'border-white/10 bg-[var(--ink)]',
      )}
    >
      {toast?.kind === 'error' ? <XCircle className="size-3.5 shrink-0" weight="fill" /> : null}
      <span className="min-w-0 truncate">{toast?.text}</span>
    </div>
  );
}

/** Reports a failed mutation as a Chinese error line plus the rollback note. */
export function mutationErrorText(actionLabel: string, error: unknown): string {
  return `${actionLabel}失败，已恢复原状：${organizationErrorTextOf(error)}`;
}

export function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center rounded-full border px-2 text-[10px] font-medium',
        role === 'owner' && 'border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]',
        role === 'admin' && 'border-[var(--line-strong)] bg-[var(--surface-subtle)] text-[var(--ink-soft)]',
        role === 'member' && 'border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted-strong)]',
        role === 'guest' && 'border-[var(--line)] bg-transparent text-[var(--muted)]',
      )}
    >
      {memberRoleLabels[role]}
    </span>
  );
}

export function AccessBadge({ access }: { access: TeamspaceAccess }) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1 rounded-full border px-2 text-[10px] font-medium',
        access === null ? 'border-[var(--line)] bg-transparent text-[var(--muted)]' : 'border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]',
      )}
    >
      {defaultAccessLabel(access)}
    </span>
  );
}

export function KindBadge({ kind }: { kind: 'personal' | 'team' }) {
  return (
    <span className={cn('inline-flex h-[20px] items-center rounded-full border px-1.5 text-[9.5px] font-medium', kind === 'team' ? 'border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]' : 'border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted-strong)]')}>
      {kind === 'team' ? '团队' : '个人'}
    </span>
  );
}

/** Text field with the shared name validation mirrored client-side. */
export function NameField({ label, value, onChange, onSubmit, placeholder, autoFocus, invalidReason, maxLength = 120 }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  invalidReason?: string;
  maxLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-[var(--muted-strong)]">{label}</span>
      <input
        value={value}
        autoFocus={autoFocus}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={invalidReason ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' && onSubmit) { event.preventDefault(); onSubmit(); } }}
        className={cn(
          'h-8 rounded-[6px] border bg-panel px-2.5 text-[12px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--muted)]',
          invalidReason ? 'border-[var(--err-ink)]' : 'border-[var(--line)] focus:border-[var(--accent)]',
        )}
      />
      {invalidReason ? <span className="text-[10.5px] text-[var(--err-ink)]">{invalidReason}</span> : null}
    </label>
  );
}

export function LoadMoreButton({ visible, loading, onClick }: { visible: boolean; loading: boolean; onClick: () => void }) {
  if (!visible) return null;
  return (
    <div className="flex justify-center py-3">
      <button
        type="button"
        disabled={loading}
        onClick={onClick}
        className="rounded-[6px] border border-[var(--line)] bg-panel px-3 py-1.5 text-[11px] font-medium text-[var(--muted-strong)] outline-none transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-45"
      >
        {loading ? '正在加载…' : '加载更多'}
      </button>
    </div>
  );
}
