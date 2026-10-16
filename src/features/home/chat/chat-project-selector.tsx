"use client";

import { useRef, useState } from "react";
import { Check, FolderSimple, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { useAppAlert } from "@/components/app-alert-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectResources } from "@/features/project/project-resources";
import type { ChatContext } from "./chat-types";
import type { ChatText } from "./chat-messages";
import styles from "./chat-context-toolbar.module.css";

export function ChatProjectSelector({ context, onChange, t }: {
  context: ChatContext;
  onChange: (change: Partial<ChatContext>) => void;
  t: ChatText;
}) {
  const { projects, createProject } = useProjectResources();
  const { notify } = useAppAlert();
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const filtered = projects.filter((project) => project.name.toLowerCase().includes(query.trim().toLowerCase()));

  async function saveProject() {
    if (!query.trim() || saving) return;
    setSaving(true);
    const project = await createProject(query);
    setSaving(false);
    if (!project) { notify("error", t("projectCreateFailed")); return; }
    onChange({ projectId: project.id, projectName: project.name });
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) { setQuery(""); setCreating(false); }
    }}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" className={styles.resourceButton} aria-label={t("projectContext")}
          data-selected={Boolean(context.projectId)}>
          <FolderSimple size={16} />
          <span>{context.projectName ?? t("project")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" sideOffset={6} collisionPadding={12} className={styles.projectMenu}>
        <label className={styles.search}>
          {creating ? <Plus size={21} aria-hidden="true" /> : <MagnifyingGlass size={21} aria-hidden="true" />}
          <input ref={search} autoFocus value={query} disabled={saving}
            aria-label={t(creating ? "newProjectName" : "searchProjects")}
            placeholder={t(creating ? "newProjectName" : "searchProjects")}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                if (creating) { event.preventDefault(); event.stopPropagation(); setCreating(false); setQuery(""); }
                return;
              }
              event.stopPropagation();
              if (creating && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void saveProject(); }
              if (!creating && event.key === "ArrowDown") {
                event.preventDefault();
                event.currentTarget.closest('[role="menu"]')?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus();
              }
            }} />
        </label>
        {creating ? (
          <Button type="button" variant="ghost" className={styles.createButton} loading={saving}
            disabled={!query.trim()} onClick={() => void saveProject()}>
            <Check size={20} />{t("createProject")}
          </Button>
        ) : <>
          <ScrollArea className={styles.projectList} style={{ height: Math.min(Math.max(filtered.length * 43, 62), 215) }}>
            {filtered.map((project) => (
              <DropdownMenuItem key={`${project.source}:${project.id}`} className={styles.projectItem}
                role="menuitemradio" aria-checked={context.projectId === project.id}
                onSelect={() => onChange({ projectId: project.id, projectName: project.name })}>
                <FolderSimple />
                <span>{project.name}</span>
                {context.projectId === project.id ? <Check /> : null}
              </DropdownMenuItem>
            ))}
            {!filtered.length ? <p className={styles.empty} role="status">{t(query ? "noProjectResults" : "emptyProjects")}</p> : null}
          </ScrollArea>
          <DropdownMenuSeparator className={styles.projectSeparator} />
          <DropdownMenuItem className={styles.projectItem} onSelect={(event) => {
            event.preventDefault();
            setCreating(true);
            requestAnimationFrame(() => search.current?.focus());
          }}>
            <Plus />{t("newProject")}
          </DropdownMenuItem>
          <DropdownMenuItem className={styles.projectItem} role="menuitemradio" aria-checked={!context.projectId}
            data-selected={!context.projectId} onSelect={() => onChange({ projectId: null, projectName: null })}>
            <X />{t("noProject")}
          </DropdownMenuItem>
        </>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
