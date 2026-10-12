"use client";

import { BookOpen, Check, GearSix, Plus, SidebarSimple } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
export type KnowledgeBaseSummary = { id: string; name: string; source?: 'local' | 'server' };
import { IconButton } from "./dense-sidebar/icon-button";
import styles from "./navigation/knowledge-sidebar.module.css";

export function KnowledgeBaseHeader({
  knowledgeBases,
  activeKnowledgeBaseId,
  onSelectKnowledgeBase,
  onCollapse,
  onCreateKnowledgeBase,
  onOpenSettings,
  createLabel = "新建知识库",
}: {
  knowledgeBases: readonly KnowledgeBaseSummary[];
  activeKnowledgeBaseId: string | null;
  onSelectKnowledgeBase: (id: string) => void;
  onCollapse: () => void;
  onCreateKnowledgeBase: () => void;
  onOpenSettings: () => void;
  createLabel?: string;
}) {
  const activeKnowledgeBase = knowledgeBases.find((base) => base.id === activeKnowledgeBaseId);
  const knowledgeBaseName = activeKnowledgeBase?.name ?? (knowledgeBases.length ? "选择知识库" : "暂无知识库");

  return <div className={styles.knowledgeHeader}>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={styles.knowledgeButton} aria-label={`知识库菜单：${knowledgeBaseName}`}>
          {activeKnowledgeBase ? <span aria-hidden="true" className={styles.knowledgeAvatar} data-tone={knowledgeBases.findIndex((base) => base.id === activeKnowledgeBaseId) % 6}>{Array.from(knowledgeBaseName.trim())[0]?.toUpperCase() ?? "K"}</span> : <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-subtle)] text-[var(--muted)]"><BookOpen aria-hidden="true" size={20} /></span>}
          <span className={styles.knowledgeName}>{knowledgeBaseName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={5} className={styles.knowledgeMenu}>
        {knowledgeBases.map((base, index) => (
          <DropdownMenuItem key={base.id} className={styles.knowledgeMenuBase} data-active={base.id === activeKnowledgeBaseId} onSelect={() => onSelectKnowledgeBase(base.id)}>
            <span aria-hidden="true" className={styles.knowledgeMenuAvatar} data-tone={index % 6}>{Array.from(base.name.trim())[0]?.toUpperCase() ?? "K"}</span>
            <span className={styles.knowledgeMenuBaseName}>{base.name}</span>{base.source ? <span className="shrink-0 whitespace-nowrap text-[10px] text-[var(--muted)]">{base.source === 'local' ? '本机' : '服务端'}</span> : null}
            {base.id === activeKnowledgeBaseId && <Check className={styles.knowledgeMenuCheck} aria-label="当前知识库" weight="bold" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem className={styles.knowledgeMenuItem} onSelect={onCreateKnowledgeBase}>
          <Plus aria-hidden="true" weight="bold" />{createLabel}
        </DropdownMenuItem>
        <DropdownMenuSeparator className={styles.knowledgeMenuSeparator} />
        <DropdownMenuItem className={styles.knowledgeMenuItem} disabled={!activeKnowledgeBase} onSelect={onOpenSettings}>
          <GearSix aria-hidden="true" weight="fill" />设置
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <IconButton className={styles.knowledgeCollapse} label="收起知识库侧边栏" tooltip="收起侧栏" onClick={onCollapse}>
      <SidebarSimple aria-hidden="true" weight="regular" />
    </IconButton>
  </div>;
}
