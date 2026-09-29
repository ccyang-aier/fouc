'use client';

import { ArrowRight, ArrowUpRight, BookOpenText, ChatCircleDots, GearSix } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

export function HelpFeedbackCanvas({ onNavigate }: { onNavigate: (view: 'knowledge' | 'settings') => void }) {
  return <section className="h-full overflow-auto bg-[var(--panel)] px-8 py-12 sm:px-14">
    <div className="mx-auto max-w-[860px]">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--accent-ink)]">FOUC · SUPPORT</p>
      <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.035em] text-[var(--ink)]">帮助与反馈</h1>
      <p className="mt-2 text-[13px] leading-6 text-[var(--muted-strong)]">了解工作台的基础用法，或把遇到的问题和建议告诉我们。</p>

      <div className="mt-9 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-[var(--line)] bg-[var(--surface-subtle)] p-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-ink)]"><BookOpenText size={21} weight="duotone" /></span>
          <h2 className="mt-5 text-[16px] font-semibold text-[var(--ink)]">开始使用</h2>
          <p className="mt-2 min-h-12 text-[12px] leading-6 text-[var(--muted-strong)]">先选择工作区，再创建知识库和文档。外观与本机偏好可以在设置中调整。</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onNavigate('knowledge')}><BookOpenText size={15} />打开知识库</Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate('settings')}><GearSix size={15} />打开设置</Button>
          </div>
        </article>
        <article className="rounded-2xl border border-[var(--line)] bg-[var(--surface-subtle)] p-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-ink)]"><ChatCircleDots size={21} weight="duotone" /></span>
          <h2 className="mt-5 text-[16px] font-semibold text-[var(--ink)]">问题与建议</h2>
          <p className="mt-2 min-h-12 text-[12px] leading-6 text-[var(--muted-strong)]">遇到异常或有改进想法，可以在项目的反馈页面记录复现步骤和期望效果。</p>
          <a href="https://github.com/ccyang-aier/fouc/issues/new" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-[11px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">前往反馈页面 <ArrowUpRight size={14} /></a>
        </article>
      </div>
      <p className="mt-6 flex items-center gap-1.5 text-[11px] text-[var(--muted)]"><ArrowRight size={13} />反馈页面由 GitHub 提供，提交时可能需要登录 GitHub。</p>
    </div>
  </section>;
}
