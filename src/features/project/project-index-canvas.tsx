'use client';
import { translateFixed } from './i18n/display';

import { useTranslation } from '@/lib/i18n';
import { fixtureField } from './i18n/display';
import { messages } from './i18n/project-index-canvas';

import { AppAlert } from '@/components/app-alert';
import { useIdentity } from '@/features/identity/identity-provider';
import { ArrowUpRight, FolderOpen, Plus, SpinnerGap } from '@phosphor-icons/react';
import { useState } from 'react';
import { useProjectResources } from './project-resources';

export function ProjectIndexCanvas({ onOpenProject }: { onOpenProject: () => void }) {
  const { t, locale } = useTranslation(messages);

  const { session } = useIdentity();
  const [source, setSource] = useState<'local' | 'server'>('local');
  const { projects, status, error, selectedProject, selectProject, createProject } =
    useProjectResources();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const created = await createProject(name, source);
    setBusy(false);
    if (created) {
      setName('');
      setCreating(false);
      onOpenProject();
    }
  }
  return (
    <section
      aria-label={t('项目首页')}
      className="h-full overflow-y-auto bg-panel px-8 py-9 max-[760px]:px-5"
    >
      <div className="mx-auto max-w-[1040px]">
        <div className="flex items-end justify-between gap-5 border-b border-[var(--line)] pb-7">
          <div>
            <p className="mb-2 text-[11px] font-medium text-[var(--accent-ink)]">{t('项目')}</p>
            <h1 className="text-[29px] font-semibold tracking-[-0.045em] text-[var(--ink)]">
              {t('项目工作台')}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[8px] bg-[var(--accent)] px-3.5 text-[11px] font-semibold text-white transition-[transform,background-color] hover:-translate-y-px hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            <Plus size={15} />
            {t('新建项目')}
          </button>
        </div>
        {error ? (
          <AppAlert tone="error" title={translateFixed(error, locale)} className="mt-5" />
        ) : null}
        {creating ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            className="mt-6 flex max-w-[520px] items-center gap-2 rounded-[10px] border border-[var(--line-strong)] bg-[var(--panel)] p-2 focus-within:border-[var(--accent)]"
          >
            <FolderOpen size={17} className="ml-2 text-[var(--accent-ink)]" />
            <input
              autoFocus
              aria-label={t('新项目名称')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('输入项目名称')}
              className="min-w-0 flex-1 bg-transparent px-1 text-[12px] outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setName('');
              }}
              className="px-2 text-[11px] text-[var(--muted)]"
            >
              {t('取消')}
            </button>
            {session.status === 'authenticated' ? (
              <select
                aria-label={t('项目保存位置')}
                value={source}
                onChange={(event) => setSource(event.target.value as 'local' | 'server')}
                className="h-7 cursor-pointer rounded border border-[var(--line)] bg-[var(--panel)] px-2 text-[11px] outline-none focus:border-[var(--accent)]"
              >
                <option value="local">{t('本机')}</option>
                <option value="server">{t('服务端')}</option>
              </select>
            ) : null}
            <button
              type="submit"
              disabled={!name.trim() || busy}
              className="rounded-[7px] bg-[var(--accent)] px-3 py-1.5 text-[11px] text-white disabled:opacity-50"
            >
              {busy ? t('创建中') : t('创建')}
            </button>
          </form>
        ) : null}
        {status === 'loading' ? (
          <div
            role="status"
            className="mt-16 flex items-center justify-center gap-2 text-[12px] text-[var(--muted)]"
          >
            <SpinnerGap size={18} className="animate-spin" />
            {t('正在加载项目')}
          </div>
        ) : projects.length ? (
          <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  selectProject(project.id);
                  onOpenProject();
                }}
                className="group relative flex min-h-[148px] flex-col rounded-[12px] border border-[var(--line)] bg-[var(--panel)] p-5 text-left shadow-[0_2px_7px_rgba(20,31,53,.025)] transition-[border-color,transform,box-shadow] hover:-translate-y-1 hover:border-[var(--accent-soft-line)] hover:shadow-[0_16px_32px_rgba(20,31,53,.08)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
              >
                <span className="flex size-9 items-center justify-center rounded-[9px] bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                  <FolderOpen size={19} />
                </span>
                <span className="mt-4 truncate text-[14px] font-semibold text-[var(--ink)]">
                  {fixtureField(project, 'name', locale)}
                </span>
                <span className="mt-1 text-[10px] text-[var(--muted)]">
                  {project.id === selectedProject?.id ? t('当前项目') : t('打开项目')}
                </span>
                <ArrowUpRight
                  size={16}
                  className="absolute right-5 top-5 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-16 flex flex-col items-center text-center">
            <span className="flex size-12 items-center justify-center rounded-[13px] border border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted-strong)]">
              <FolderOpen size={23} />
            </span>
            <h2 className="mt-4 text-[14px] font-semibold text-[var(--ink)]">{t('还没有项目')}</h2>
          </div>
        )}
      </div>
    </section>
  );
}
