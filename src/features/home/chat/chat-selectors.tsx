"use client";

import {
  BookOpen,
  CaretDown,
  FolderSimple,
  ShieldCheck,
  SlidersHorizontal,
  Sparkle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjectResources } from "@/features/project/project-resources";
import type { ChatContext, ChatMode, ChatPermission } from "./chat-types";
import type { ChatText } from "./chat-messages";
import styles from "./chat.module.css";

const agents = ["Nova", "Codey", "Sage"];
const modes: ChatMode[] = ["Auto", "Fast", "Deep"];
const permissions: ChatPermission[] = [
  "defaultPermission",
  "readPermission",
  "writePermission",
];
const modeDescription = { Auto: "auto", Fast: "fast", Deep: "deep" } as const;

export function ChatAgentSelector({
  context,
  onChange,
  t,
}: {
  context: ChatContext;
  onChange: (change: Partial<ChatContext>) => void;
  t: ChatText;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={styles.agentButton}
          aria-label={t("agents")}
        >
          <Sparkle size={15} weight="fill" className={styles.agentMark} />
          <span>{context.agent}</span>
          <CaretDown size={12} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={styles.menu}>
        <DropdownMenuLabel>{t("agents")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={context.agent}
          onValueChange={(agent) => onChange({ agent })}
        >
          {agents.map((agent) => (
            <DropdownMenuRadioItem value={agent} key={agent}>
              {agent}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ChatContextSelectors({
  context,
  onChange,
  t,
}: {
  context: ChatContext;
  onChange: (change: Partial<ChatContext>) => void;
  t: ChatText;
}) {
  const { projects } = useProjectResources();
  return (
    <div className={styles.contextControls}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={styles.contextButton}
            aria-label={t("projectContext")}
            data-active={Boolean(context.projectId)}
          >
            <FolderSimple size={15} />
            <span>{context.projectName ?? t("project")}</span>
            <CaretDown size={11} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={styles.menu}>
          <DropdownMenuLabel>{t("projectContext")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={context.projectId ?? ""}
            onValueChange={(id) => {
              const project = projects.find((item) => item.id === id);
              onChange({
                projectId: project?.id ?? null,
                projectName: project?.name ?? null,
              });
            }}
          >
            <DropdownMenuRadioItem value="">
              {t("noProject")}
            </DropdownMenuRadioItem>
            {projects.map((project) => (
              <DropdownMenuRadioItem
                value={project.id}
                key={`${project.source}:${project.id}`}
              >
                <span className={styles.menuEllipsis}>{project.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {projects.length === 0 ? (
            <DropdownMenuLabel>{t("emptyProjects")}</DropdownMenuLabel>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={styles.contextButton}
            aria-label={t("knowledgeContext")}
            data-active={context.knowledgeIncluded}
          >
            <BookOpen size={15} />
            <span>{t("knowledge")}</span>
            <CaretDown size={11} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={styles.menu}>
          <DropdownMenuLabel>{t("knowledgeContext")}</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={context.knowledgeIncluded}
            onCheckedChange={(knowledgeIncluded) =>
              onChange({ knowledgeIncluded })
            }
          >
            {t("teamKnowledge")}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={styles.contextButton}
            aria-label={t("mode")}
          >
            <SlidersHorizontal size={15} />
            <span>{context.mode}</span>
            <CaretDown size={11} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={styles.menu}>
          <DropdownMenuLabel>{t("mode")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={context.mode}
            onValueChange={(mode) => onChange({ mode: mode as ChatMode })}
          >
            {modes.map((mode) => (
              <DropdownMenuRadioItem value={mode} key={mode}>
                <span>
                  {mode}
                  <span className={styles.menuDescription}>
                    {t(modeDescription[mode])}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={`${styles.contextButton} ${styles.permissionButton}`}
            aria-label={t("permission")}
          >
            <ShieldCheck size={15} />
            <span>{t(context.permission)}</span>
            <CaretDown size={11} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.menu}>
          <DropdownMenuLabel>{t("permission")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={context.permission}
            onValueChange={(permission) =>
              onChange({ permission: permission as ChatPermission })
            }
          >
            {permissions.map((permission) => (
              <DropdownMenuRadioItem value={permission} key={permission}>
                {t(permission)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
