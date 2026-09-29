'use client';

import { ArrowRight, BookOpenText, FileText, FolderOpen, Tag } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

export function LocalLibraryEmptyState({ onCreate }: { onCreate: () => void }) {
  return <section className="relative flex h-full min-h-[480px] items-center justify-center overflow-auto px-6 py-14">
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(ellipse_at_50%_0%,var(--accent-soft),transparent_68%)] opacity-65" />
    <div className="relative w-full max-w-[590px] text-center">
      <div aria-hidden className="relative mx-auto mb-8 h-[164px] w-[220px]">
        <div className="absolute left-5 top-6 h-[128px] w-[142px] -rotate-[11deg] rounded-[18px] border border-[var(--line)] bg-[var(--surface-subtle)] shadow-[0_18px_45px_-30px_rgba(35,50,95,.5)]">
          <span className="absolute left-5 top-8 h-2 w-16 rounded-full bg-[var(--line-strong)]" />
          <span className="absolute left-5 top-14 h-1.5 w-24 rounded-full bg-[var(--line)]" />
          <span className="absolute left-5 top-[74px] h-1.5 w-20 rounded-full bg-[var(--line)]" />
        </div>
        <div className="absolute right-1 top-3 h-[142px] w-[148px] rotate-[9deg] rounded-[18px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_22px_48px_-28px_rgba(35,50,95,.42)]">
          <span className="absolute left-5 top-7 flex size-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-ink)]"><FileText size={18} weight="duotone" /></span>
          <span className="absolute left-5 top-[76px] h-2 w-[94px] rounded-full bg-[var(--line-strong)]" />
          <span className="absolute left-5 top-[96px] h-1.5 w-[72px] rounded-full bg-[var(--line)]" />
        </div>
        <span className="absolute bottom-0 left-[76px] flex size-[70px] items-center justify-center rounded-[20px] border border-[var(--accent-soft-line)] bg-[var(--panel)] text-[var(--accent-ink)] shadow-[0_18px_35px_-18px_rgba(35,50,95,.55)]"><BookOpenText size={34} weight="duotone" /></span>
      </div>

      <p className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-[var(--accent-ink)]">你的工作区知识库</p>
      <h1 className="text-[26px] font-semibold tracking-[-0.035em] text-[var(--ink)] sm:text-[30px]">让好想法，有处可寻</h1>
      <p className="mx-auto mt-3 max-w-[380px] text-[13px] leading-7 text-[var(--muted-strong)]">创建一个知识库，把资料、文档和灵感整理在一起。<br className="hidden sm:block" />从这里开始，构建属于你的知识空间。</p>
      <Button onClick={onCreate} className="mt-7 h-10 rounded-lg px-5 text-[12px] shadow-[0_8px_20px_color-mix(in_srgb,var(--accent)_20%,transparent)]">新建知识库 <ArrowRight size={15} /></Button>

      <div className="mx-auto mt-12 flex max-w-[430px] items-center justify-center gap-7 border-t border-[var(--line)] pt-5 text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5"><FolderOpen size={15} />整理资料</span>
        <span className="flex items-center gap-1.5"><FileText size={15} />记录内容</span>
        <span className="flex items-center gap-1.5"><Tag size={15} />添加标签</span>
      </div>
    </div>
  </section>;
}
