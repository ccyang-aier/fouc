"use client";

import { Check, GearSix, Plus, SidebarSimple } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import styles from "./knowledge-canvas.module.css";

export function KnowledgeWorkspaceHeader({
  workspaceName,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCollapse,
  onCreateKnowledgeBase,
  onOpenSettings,
}: {
  workspaceName: string;
  workspaces: readonly { id: string; label: string }[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onCollapse: () => void;
  onCreateKnowledgeBase: () => void;
  onOpenSettings: () => void;
}) {
  return <div className={styles.workspaceHeader}>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={styles.workspaceButton} aria-label={`工作区菜单：${workspaceName}`} title={workspaceName}>
          <span className={styles.workspaceAvatar} aria-hidden="true">{workspaceName.trim().slice(0, 1) || "工"}</span>
          <span className={styles.workspaceName}>{workspaceName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={5} className={styles.workspaceMenu}>
        {workspaces.map((workspace) => (
          <DropdownMenuItem key={workspace.id} className={styles.workspaceMenuWorkspace} data-active={workspace.id === activeWorkspaceId} onSelect={() => onSelectWorkspace(workspace.id)}>
            <span className={styles.workspaceMenuAvatar} aria-hidden="true">{workspace.label.trim().slice(0, 1) || "工"}</span>
            <span className={styles.workspaceMenuWorkspaceName}>{workspace.label}</span>
            {workspace.id === activeWorkspaceId && <Check className={styles.workspaceMenuCheck} aria-label="当前工作区" weight="bold" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem className={styles.workspaceMenuItem} onSelect={onCreateKnowledgeBase}>
          <Plus aria-hidden="true" weight="bold" />新建知识库
        </DropdownMenuItem>
        <DropdownMenuSeparator className={styles.workspaceMenuSeparator} />
        <DropdownMenuItem className={styles.workspaceMenuItem} onSelect={onOpenSettings}>
          <GearSix aria-hidden="true" weight="fill" />设置
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <button type="button" className={styles.workspaceCollapse} aria-label="收起知识库侧边栏" title="收起知识库侧边栏" onClick={onCollapse}>
      <SidebarSimple aria-hidden="true" weight="regular" />
    </button>
  </div>;
}
