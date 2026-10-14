'use client';

import { useTranslation } from '@/lib/i18n';
import { ArrowRight } from '@phosphor-icons/react';
import Image from 'next/image';
import { fixtureField } from './i18n/display';
import { messages } from './i18n/project-activity';

import { cn } from '@/lib/utils';

import { toneIcons } from '@/lib/icon-tones';
import { inProgress, recentOutputs } from './project-data';

export function ProjectActivity({
  onOpenWork,
  onOpenOutputs,
}: {
  onOpenWork: () => void;
  onOpenOutputs: () => void;
}) {
  const { t, locale } = useTranslation(messages);

  return (
    <div className="grid grid-cols-2 divide-x divide-[var(--line)] max-[940px]:grid-cols-1 max-[940px]:divide-x-0">
      <ActivityColumn title={t('正在推进')} footer={t('查看全部工作')} onFooterClick={onOpenWork}>
        {inProgress.map((item) => (
          <div
            key={item.title}
            className="grid h-[62px] grid-cols-[28px_minmax(0,1fr)_30px_64px_68px] items-center gap-2 border-t border-[var(--line)] px-1"
          >
            <item.icon className={cn('size-[21px]', toneIcons[item.tone])} weight="fill" />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-[var(--ink)]">
                {fixtureField(item, 'title', locale)}
              </p>
              <p className="mt-0.5 text-[9.5px] text-[var(--muted)]">
                {fixtureField(item, 'meta', locale)}
              </p>
            </div>
            <Image
              src={item.avatar}
              alt=""
              width={28}
              height={28}
              className="size-7 rounded-full object-cover"
            />
            <span className="text-[10px] text-[var(--muted-strong)]">
              {fixtureField(item, 'date', locale)}
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-medium text-[var(--muted-strong)]">
                {item.progress}%
              </span>
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                <span
                  className="block h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${item.progress}%` }}
                />
              </span>
            </span>
          </div>
        ))}
      </ActivityColumn>

      <ActivityColumn
        title={t('最近产出')}
        footer={t('查看全部产出')}
        onFooterClick={onOpenOutputs}
        className="pl-5 max-[940px]:pl-0"
      >
        {recentOutputs.map((item) => (
          <div
            key={item.title}
            className="grid h-[62px] grid-cols-[28px_minmax(0,1fr)_58px_88px] items-center gap-2 border-t border-[var(--line)] px-1"
          >
            <item.icon className={cn('size-[21px]', toneIcons[item.tone])} weight="fill" />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-[var(--ink)]">
                {fixtureField(item, 'title', locale)}
              </p>
              <p className="mt-0.5 text-[9.5px] text-[var(--muted)]">
                {fixtureField(item, 'meta', locale)}
              </p>
            </div>
            <span className="text-[10px] text-[var(--muted-strong)]">
              {fixtureField(item, 'owner', locale)}
            </span>
            <span className="text-right text-[9.5px] text-[var(--muted)]">
              {fixtureField(item, 'time', locale)}
            </span>
          </div>
        ))}
      </ActivityColumn>
    </div>
  );
}

function ActivityColumn({
  title,
  footer,
  children,
  onFooterClick,
  className = 'pr-5',
}: {
  title: string;
  footer: string;
  children: React.ReactNode;
  onFooterClick: () => void;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="mb-2.5 text-[13px] font-semibold text-[var(--ink)]">{title}</h2>
      {children}
      <button
        type="button"
        onClick={onFooterClick}
        className="mt-1.5 flex h-6 items-center gap-1 text-[10px] text-[var(--muted-strong)] outline-none transition-colors hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        {footer}
        <ArrowRight className="size-3" />
      </button>
    </section>
  );
}
