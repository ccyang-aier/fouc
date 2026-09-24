"use client";

import { GearSix, Plus, SidebarSimple, SignOut } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import styles from "./knowledge-canvas.module.css";

export function KnowledgeWorkspaceHeader({
  workspaceName,
  onCollapse,
  onCreateWorkspace,
  onOpenSettings,
}: {
  workspaceName: string;
  onCollapse: () => void;
  onCreateWorkspace: () => void;
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
        <DropdownMenuLabel className={styles.workspaceMenuTitle}>{workspaceName}</DropdownMenuLabel>
        <DropdownMenuItem className={styles.workspaceMenuItem} onSelect={onCreateWorkspace}>
          <Plus aria-hidden="true" weight="bold" />新建工作区...
        </DropdownMenuItem>
        <DropdownMenuSeparator className={styles.workspaceMenuSeparator} />
        <DropdownMenuItem className={styles.workspaceMenuItem} onSelect={onOpenSettings}>
          <GearSix aria-hidden="true" weight="fill" />设置
        </DropdownMenuItem>
        <DropdownMenuItem className={styles.workspaceMenuItem} disabled title="尚未接入账户服务">
          <SignOut aria-hidden="true" weight="fill" />退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <button type="button" className={styles.workspaceCollapse} aria-label="收起知识库侧边栏" title="收起知识库侧边栏" onClick={onCollapse}>
      <SidebarSimple aria-hidden="true" weight="regular" />
    </button>
  </div>;
}
