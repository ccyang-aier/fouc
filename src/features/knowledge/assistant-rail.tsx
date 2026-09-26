'use client';

/**
 * The reserved right column of the knowledge shell (U02): review (S02) and the
 * AI side panel (J06) mount here later. Until then the rail renders its honest
 * placeholder — no fabricated chat or review UI — and stays out of the way:
 * closed by default, opened from the canvas header, closable with Escape.
 */

import { useEffect } from 'react';
import { ChatCircleDots, X } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { CanvasState } from './canvas-states';

export function AssistantRailToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={open ? '收起评审与 AI 栏' : '展开评审与 AI 栏'}
      aria-pressed={open}
      title={open ? '收起评审与 AI 栏' : '展开评审与 AI 栏'}
      onClick={onToggle}
      className={
        open
          ? 'flex h-7 items-center gap-1.5 rounded-[6px] bg-[var(--accent-soft)] px-2 text-[11px] font-medium text-[var(--accent-ink)] outline-none transition-colors hover:border-[var(--accent-soft-line)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]'
          : 'flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[11px] font-medium text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--raise)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]'
      }
    >
      <ChatCircleDots aria-hidden className="size-3.5" />
      评审与 AI
    </button>
  );
}

export function AssistantRail({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <motion.aside
      aria-label="评审与 AI"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full w-[320px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--panel)]"
    >
      <header className="flex h-[42px] shrink-0 items-center justify-between border-b border-[var(--line)] pl-4 pr-2">
        <span className="text-[12px] font-medium text-[var(--ink)]">评审与 AI</span>
        <button
          type="button"
          aria-label="收起评审与 AI 栏"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-[6px] text-[var(--muted)] outline-none transition-colors hover:bg-[var(--raise)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
        >
          <X aria-hidden className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1">
        <CanvasState
          icon={<ChatCircleDots className="size-5" aria-hidden weight="regular" />}
          title="评审与 AI 助手将在这里接入"
          hint="建议模式、侧栏对话与可点击的引用跳转会出现在这一栏。"
          announce="polite"
        />
      </div>
    </motion.aside>
  );
}
