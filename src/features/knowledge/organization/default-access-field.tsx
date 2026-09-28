'use client';

import type { TeamspaceAccess } from '../data/knowledge-catalog-client';
import { defaultAccessOptions } from './view-model';
import { PermissionSelect } from './permission-select';

const options = defaultAccessOptions.map((option) => ({ ...option, value: option.value ?? 'explicit', description: option.description.replaceAll('工作区', '知识库').replaceAll('团队空间', '文件夹') }));

export function DefaultAccessField({ value, onChange, disabled = false }: { value: TeamspaceAccess; onChange: (value: TeamspaceAccess) => void; disabled?: boolean }) {
  return <div className="mt-4"><PermissionSelect label="根默认权限" value={value ?? 'explicit'} options={options} disabled={disabled} onChange={(next) => onChange(defaultAccessOptions.find((option) => (option.value ?? 'explicit') === next)!.value)} /></div>;
}
