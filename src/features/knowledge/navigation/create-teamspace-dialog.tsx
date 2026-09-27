'use client';

/**
 * Create-teamspace dialog of the knowledge sidebar (U02): the onboarding exit
 * of the empty tree state, composed from the O02 dialog primitives and the O03
 * mutation so the knowledge shell and the organization panel stay one
 * implementation apart from styling.
 */

import { useState } from 'react';
import { useCreateTeamspaceMutation } from '../organization/hooks';
import { organizationErrorTextOf } from '../organization/errors';
import { DialogButton, ModalDialog, NameField } from '../organization/ui';
import { defaultAccessOptions, defaultAccessDescription } from '../organization/view-model';
import type { Teamspace } from '../organization/client';
import { cn } from '@/lib/utils';

export function CreateTeamspaceDialog({ workspaceId, open, onClose, onCreated }: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (teamspace: Teamspace) => void;
}) {
  const [name, setName] = useState('');
  const [access, setAccess] = useState<number>(3); // 新知识库默认可编辑，可以直接创建文档。
  const [touched, setTouched] = useState(false);
  const mutation = useCreateTeamspaceMutation(workspaceId);

  const trimmed = name.trim();
  const invalidReason = touched && trimmed.length === 0 ? '名称不能为空' : undefined;
  const selected = defaultAccessOptions[access];

  function close() {
    mutation.reset();
    setName('');
    setAccess(3);
    setTouched(false);
    onClose();
  }

  function submit() {
    setTouched(true);
    if (trimmed.length === 0) return;
    mutation.mutate(
      { name: trimmed, defaultAccess: selected.value },
      {
        onSuccess: (teamspace) => {
          onCreated(teamspace);
          close();
        },
      },
    );
  }

  return (
    <ModalDialog
      open={open}
      onClose={close}
      title="新建知识库"
      description="知识库用于组织文档，根页面的默认权限在这里设定。"
      footer={
        <>
          <DialogButton onClick={close}>取消</DialogButton>
          <DialogButton variant="primary" disabled={mutation.isPending || trimmed.length === 0} onClick={submit} autoFocus>
            {mutation.isPending ? '创建中…' : '创建'}
          </DialogButton>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <NameField
          label="名称"
          value={name}
          onChange={setName}
          onSubmit={submit}
          placeholder="例如：产品文档"
          invalidReason={invalidReason}
          autoFocus
        />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-[11px] font-medium text-[var(--muted-strong)]">根默认权限</legend>
          <div className="grid gap-1">
            {defaultAccessOptions.map((option, index) => (
              <label
                key={option.label}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-[7px] border px-2.5 py-2 transition-colors',
                  index === access
                    ? 'border-[var(--accent-soft-line)] bg-[var(--accent-soft)]'
                    : 'border-[var(--line)] bg-[var(--panel)] hover:border-[var(--line-strong)]',
                )}
              >
                <input
                  type="radio"
                  name="teamspace-default-access"
                  value={option.label}
                  checked={index === access}
                  onChange={() => setAccess(index)}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className={cn('block text-[12px] font-medium', index === access ? 'text-[var(--accent-ink)]' : 'text-[var(--ink)]')}>{option.label}</span>
                  <span className="mt-0.5 block text-[10.5px] leading-relaxed text-[var(--muted-strong)]">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">{defaultAccessDescription(selected.value)}</p>
        </fieldset>
        {mutation.isError ? (
          <p role="alert" className="text-[11px] leading-relaxed text-[var(--err-ink)]">
            {organizationErrorTextOf(mutation.error)}
          </p>
        ) : null}
      </div>
    </ModalDialog>
  );
}
