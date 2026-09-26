'use client';

/**
 * The readonly banner of the page editor (E03): one honest sentence about
 * *why* the body refuses edits — the P03 effective level sits below edit, or
 * the collaboration connection was rejected. Copy comes from the pure state
 * module so the reason can never disagree with the editable decision.
 */

import { LockSimple, Warning } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { permissionLevelLabel } from '../editor-state';
import type { ReadonlyReason } from '../editor-state';
import type { PermissionLevel } from '@fouc/shared/knowledge/contracts';

export function readonlyBannerCopy(reason: ReadonlyReason, level: PermissionLevel): string {
  if (reason === 'auth-failed') {
    return '同步连接被知识服务拒绝，正文以本地副本展示并暂不可编辑；重新进入页面或恢复访问权限后再试。';
  }
  return level === 'comment'
    ? '只读模式：你在此页面的访问级别为「评论」，可以阅读与评论，但不能直接编辑正文。'
    : `只读模式：你在此页面的访问级别为「${permissionLevelLabel(level)}」，可以阅读但不能修改正文。`;
}

export function ReadonlyBanner({ reason, level }: { reason: ReadonlyReason; level: PermissionLevel }) {
  const denied = reason === 'auth-failed';
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b px-4 py-1.5 text-[11px] leading-relaxed',
        denied
          ? 'border-[color-mix(in_srgb,var(--err-ink)_18%,transparent)] bg-[color-mix(in_srgb,var(--err-ink)_6%,transparent)] text-[var(--err-ink)]'
          : 'border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted-strong)]',
      )}
    >
      {denied ? (
        <Warning aria-hidden className="size-3.5 shrink-0" weight="fill" />
      ) : (
        <LockSimple aria-hidden className="size-3.5 shrink-0" weight="regular" />
      )}
      <span className="min-w-0">{readonlyBannerCopy(reason, level)}</span>
    </div>
  );
}
