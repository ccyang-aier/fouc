"use client";

import { ArrowSquareOut, GearSix, GitBranch, GitFork } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";
import { openSettings } from "@/lib/settings-navigation";
import type { ChatContext } from "./chat-types";
import toolbar from "./chat-context-toolbar.module.css";
import styles from "./chat-local-settings.module.css";

const messages = {
  localEnvironment: ["配置本地环境", "Configure local environment"],
  newWorktree: ["新建工作树", "New worktree"],
  branch: ["分支", "Branch"],
  unboundRepository: ["未绑定仓库", "No repository"],
  repositoryNotBound: ["当前项目尚未绑定代码仓库", "This project has no linked repository"],
  selectProjectFirst: ["请先选择项目", "Select a project first"],
  environment: ["环境", "Environment"],
  noEnvironment: ["无环境", "No environment"],
  environmentUnavailable: ["当前对话尚未绑定执行环境", "This conversation has no execution environment"],
  manageLocalAgents: ["管理本机 Agent", "Manage local agents"],
  draftPreference: ["应用于当前对话草稿", "Applies to this conversation draft"],
} as const;

export function ChatLocalSettings({ context, onChange }: {
  context: ChatContext;
  onChange: (change: Partial<ChatContext>) => void;
}) {
  const { t } = useTranslation(messages);
  const createWorktree = context.localEnvironment?.createWorktree ?? false;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className={toolbar.settingsButton} aria-label={t("localEnvironment")}>
              <GearSix size={17} />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("localEnvironment")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="top" align="end" sideOffset={7} collisionPadding={12} className={styles.menu}>
        <DropdownMenuLabel className={styles.title}>{t("localEnvironment")}</DropdownMenuLabel>
        <DropdownMenuItem className={styles.row} role="menuitemcheckbox" aria-checked={createWorktree}
          onSelect={(event) => {
            event.preventDefault();
            onChange({ localEnvironment: { createWorktree: !createWorktree } });
          }}>
          <GitFork />
          <span className={styles.label}>{t("newWorktree")}</span>
          <span className={styles.switch} data-checked={createWorktree} aria-hidden="true"><i /></span>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={styles.row}>
            <GitBranch />
            <span className={styles.label}>{t("branch")}</span>
            <span className={styles.value}>{t("unboundRepository")}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={styles.submenu} collisionPadding={12}>
            <p className={styles.empty} role="status">{t(context.projectId ? "repositoryNotBound" : "selectProjectFirst")}</p>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={styles.row}>
            <GearSix />
            <span className={styles.label}>{t("environment")}</span>
            <span className={styles.value}>{t("noEnvironment")}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={styles.submenu} collisionPadding={12}>
            <p className={styles.empty} role="status">{t("environmentUnavailable")}</p>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openSettings("agents")}>
              <span className={styles.label}>{t("manageLocalAgents")}</span><ArrowSquareOut />
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator className={styles.separator} />
        <p className={styles.draftHint}>{t("draftPreference")}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
