"use client";

import { Check, GearSix, Plus, SidebarSimple } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectIcon } from "./dense-sidebar/project-icon";
import type { ProjectSummary } from "./knowledge-model";
import styles from "./knowledge-canvas.module.css";

export function KnowledgeBaseHeader({
  knowledgeBases,
  activeKnowledgeBaseId,
  onSelectKnowledgeBase,
  onCollapse,
  onCreateKnowledgeBase,
  onOpenSettings,
}: {
  knowledgeBases: readonly Pick<ProjectSummary, "id" | "name" | "iconId">[];
  activeKnowledgeBaseId: string | null;
  onSelectKnowledgeBase: (id: string) => void;
  onCollapse: () => void;
  onCreateKnowledgeBase: () => void;
  onOpenSettings: () => void;
}) {
  const activeKnowledgeBase = knowledgeBases.find((base) => base.id === activeKnowledgeBaseId);
  const knowledgeBaseName = activeKnowledgeBase?.name ?? "知识库";

  return <div className={styles.knowledgeHeader}>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={styles.knowledgeButton} aria-label={`知识库菜单：${knowledgeBaseName}`} title={knowledgeBaseName}>
          <ProjectIcon iconId={activeKnowledgeBase?.iconId} className={styles.knowledgeAvatar} />
          <span className={styles.knowledgeName}>{knowledgeBaseName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={5} className={styles.knowledgeMenu}>
        {knowledgeBases.map((base) => (
          <DropdownMenuItem key={base.id} className={styles.knowledgeMenuBase} data-active={base.id === activeKnowledgeBaseId} onSelect={() => onSelectKnowledgeBase(base.id)}>
            <ProjectIcon iconId={base.iconId} className={styles.knowledgeMenuAvatar} />
            <span className={styles.knowledgeMenuBaseName}>{base.name}</span>
            {base.id === activeKnowledgeBaseId && <Check className={styles.knowledgeMenuCheck} aria-label="当前知识库" weight="bold" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem className={styles.knowledgeMenuItem} onSelect={onCreateKnowledgeBase}>
          <Plus aria-hidden="true" weight="bold" />新建知识库
        </DropdownMenuItem>
        <DropdownMenuSeparator className={styles.knowledgeMenuSeparator} />
        <DropdownMenuItem className={styles.knowledgeMenuItem} onSelect={onOpenSettings}>
          <GearSix aria-hidden="true" weight="fill" />设置
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <button type="button" className={styles.knowledgeCollapse} aria-label="收起知识库侧边栏" title="收起知识库侧边栏" onClick={onCollapse}>
      <SidebarSimple aria-hidden="true" weight="regular" />
    </button>
  </div>;
}
