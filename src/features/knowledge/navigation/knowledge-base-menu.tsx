'use client';

import { DotsThree, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Teamspace } from '../organization/client';

export function KnowledgeBaseMenu({ teamspace, onCreatePage, onAction }: {
  teamspace: Teamspace;
  onCreatePage: () => void;
  onAction: (action: 'rename' | 'delete') => void;
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button type="button" aria-label={`知识库「${teamspace.name}」操作`} onClick={(event) => event.stopPropagation()} className="ml-1 flex size-5 items-center justify-center rounded text-[var(--muted)] opacity-0 hover:bg-[var(--surface-hover)] group-hover/row:opacity-100 focus-visible:opacity-100"><DotsThree size={14} /></button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={onCreatePage}><Plus />新建文档</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onAction('rename')}><PencilSimple />重命名知识库</DropdownMenuItem>
      <DropdownMenuItem className="text-[var(--err-ink)]" onSelect={() => onAction('delete')}><Trash />删除知识库</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
