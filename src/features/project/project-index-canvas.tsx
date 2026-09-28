'use client';

import { useState } from 'react';
import { ArrowUpRight, FolderOpen, Plus, SpinnerGap, WarningCircle } from '@phosphor-icons/react';
import { useWorkspace } from '@/features/workspaces/workspace-provider';
import { useProjectResources } from './project-resources';

export function ProjectIndexCanvas({ onOpenProject }: { onOpenProject: () => void }) {
  const { activeSpace } = useWorkspace();
  const { projects, status, error, selectedProject, selectProject, createProject } = useProjectResources();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const created = await createProject(name);
    setBusy(false);
    if (created) { setName(''); setCreating(false); onOpenProject(); }
  }
  return <section aria-label="项目首页" className="h-full overflow-y-auto bg-panel px-8 py-9 max-[760px]:px-5">
    <div className="mx-auto max-w-[1040px]">
      <div className="flex items-end justify-between gap-5 border-b border-[var(--line)] pb-7">
        <div><p className="mb-2 text-[11px] font-medium text-[var(--accent-ink)]">{activeSpace.label} / 项目</p><h1 className="text-[29px] font-semibold tracking-[-0.045em] text-[var(--ink)]">项目工作台</h1><p className="mt-2 text-[12px] text-[var(--muted-strong)]">当前工作空间中的项目与工作对象。</p></div>
        <button type="button" onClick={() => setCreating(true)} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[8px] bg-[var(--accent)] px-3.5 text-[11px] font-semibold text-white transition-[transform,background-color] hover:-translate-y-px hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"><Plus size={15} />新建项目</button>
      </div>
      {error ? <div role="alert" className="mt-5 flex items-center gap-2 rounded-[9px] border border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-3 text-[11px] text-[var(--err-ink)]"><WarningCircle size={16} />{error}</div> : null}
      {creating ? <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="mt-6 flex max-w-[520px] items-center gap-2 rounded-[10px] border border-[var(--line-strong)] bg-[var(--panel)] p-2 shadow-[0_12px_28px_rgba(22,31,55,.06)]"><FolderOpen size={17} className="ml-2 text-[var(--accent-ink)]" /><input autoFocus aria-label="新项目名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="输入项目名称" className="min-w-0 flex-1 bg-transparent px-1 text-[12px] outline-none" /><button type="button" onClick={() => { setCreating(false); setName(''); }} className="px-2 text-[11px] text-[var(--muted)]">取消</button><button type="submit" disabled={!name.trim() || busy} className="rounded-[7px] bg-[var(--accent)] px-3 py-1.5 text-[11px] text-white disabled:opacity-50">{busy ? '创建中' : '创建'}</button></form> : null}
      {status === 'loading' ? <div role="status" className="mt-16 flex items-center justify-center gap-2 text-[12px] text-[var(--muted)]"><SpinnerGap size={18} className="animate-spin" />正在加载项目</div> : projects.length ? <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">{projects.map((project) => <button key={project.id} type="button" onClick={() => { selectProject(project.id); onOpenProject(); }} className="group relative flex min-h-[148px] flex-col rounded-[12px] border border-[var(--line)] bg-[var(--panel)] p-5 text-left shadow-[0_2px_7px_rgba(20,31,53,.025)] transition-[border-color,transform,box-shadow] hover:-translate-y-1 hover:border-[var(--accent-soft-line)] hover:shadow-[0_16px_32px_rgba(20,31,53,.08)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"><span className="flex size-9 items-center justify-center rounded-[9px] bg-[var(--accent-soft)] text-[var(--accent-ink)]"><FolderOpen size={19} /></span><span className="mt-4 truncate text-[14px] font-semibold text-[var(--ink)]">{project.name}</span><span className="mt-1 text-[10px] text-[var(--muted)]">{project.id === selectedProject?.id ? '当前项目' : '打开项目'}</span><ArrowUpRight size={16} className="absolute right-5 top-5 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></button>)}</div> : <div className="mt-16 flex flex-col items-center text-center"><span className="flex size-12 items-center justify-center rounded-[13px] border border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted-strong)]"><FolderOpen size={23} /></span><h2 className="mt-4 text-[14px] font-semibold text-[var(--ink)]">这个工作空间还没有项目</h2><p className="mt-1 text-[11px] text-[var(--muted)]">创建项目后，它只会出现在「{activeSpace.label}」中。</p></div>}
    </div>
  </section>;
}
