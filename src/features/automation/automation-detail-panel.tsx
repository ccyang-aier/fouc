'use client';

import { useTranslation } from '@/lib/i18n/react';
import { messages } from './i18n/automation-detail-panel.messages';

import { useState, type ComponentType } from 'react';
import {
  BellSimple,
  CaretLeft,
  CircleNotch,
  Clock,
  Gauge,
  Play,
  Robot,
  X,
} from '@phosphor-icons/react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AppAlert } from '@/components/app-alert';

import type { AutomationDefinition } from './automation-data';

type CreateDraft = { title: string; instruction: string; schedule: string; agent: string };

export function AutomationDetailPanel({
  item,
  creating,
  running,
  onClose,
  onToggle,
  onRun,
  onSave,
  onCreate,
}: {
  item: AutomationDefinition | null;
  creating: boolean;
  running: boolean;
  onClose: () => void;
  onToggle: (enabled: boolean) => void;
  onRun: () => void;
  onSave: () => void;
  onCreate: (draft: CreateDraft) => void;
}) {
  const uiText = useTranslation(messages).t;
  return (
    <aside
      aria-label={creating ? uiText('新建自动化') : uiText('自动化详情')}
      className="responsive-side-panel-surface flex h-full min-h-0 w-[292px] shrink-0 flex-col border-l border-[var(--line)] bg-panel max-[1060px]:absolute max-[1060px]:inset-y-0 max-[1060px]:right-0 max-[1060px]:z-30"
    >
      {creating ? (
        <CreatePanel onClose={onClose} onCreate={onCreate} />
      ) : item ? (
        <DetailContent
          item={item}
          running={running}
          onClose={onClose}
          onToggle={onToggle}
          onRun={onRun}
          onSave={onSave}
        />
      ) : null}
    </aside>
  );
}

function PanelHeader({
  path,
  backLabel,
  onClose,
}: {
  path: string;
  backLabel: string;
  onClose: () => void;
}) {
  const uiText = useTranslation(messages).t;
  return (
    <div className="flex h-[74px] shrink-0 items-center border-b border-[var(--line)] px-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10.5px] font-medium text-[var(--ink-soft)]">
          {uiText('breadcrumbPrefix')}
          {path}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 flex items-center gap-1 text-[9.5px] text-[var(--muted)] outline-none transition-colors hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <CaretLeft className="size-3" />
          {backLabel}
        </button>
      </div>
      <button
        type="button"
        aria-label={uiText('关闭自动化详情')}
        onClick={onClose}
        className="flex size-8 items-center justify-center rounded-[7px] border border-[var(--line)] text-[var(--muted-strong)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function DetailContent({
  item,
  running,
  onClose,
  onToggle,
  onRun,
  onSave,
}: {
  item: AutomationDefinition;
  running: boolean;
  onClose: () => void;
  onToggle: (enabled: boolean) => void;
  onRun: () => void;
  onSave: () => void;
}) {
  const uiText = useTranslation(messages).t;
  return (
    <>
      <PanelHeader path={item.title} backLabel={uiText('返回自动化列表')} onClose={onClose} />
      <ScrollArea className="min-h-0 flex-1" viewportClassName="px-4 py-4">
        <h2 className="text-[15px] leading-6 font-semibold tracking-[-0.02em]">{item.title}</h2>
        <div className="mt-3 flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1 rounded-[5px] px-2 py-1 text-[8.5px] font-medium',
              item.enabled
                ? 'bg-[#edf7f2] text-[#308a61]'
                : 'bg-[#f1f2f4] text-[var(--muted-strong)]',
            )}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {item.enabled ? uiText('已启用') : uiText('已暂停')}
          </span>
          <span className="font-mono text-[8.5px] text-[var(--muted)]">ID: {item.id}</span>
          <button
            type="button"
            role="switch"
            aria-checked={item.enabled}
            onClick={() => onToggle(!item.enabled)}
            className={cn(
              'relative ml-auto h-5 w-9 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
              item.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--switch-off)]',
            )}
          >
            <span
              className={cn(
                'absolute top-[3px] size-3.5 rounded-full bg-white shadow-sm transition-transform',
                item.enabled ? 'translate-x-[19px]' : 'translate-x-[3px]',
              )}
            />
          </button>
        </div>
        <p className="mt-3 text-[9.5px] leading-[17px] text-[var(--muted-strong)]">
          {item.description}
        </p>
        <DetailSection title={uiText('执行规则')}>
          <DetailRow icon={Clock} label={uiText('触发条件')} value={item.schedule} />
          <DetailRow label={uiText('时区')} value={item.timezone} />
          <DetailRow label={uiText('条件（可选）')} value={uiText('无')} />
        </DetailSection>
        <DetailSection title={uiText('运行方式')}>
          <DetailRow icon={Robot} label={uiText('执行 Agent')} value={item.agent} />
          <DetailRow icon={Gauge} label={uiText('超时时间')} value={item.timeout} />
          <DetailRow label={uiText('并发策略')} value={uiText('不允许并发')} />
        </DetailSection>
        <DetailSection title={uiText('通知')}>
          <DetailRow icon={BellSimple} label={uiText('执行结果通知')} value={item.notification} />
          <DetailRow label={uiText('失败时额外通知')} value={uiText('开启')} />
        </DetailSection>
        <DetailSection title={uiText('最近运行')}>
          {[uiText('今天 08:32'), uiText('昨天 08:30'), uiText('5 月 10 日 08:30')].map((time) => (
            <button
              key={time}
              type="button"
              className="flex h-7 w-full items-center gap-2 rounded-[5px] px-1 text-[9px] outline-none hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <span className="text-[var(--muted-strong)] tabular-nums">{time}</span>
              <span className="ml-auto size-1.5 rounded-full bg-[#2f9a69]" />
              <span className="text-[#318761]">{uiText('成功')}</span>
              <CaretLeft className="size-3 rotate-180 text-[var(--muted)]" />
            </button>
          ))}
        </DetailSection>
      </ScrollArea>
      <div className="grid shrink-0 grid-cols-[.9fr_1.2fr] gap-2 border-t border-[var(--line)] p-3">
        <button
          type="button"
          onClick={onSave}
          className="h-9 rounded-[7px] border border-[var(--line)] bg-panel text-[10px] font-medium text-[var(--ink-soft)] outline-none transition-colors hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {uiText('保存更改')}
        </button>
        <button
          type="button"
          disabled={running}
          onClick={onRun}
          className="flex h-9 items-center justify-center gap-2 rounded-[7px] bg-[var(--accent)] text-[10.5px] font-semibold text-[var(--accent-foreground)] outline-none transition-[background-color,transform] hover:-translate-y-px hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-60"
        >
          {running ? (
            <CircleNotch className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" weight="fill" />
          )}
          {running ? uiText('启动中') : uiText('立即运行')}
        </button>
      </div>
    </>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 border-t border-[var(--line)] pt-2.5">
      <h3 className="mb-2 text-[10.5px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <button
      type="button"
      className="group grid min-h-8 w-full grid-cols-[92px_minmax(0,1fr)_12px] items-center gap-1 rounded-[5px] px-1 text-left text-[9.5px] outline-none transition-colors hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <span className="flex items-center gap-1.5 text-[var(--muted-strong)]">
        {Icon ? <Icon className="size-3.5" /> : null}
        {label}
      </span>
      <span className="truncate text-[var(--ink-soft)]">{value}</span>
      <CaretLeft className="size-3 rotate-180 text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function CreatePanel({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (draft: CreateDraft) => void;
}) {
  const uiText = useTranslation(messages).t;
  const [draft, setDraft] = useState<CreateDraft>({
    title: '',
    instruction: '',
    schedule: '每天 09:00',
    agent: 'Nova',
  });
  const [incomplete, setIncomplete] = useState(false);
  function updateDraft(next: CreateDraft) {
    setDraft(next);
    setIncomplete(false);
  }
  function submit() {
    if (!draft.title.trim() || !draft.instruction.trim()) {
      setIncomplete(true);
      return;
    }
    onCreate(draft);
  }
  return (
    <>
      <PanelHeader path={uiText('新建')} backLabel={uiText('取消创建')} onClose={onClose} />
      <ScrollArea className="min-h-0 flex-1" viewportClassName="px-4 py-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.02em]">{uiText('新建自动化')}</h2>
        <p className="mt-1.5 text-[9.5px] leading-4 text-[var(--muted)]">
          {uiText('描述触发时机和 Agent 要完成的结果。')}
        </p>
        <FormField label={uiText('名称')}>
          <input
            autoFocus
            value={draft.title}
            onChange={(event) => updateDraft({ ...draft, title: event.target.value })}
            placeholder={uiText('例如：每日工作简报')}
            className="h-9 w-full rounded-[6px] border border-[var(--line)] bg-panel px-2.5 text-[10px] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
          />
        </FormField>
        <FormField label={uiText('执行说明')}>
          <textarea
            value={draft.instruction}
            onChange={(event) => updateDraft({ ...draft, instruction: event.target.value })}
            placeholder={uiText('整理项目进展、风险与下一步…')}
            className="min-h-[96px] w-full resize-none rounded-[6px] border border-[var(--line)] bg-panel p-2.5 text-[10px] leading-5 outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
          />
        </FormField>
        <FormField label={uiText('触发条件')}>
          <Select
            value={draft.schedule}
            onChange={(value) => updateDraft({ ...draft, schedule: value })}
            options={(
              ['每天 09:00', '每个工作日 09:00', '每周五 16:00', '有新内容时'] as const
            ).map((value) => ({ value, label: uiText(value) }))}
          />
        </FormField>
        <FormField label={uiText('执行 Agent')}>
          <Select
            value={draft.agent}
            onChange={(value) => updateDraft({ ...draft, agent: value })}
            options={['Nova', 'Sage', 'Codey'].map((value) => ({ value, label: value }))}
          />
        </FormField>
        {incomplete ? (
          <AppAlert
            tone="warning"
            title={uiText('填写名称与执行说明后即可创建')}
            className="mt-4"
          />
        ) : null}
      </ScrollArea>
      <div className="shrink-0 border-t border-[var(--line)] p-3">
        <button
          type="button"
          onClick={submit}
          className="h-9 w-full rounded-[7px] bg-[var(--accent)] text-[10.5px] font-semibold text-[var(--accent-foreground)] outline-none transition-colors hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {uiText('创建并启用')}
        </button>
      </div>
    </>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-4 block">
      <span className="mb-1.5 block text-[9.5px] font-medium text-[var(--ink-soft)]">{label}</span>
      {children}
    </label>
  );
}
function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-[6px] border border-[var(--line)] bg-panel px-2.5 text-[10px] text-[var(--ink-soft)] outline-none focus:border-[var(--accent)]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
