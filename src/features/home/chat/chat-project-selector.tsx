"use client";

import { useRef, useState } from "react";
import { Check, FolderSimple, Plus, X } from "@phosphor-icons/react";
import { useAppAlert } from "@/components/app-alert-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectResources } from "@/features/project/project-resources";
import type { ChatContext } from "./chat-types";
import type { ChatText } from "./chat-messages";
import styles from "./chat-context-toolbar.module.css";
import { ChatPickerContent, ChatPickerItem, ChatPickerSearch } from "./chat-picker";
import picker from "./chat-picker.module.css";

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
      <ChatPickerContent onEscapeKeyDown={(event) => {
        if (!creating) return;
        event.preventDefault();
        setCreating(false);
        setQuery("");
      }}>
        <div className={picker.header}>
          <ChatPickerSearch ref={search} value={query} disabled={saving}
            icon={creating ? <Plus size={14} aria-hidden="true" /> : undefined}
            aria-label={t(creating ? "newProjectName" : "searchProjects")}
            placeholder={t(creating ? "newProjectName" : "searchProjects")}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (creating && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void saveProject(); }
            }} />
        </div>
        {creating ? (
          <Button type="button" variant="ghost" className={`${picker.item} ${styles.createButton}`} loading={saving}
            disabled={!query.trim()} onClick={() => void saveProject()}>
            <Check size={15} />{t("createProject")}
          </Button>
        ) : <>
          <ScrollArea className={picker.list} style={{ height: filtered.length ? Math.min(filtered.length * 28, 140) : 40 }}>
            {filtered.map((project) => (
              <ChatPickerItem key={`${project.source}:${project.id}`} data-selected={context.projectId === project.id}
                role="menuitemradio" aria-checked={context.projectId === project.id}
                onSelect={() => onChange({ projectId: project.id, projectName: project.name })}>
                <FolderSimple />
                <span className={picker.name}>{project.name}</span>
                {context.projectId === project.id ? <Check className={picker.check} /> : null}
              </ChatPickerItem>
            ))}
            {!filtered.length ? <p className={picker.empty} role="status">{t(query ? "noProjectResults" : "emptyProjects")}</p> : null}
          </ScrollArea>
          <DropdownMenuSeparator className={picker.separator} />
          <ChatPickerItem onSelect={(event) => {
            event.preventDefault();
            setCreating(true);
            requestAnimationFrame(() => search.current?.focus());
          }}>
            <Plus />{t("newProject")}
          </ChatPickerItem>
          <ChatPickerItem role="menuitemradio" aria-checked={!context.projectId}
            data-selected={!context.projectId} onSelect={() => onChange({ projectId: null, projectName: null })}>
            <X />{t("noProject")}
          </ChatPickerItem>
        </>}
      </ChatPickerContent>
    </DropdownMenu>
  );
}
