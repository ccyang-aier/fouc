'use client';

/**
 * The recycle-bin view (U03): the directly recycled pages of the workspace,
 * newest first, with restore. Restoration returns the page (and its attached
 * subtree) to its original position — the T01 contract keeps `parentId`/
 * `position` untouched through a recycle, so no re-placement is needed.
 *
 * Permanent deletion stays an explicit non-action: its semantics (purge
 * scheduling, subtree fencing) belong to the recycle-bin backend task (Z01),
 * so the entry renders reserved-but-disabled instead of faking a delete.
 */

import { useState } from 'react';
import { CaretRight, CircleNotch, FileText, Trash, ArrowFatLineUp } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { RecycledPageSummary } from './tree-model';

export function RecycleBin({
  pages,
  restoringIds,
  onRestore,
  className,
}: {
  pages: readonly RecycledPageSummary[];
  restoringIds: ReadonlySet<string>;
  onRestore: (pageId: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (pages.length === 0) return null;

  return (
    <section aria-label="回收站" className={cn('mt-3 border-t border-[var(--line)] pt-2', className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-[28px] w-full items-center gap-1.5 rounded-[6px] px-1.5 text-left outline-none transition-colors hover:bg-[var(--raise)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
      >
        <CaretRight aria-hidden size={10} weight="fill" className={cn('text-[var(--muted)] transition-transform duration-200', open && 'rotate-90')} />
        <Trash aria-hidden size={13} className="text-[var(--muted)]" />
        <span className="flex-1 text-[11px] font-medium text-[var(--muted-strong)]">回收站</span>
        <span className="rounded-full bg-[var(--raise)] px-1.5 text-[10px] font-medium text-[var(--muted-strong)]">{pages.length}</span>
      </button>
      {open ? (
        <ul className="mt-0.5 space-y-px" role="list" aria-label="已回收的页面">
          {pages.map((page) => {
            const restoring = restoringIds.has(page.id);
            return (
              <li key={page.id} className="group/bin flex items-center gap-2 rounded-[6px] pl-3 pr-1.5 hover:bg-[var(--raise)]">
                <FileText aria-hidden size={14} className="shrink-0 text-[var(--muted)]" />
                <span className="min-w-0 flex-1 truncate py-[7px] text-[12px] text-[var(--muted-strong)]">{page.title}</span>
                <span className="shrink-0 text-[10px] text-[var(--muted)] opacity-0 transition-opacity group-hover/bin:opacity-100">{formatDay(page.deletedAt)}</span>
                {restoring ? (
                  <CircleNotch aria-label="正在恢复" size={13} className="size-[13px] shrink-0 animate-spin text-[var(--muted)]" />
                ) : (
                  <button
                    type="button"
                    title="恢复到原位置"
                    aria-label={`恢复「${page.title}」`}
                    onClick={() => onRestore(page.id)}
                    className="flex size-[22px] shrink-0 items-center justify-center rounded-[5px] text-[var(--muted)] outline-none transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
                  >
                    <ArrowFatLineUp aria-hidden size={12} />
                  </button>
                )}
                <button
                  type="button"
                  disabled
                  title="彻底删除将随回收站服务(Z01)提供"
                  aria-label={`彻底删除「${page.title}」（尚未提供）`}
                  className="flex size-[22px] shrink-0 cursor-not-allowed items-center justify-center rounded-[5px] text-[var(--muted)] opacity-35"
                >
                  <Trash aria-hidden size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className={cn('px-3 pb-1 pt-0.5 text-[10px] leading-relaxed text-[var(--muted)]', open ? 'block' : 'hidden')}>
        恢复的页面会连同子页面回到原位置；彻底删除待回收站服务就绪后提供。
      </p>
    </section>
  );
}

function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return `${sameYear ? '' : `${date.getFullYear()}/`}${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}
