'use client';
import { fixtureArrayField, fixtureField, translateFixed } from './i18n/display';

import { useTranslation } from '@/lib/i18n';
import { messages } from './i18n/project-workobject-detail';

import {
  CaretDown,
  Check,
  CheckCircle,
  ClipboardText,
  Cube,
  Database,
  DotsThreeVertical,
  ListChecks,
  Microphone,
  Paperclip,
  PaperPlaneTilt,
  Pause,
  Robot,
  ShieldCheck,
  Sparkle,
  User,
  UserPlus,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { Fragment, useState } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { type ProjectTab } from './project-data';
import type { DetailFeedEntry, WorkObjectDetail } from './project-workobject-detail-data';
import { WorkObjectPanel } from './project-workobject-panel';
import { WorkAssigneeAvatar } from './work-assignee';

const BLUE = '#4674ab';
const WARN_ORANGE = '#d98e42';

type WorkObjectDetailCanvasProps = {
  detail: WorkObjectDetail;
  onExit: (tab: ProjectTab) => void;
};

/** 工作对象执行详情页：由产物页上下文面板进入，面包屑可返回项目空间 */
export function WorkObjectDetailCanvas({ detail, onExit }: WorkObjectDetailCanvasProps) {
  const { t, locale } = useTranslation(messages);

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <header className="shrink-0 px-5 pt-4">
        <nav
          aria-label={t('页面位置')}
          className="flex items-center gap-2 text-[12px] leading-[18px]"
        >
          <button
            type="button"
            onClick={() => onExit('overview')}
            className="rounded text-[var(--muted-strong)] outline-none transition-colors hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            {t('项目')}
          </button>
          <span aria-hidden className="text-[var(--muted)]">
            /
          </span>
          <button
            type="button"
            onClick={() => onExit('outputs')}
            className="rounded text-[var(--muted-strong)] outline-none transition-colors hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            {t('Fouc 桌面端 V1')}
          </button>
          <span aria-hidden className="text-[var(--muted)]">
            /
          </span>
          <span className="font-medium text-[var(--ink-soft)]">{detail.id}</span>
        </nav>

        <div className="mt-[15px] flex items-center gap-3">
          <h1 className="min-w-0 truncate text-[20px] font-semibold leading-7 tracking-[-0.02em] text-[var(--ink)]">
            {detail.id}
            <span className="ml-3">{fixtureField(detail, 'title', locale)}</span>
          </h1>
          <span className="flex h-6 shrink-0 items-center rounded-[6px] bg-[#e9f0f8] px-2.5 text-[12px] font-medium text-[#3d67a0]">
            {fixtureField(detail, 'badge', locale)}
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="flex h-9 items-center gap-1.5 rounded-[8px] border border-[var(--line)] bg-panel px-3 text-[12.5px] text-[var(--ink)] outline-none transition-colors hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <Pause className="size-[15px]" weight="fill" />
              {t('暂停')}
            </button>
            <button
              type="button"
              className="flex h-9 items-center gap-1.5 rounded-[8px] border border-[var(--line)] bg-panel px-3 text-[12.5px] text-[var(--ink)] outline-none transition-colors hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <UserPlus className="size-[15px]" />
              {t('接管')}
            </button>
            <button
              type="button"
              aria-label={t('更多操作')}
              className="flex size-9 items-center justify-center rounded-[8px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <DotsThreeVertical className="size-4" weight="bold" />
            </button>
          </div>
        </div>

        <div className="mt-[26px] flex h-6 items-center text-[12px]">
          {detail.meta.map((item, index) => (
            <Fragment key={item.label}>
              {index > 0 ? (
                <span aria-hidden className="mx-[18px] h-[14px] w-px bg-[var(--line)]" />
              ) : null}
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[var(--muted-strong)]">
                  {fixtureField(item, 'label', locale)}
                </span>
                {item.icon === 'user' ? (
                  <User className="size-[13px] text-[var(--muted-strong)]" />
                ) : null}
                {item.icon === 'bot' ? (
                  <Robot className="size-[13px] text-[var(--ink-soft)]" />
                ) : null}
                <span className="font-medium text-[var(--ink)]">
                  {fixtureField(item, 'value', locale)}
                </span>
              </span>
            </Fragment>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 gap-8 px-5 pb-0 max-[1150px]:gap-6">
        <div className="flex min-w-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1">
            <div className="pb-5 pt-[30px]">
              <SummaryCards detail={detail} />
              <div className="mt-7 max-w-[715px] space-y-6 pl-[10px]">
                {detail.feed.map((entry, index) => (
                  <FeedItem key={index} entry={entry} />
                ))}
              </div>
            </div>
          </ScrollArea>
          <Composer detail={detail} />
        </div>

        <div className="w-[355px] shrink-0 pb-0 max-[1150px]:hidden">
          <WorkObjectPanel detail={detail} onClose={() => onExit('outputs')} />
        </div>
      </div>
    </div>
  );
}

function SummaryCards({ detail }: { detail: WorkObjectDetail }) {
  const { t, locale } = useTranslation(messages);

  return (
    <div className="grid grid-cols-3 gap-[18px] max-[980px]:grid-cols-1">
      <section className="rounded-[10px] border border-[var(--line)] bg-panel p-4">
        <div className="flex items-center gap-2">
          <Cube className="size-[17px] text-[#5f7396]" />
          <h2 className="text-[13px] font-semibold text-[var(--ink)]">{t('当前结论')}</h2>
        </div>
        <div className="mt-3 space-y-1">
          {detail.conclusion.map((paragraph, index) => (
            <p key={paragraph} className="text-[12.5px] leading-[20px] text-[var(--ink-soft)]">
              {fixtureArrayField(detail, 'conclusion', index, locale)}
            </p>
          ))}
        </div>
      </section>

      <PlanCard plan={detail.plan} />

      <section className="flex flex-col rounded-[10px] border border-[var(--line)] bg-panel p-4">
        <div className="flex items-center gap-2">
          <WarningCircle className="size-[17px]" weight="fill" color={WARN_ORANGE} />
          <h2 className="text-[13px] font-semibold text-[var(--ink)]">{t('等待事项')}</h2>
        </div>
        <p className="mt-3 text-[12.5px] leading-[20px] text-[var(--ink-soft)]">
          {fixtureField(detail.pending, 'text', locale)}
        </p>
        <span className="mt-auto flex justify-end pt-2">
          <span className="flex h-[22px] items-center rounded-[6px] bg-[#f7ece3] px-2 text-[11px] font-medium text-[#bf7a35]">
            {fixtureField(detail.pending, 'badge', locale)}
          </span>
        </span>
      </section>
    </div>
  );
}

function PlanCard({ plan }: { plan: WorkObjectDetail['plan'] }) {
  const { t, locale } = useTranslation(messages);

  const [done, setDone] = useState(() => plan.map((item) => item.done));

  function toggle(index: number) {
    setDone((current) => current.map((value, i) => (i === index ? !value : value)));
  }

  return (
    <section className="rounded-[10px] border border-[var(--line)] bg-panel p-4">
      <div className="flex items-center gap-2">
        <ListChecks className="size-[17px] text-[#5f7396]" />
        <h2 className="text-[13px] font-semibold text-[var(--ink)]">{t('当前计划')}</h2>
      </div>
      <div className="mt-3 space-y-[10px]">
        {plan.map((item, index) => (
          <button
            key={item.label}
            type="button"
            aria-pressed={done[index]}
            onClick={() => toggle(index)}
            className="group flex w-full items-center gap-2.5 rounded text-left text-[12.5px] text-[var(--ink-soft)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <span
              className={cn(
                'flex size-[15px] shrink-0 items-center justify-center rounded-[4px] border transition-colors',
                done[index]
                  ? 'border-[#4674ab] bg-[#4674ab] text-white'
                  : 'border-[#c9ced6] bg-panel group-hover:border-[#a9b4c4]',
              )}
            >
              {done[index] ? <Check className="size-2.5" weight="bold" /> : null}
            </span>
            <span className={cn(done[index] && 'line-through decoration-[var(--muted)]')}>
              {fixtureField(item, 'label', locale)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

const BotAvatar = () => (
  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] bg-panel text-[#44536e]">
    <User className="size-[15px]" weight="fill" />
  </span>
);

function FeedAvatar({
  entry,
}: {
  entry: Extract<DetailFeedEntry, { kind: 'message' | 'result' | 'approval' }>;
}) {
  if (entry.author.bot) return <BotAvatar />;
  return <WorkAssigneeAvatar assignee={entry.author} />;
}

function FeedItem({ entry }: { entry: DetailFeedEntry }) {
  if (entry.kind === 'tool') {
    return (
      <div className="flex items-center gap-2">
        <BotAvatar />
        <div className="min-w-0 flex-1">
          <ToolCard entry={entry} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <FeedAvatar entry={entry} />
      {entry.kind === 'message' ? (
        <MessageBody entry={entry} />
      ) : entry.kind === 'result' ? (
        <ResultCard entry={entry} />
      ) : (
        <ApprovalCard entry={entry} />
      )}
    </div>
  );
}

function MessageBody({ entry }: { entry: Extract<DetailFeedEntry, { kind: 'message' }> }) {
  const { locale } = useTranslation(messages);

  const [planOpen, setPlanOpen] = useState(false);

  return (
    <div className="min-w-0 flex-1 pt-0.5">
      <div className="flex items-baseline gap-3">
        <span className="text-[13px] font-semibold text-[var(--ink)]">
          {fixtureField(entry.author, 'name', locale)}
        </span>
        <span className="text-[11px] text-[var(--muted)]">
          {fixtureField(entry, 'time', locale)}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] leading-[21px] text-[var(--ink-soft)]">
        {fixtureField(entry, 'text', locale)}
      </p>
      {entry.plan ? (
        <div className="mt-2.5">
          <button
            type="button"
            aria-expanded={planOpen}
            onClick={() => setPlanOpen((open) => !open)}
            className="flex items-center gap-1.5 rounded text-[12.5px] text-[var(--ink-soft)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <ClipboardText className="size-[15px] text-[var(--muted-strong)]" />
            {fixtureField(entry.plan, 'label', locale)}
            <CaretDown
              className={cn(
                'size-3 text-[var(--muted-strong)] transition-transform',
                planOpen && 'rotate-180',
              )}
            />
          </button>
          {planOpen ? (
            <ol className="mt-2 space-y-1.5 border-l border-[var(--line)] pl-4">
              {entry.plan.steps.map((step, index) => (
                <li
                  key={step}
                  className="flex items-center gap-2 text-[12px] text-[var(--ink-soft)]"
                >
                  <span className="flex size-[18px] items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] font-semibold text-[var(--accent-ink)]">
                    {index + 1}
                  </span>
                  {fixtureArrayField(entry.plan, 'steps', index, locale)}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ToolCard({ entry }: { entry: Extract<DetailFeedEntry, { kind: 'tool' }> }) {
  const { locale } = useTranslation(messages);
  const uiLabel = (value: string) => translateFixed(value, locale);

  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[10px] border border-[var(--line)] bg-panel">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-[50px] w-full items-center gap-2.5 rounded-[10px] px-4 text-left outline-none transition-colors hover:bg-[#fafbfc] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
      >
        <CheckCircle className="size-[18px] shrink-0" weight="fill" color={BLUE} />
        <span className="min-w-0 truncate text-[13px] font-medium text-[var(--ink)]">
          {fixtureField(entry, 'tool', locale)}
          <span className="mx-1.5 text-[var(--muted)]">·</span>
          {fixtureField(entry, 'action', locale)}
        </span>
        <span className="ml-auto shrink-0 text-[12px] text-[var(--muted-strong)]">
          {uiLabel(entry.state)}
        </span>
        <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-[var(--line)]" />
        <CaretDown
          className={cn(
            'size-3 shrink-0 text-[var(--muted-strong)] transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <p className="border-t border-[var(--line)] px-4 py-2.5 text-[12px] text-[var(--muted-strong)]">
          {entry.detail}
        </p>
      ) : null}
    </div>
  );
}

function ResultCard({ entry }: { entry: Extract<DetailFeedEntry, { kind: 'result' }> }) {
  const { t, locale } = useTranslation(messages);

  const [open, setOpen] = useState(true);
  const total = entry.pass + entry.fail + entry.skip;

  return (
    <div className="min-w-0 flex-1 rounded-[10px] border border-[var(--line)] bg-panel p-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-baseline gap-3 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <span className="text-[13px] font-semibold text-[var(--ink)]">
          {fixtureField(entry.author, 'name', locale)}
        </span>
        <span className="text-[11px] text-[var(--muted)]">
          {fixtureField(entry, 'time', locale)}
        </span>
        <CaretDown
          className={cn(
            'ml-auto size-3.5 self-center text-[var(--muted-strong)] transition-transform',
            !open && '-rotate-90',
          )}
        />
      </button>
      {open ? (
        <>
          <p className="mt-2 text-[12px] text-[var(--ink-soft)]">{entry.caption}</p>
          <div className="mt-2 rounded-[8px] bg-[#f7f8fa] p-3.5">
            <p className="text-[12.5px] font-semibold text-[var(--ink)]">{entry.suite}</p>
            <div className="mt-2.5 flex items-center gap-6">
              <span className="flex items-baseline gap-1.5 text-[12px]">
                <span className="font-medium text-[#4674ab]">{t('通过')}</span>
                <span className="font-semibold text-[var(--ink)]">{entry.pass}</span>
              </span>
              <span className="flex items-baseline gap-1.5 text-[12px]">
                <span className="text-[var(--muted-strong)]">{t('失败')}</span>
                <span className="font-semibold text-[var(--ink)]">{entry.fail}</span>
              </span>
              <span className="flex items-baseline gap-1.5 text-[12px]">
                <span className="text-[var(--muted-strong)]">{t('跳过')}</span>
                <span className="font-semibold text-[var(--ink)]">{entry.skip}</span>
              </span>
              <span className="ml-auto flex min-w-0 flex-1 items-center gap-3 max-[980px]:hidden">
                <span className="flex flex-1 flex-col gap-1.5">
                  <span className="self-end text-[11px] text-[var(--muted-strong)]">
                    {t('成功率')}
                    <span className="text-[12px] font-semibold text-[var(--ink)]">
                      {entry.rate}
                    </span>
                  </span>
                  <span className="h-1 overflow-hidden rounded-full bg-[#e8eaf0]">
                    <span
                      className="block h-full rounded-full bg-[#4674ab]"
                      style={{ width: `${total === 0 ? 0 : (entry.pass / total) * 100}%` }}
                    />
                  </span>
                </span>
              </span>
              <button
                type="button"
                className="shrink-0 rounded-[8px] border border-[var(--line)] bg-panel px-3 py-1.5 text-[12px] text-[var(--ink-soft)] outline-none transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                {t('查看详情')}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ApprovalCard({ entry }: { entry: Extract<DetailFeedEntry, { kind: 'approval' }> }) {
  const { locale } = useTranslation(messages);

  return (
    <div className="min-w-0 flex-1 rounded-[10px] border border-[#f0dcc4] bg-panel p-4">
      <div className="flex items-center gap-2">
        <WarningCircle className="size-[17px] shrink-0" weight="fill" color={WARN_ORANGE} />
        <span className="text-[13px] font-semibold text-[var(--ink)]">
          {fixtureField(entry.author, 'name', locale)}
        </span>
        <span className="text-[11px] text-[var(--muted)]">
          {fixtureField(entry, 'time', locale)}
        </span>
        <span className="ml-auto flex h-[22px] shrink-0 items-center rounded-[6px] bg-[#f7ece3] px-2 text-[11px] font-medium text-[#bf7a35]">
          {fixtureField(entry, 'badge', locale)}
        </span>
      </div>
      <p className="mt-2 pl-[25px] text-[13px] font-semibold text-[var(--ink)]">
        {fixtureField(entry, 'title', locale)}
      </p>
      <p className="mt-1 pl-[25px] text-[12.5px] leading-[20px] text-[var(--ink-soft)]">
        {fixtureField(entry, 'body', locale)}
      </p>
    </div>
  );
}

function Composer({ detail }: { detail: WorkObjectDetail }) {
  const { t } = useTranslation(messages);

  const [value, setValue] = useState('');

  return (
    <div className="shrink-0 pb-5 pt-4">
      <div className="rounded-[12px] border border-[var(--line)] bg-panel px-4 pb-3 pt-3.5 transition-colors focus-within:border-[#a9c0e0]">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={1}
          aria-label={t('回复工作对象')}
          placeholder={detail.composerPlaceholder}
          className="block w-full resize-none bg-transparent text-[13px] leading-5 text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
        />
        <div className="mt-3 flex items-center gap-1">
          <button
            type="button"
            aria-label={t('添加附件')}
            className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[#f4f5f6] text-[var(--muted-strong)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <Paperclip className="size-4" />
          </button>
          <button
            type="button"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] px-2 text-[12.5px] text-[var(--ink-soft)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <Database className="size-[15px]" />
            {t('添加上下文')}
          </button>
          <span aria-hidden className="mx-1.5 h-4 w-px bg-[var(--line)]" />
          <button
            type="button"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] px-2 text-[12.5px] text-[var(--ink-soft)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <ShieldCheck className="size-[15px]" />
            {t('默认权限')}
            <CaretDown className="size-3 text-[var(--muted-strong)]" />
          </button>
          <span aria-hidden className="mx-1.5 h-4 w-px bg-[var(--line)]" />
          <span className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-[#f4f5f6] px-3 text-[12px] text-[var(--ink-soft)]">
            {detail.scopeChip}
            <button
              type="button"
              aria-label={t('移除作用范围')}
              className="flex items-center rounded text-[var(--muted)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <X className="size-3" weight="bold" />
            </button>
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="flex h-8 shrink-0 items-center gap-1 rounded-[8px] px-2 text-[12.5px] text-[var(--ink-soft)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <Sparkle className="size-[14px]" />
              {t('Auto')}
              <CaretDown className="size-3 text-[var(--muted-strong)]" />
            </button>
            <button
              type="button"
              aria-label={t('语音输入')}
              className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <Microphone className="size-[17px]" />
            </button>
            <button
              type="button"
              aria-label={t('发送')}
              className="ml-1 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#4674ab] text-white outline-none transition-[background-color,transform] hover:bg-[#3d67a0] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95"
            >
              <PaperPlaneTilt className="size-[15px]" weight="fill" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
