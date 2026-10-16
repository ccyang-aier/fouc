"use client";

import { useState } from "react";
import { BookOpen, Check, FolderSimple, GearSix, MagnifyingGlass, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProjectResources } from "@/features/project/project-resources";
import { openSettings } from "@/lib/settings-navigation";
import type { ChatContext } from "./chat-types";
import type { ChatText } from "./chat-messages";
import styles from "./chat-context-toolbar.module.css";

export function ChatContextSelectors({ context, onChange, t }: {
  context: ChatContext;
  onChange: (change: Partial<ChatContext>) => void;
  t: ChatText;
}) {
  const { projects } = useProjectResources();
  const [query, setQuery] = useState("");
  const filtered = projects.filter((project) => project.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className={styles.toolbar}>
      <div className={styles.resources}>
        <DropdownMenu onOpenChange={(open) => { if (open) setQuery(""); }}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className={styles.resourceButton} aria-label={t("projectContext")}
              data-selected={Boolean(context.projectId)}>
              <FolderSimple size={16} />
              <span>{context.projectName ?? t("project")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={styles.projectMenu}>
            <label className={styles.search}>
              <MagnifyingGlass size={16} aria-hidden="true" />
              <input autoFocus value={query} aria-label={t("searchProjects")} placeholder={t("searchProjects")}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") return;
                  event.stopPropagation();
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    event.currentTarget.closest('[role="menu"]')?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus();
                  }
                }} />
            </label>
            <ScrollArea className={styles.projectList} style={{ height: Math.min(Math.max(filtered.length * 34, 54), 204) }}>
              {filtered.map((project) => (
                <DropdownMenuItem key={`${project.source}:${project.id}`} className={styles.projectItem}
                  role="menuitemradio" aria-checked={context.projectId === project.id}
                  onSelect={() => onChange({ projectId: project.id, projectName: project.name })}>
                  <FolderSimple />
                  <span>{project.name}</span>
                  {context.projectId === project.id ? <Check size={15} /> : null}
                </DropdownMenuItem>
              ))}
              {!filtered.length ? <p className={styles.empty} role="status">{t(query ? "noProjectResults" : "emptyProjects")}</p> : null}
            </ScrollArea>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={styles.projectItem} role="menuitemradio" aria-checked={!context.projectId} onSelect={() => onChange({ projectId: null, projectName: null })}>
              <X />{t("noProject")}
              {!context.projectId ? <Check size={15} /> : null}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className={styles.resourceButton} aria-label={t("knowledgeContext")}
              data-selected={context.knowledgeIncluded}>
              <BookOpen size={16} />
              <span>{t("knowledge")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={styles.knowledgeMenu}>
            <DropdownMenuLabel>{t("knowledgeContext")}</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={context.knowledgeIncluded} onCheckedChange={(knowledgeIncluded) => onChange({ knowledgeIncluded })}>
              {t("teamKnowledge")}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" className={styles.settingsButton} aria-label={t("chatSettings")} onClick={() => openSettings("agents")}>
            <GearSix size={17} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("chatSettings")}</TooltipContent>
      </Tooltip>
    </div>
  );
}
