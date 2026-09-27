'use client';

import type { TeamspaceAccess } from './client';
import { defaultAccessOptions } from './view-model';
import { cn } from '@/lib/utils';

export function DefaultAccessField({ value, onChange, disabled = false }: { value: TeamspaceAccess; onChange: (value: TeamspaceAccess) => void; disabled?: boolean }) {
  return <fieldset disabled={disabled} className="mt-4 grid gap-2">
    <legend className="mb-2 text-[11px] font-medium text-[var(--muted-strong)]">根默认权限</legend>
    {defaultAccessOptions.map((option) => <label key={option.label} className={cn('flex cursor-pointer gap-2.5 rounded-lg border p-2.5', value === option.value ? 'border-[var(--accent-soft-line)] bg-[var(--accent-soft)]' : 'border-[var(--line)] hover:bg-[var(--surface-subtle)]')}>
      <input type="radio" name="root-default-access" checked={value === option.value} onChange={() => onChange(option.value)} className="accent-[var(--accent)]" />
      <span><span className="block text-[12px] font-medium">{option.label}</span><span className="mt-0.5 block text-[11px] text-[var(--muted-strong)]">{option.description.replaceAll('工作区', '知识库').replaceAll('团队空间', '文件夹')}</span></span>
    </label>)}
  </fieldset>;
}
