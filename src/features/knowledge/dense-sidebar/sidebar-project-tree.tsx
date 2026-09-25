"use client";

import {
  CaretDown,
  CaretRight,
  DotsThree,
  FilePlus,
  FolderPlus,
  PencilSimple,
  Star,
  Tag,
  Trash,
} from "@phosphor-icons/react";

import {
  ProjectGlyph,
  SidebarCreateIcon,
  SidebarDocumentActions,
  sidebarDocumentIconClass,
  sidebarIconMap,
} from "@/features/knowledge/dense-sidebar/sidebar-navigation-primitives";
import type { DocumentAction } from "@/features/knowledge/dense-sidebar/document-action-menu-content";
import type { SidebarProjectNode } from "@/features/knowledge/dense-sidebar/sidebar-navigation";
import { useI18n } from "@/features/knowledge/dense-sidebar/use-i18n";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import styles from "./sidebar-interactions.module.css";

export type SidebarProjectAction =
  | "new-document"
  | "new-subfolder"
  | "rename"
  | "add-tag"
  | "toggle-star"
  | "delete";

export function SidebarProjectTreeNode({
  node,
  depth,
  expanded,
  selectedProjectId,
  activeDocumentId,
  activeDocumentLocation,
  onToggle,
  onSelectProject,
  onSelectDocument,
  onProjectAction,
  onDocumentAction,
}: {
  node: SidebarProjectNode;
  depth: number;
  expanded: Record<string, boolean>;
  selectedProjectId: string | null;
  activeDocumentId: string | null;
  activeDocumentLocation: "project" | "recent" | null;
  onToggle: (id: string) => void;
  onSelectProject: (id: string) => void;
  onSelectDocument: (id: string) => void;
  onProjectAction: (id: string, action: SidebarProjectAction) => void;
  onDocumentAction: (id: string, action: DocumentAction) => void;
}) {
  const { t } = useI18n();
  const isDocument = node.kind === "document";
  const isExpanded = expanded[node.id] ?? Boolean(node.defaultExpanded);
  const selected = isDocument
    ? activeDocumentLocation === "project" && activeDocumentId === node.id
    : selectedProjectId === `project:${node.id}`;
  const Icon = node.icon ? sidebarIconMap[node.icon] : sidebarIconMap.file;
  const label = node.label ?? (node.labelKey ? t(node.labelKey) : "");

  return (
    <div role="treeitem" aria-expanded={!isDocument && node.expandable ? isExpanded : undefined} aria-selected={selected}>
      <div
        data-selected={selected ? "true" : undefined}
        className={cn(
          styles.row,
          "group flex h-[29px] w-full items-center rounded-[6px] pr-1 text-[12px] leading-none text-[var(--sidebar-text)]",
          selected && "font-medium text-foreground",
        )}
        style={{ paddingLeft: isDocument ? 18 + depth * 12 : 5 + depth * 14 }}
      >
        {!isDocument && node.expandable ? (
          <button
            type="button"
            aria-label={t(isExpanded ? "sidebar.collapseSection" : "sidebar.expandSection", { section: label })}
            aria-expanded={isExpanded}
            onClick={() => onToggle(node.id)}
            className="mr-0.5 inline-flex size-[17px] shrink-0 items-center justify-center rounded-[4px] outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            {isExpanded ? <CaretDown aria-hidden="true" size={10} weight="bold" /> : <CaretRight aria-hidden="true" size={10} weight="bold" />}
          </button>
        ) : !isDocument ? (
          <span className="mr-0.5 size-[17px] shrink-0" />
        ) : null}
        <button
          type="button"
          aria-current={selected ? "page" : undefined}
          onClick={() => (isDocument ? onSelectDocument(node.id) : onSelectProject(node.id))}
          className="flex h-full min-w-0 flex-1 items-center text-left outline-none"
        >
          {isDocument ? (
            <Icon aria-hidden="true" size={13} weight="fill" className={sidebarDocumentIconClass} />
          ) : (
            <ProjectGlyph iconId={node.projectIconId} />
          )}
          <span className="my-auto inline-flex h-4 min-w-0 items-center truncate leading-4">{label}</span>
        </button>
        {isDocument ? (
          <SidebarDocumentActions documentId={node.id} starred={Boolean(node.starred)} onAction={onDocumentAction} />
        ) : (
          <div className={cn(styles.actions, "ml-auto flex shrink-0 items-center gap-0.5")}>
            <button
              type="button"
              aria-label={t("sidebar.newDocument")}
              className={styles.actionButton}
              onClick={() => onProjectAction(node.id, "new-document")}
            >
              <SidebarCreateIcon />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("sidebar.projectMenu", { project: label })}
                  className={styles.actionButton}
                  onClick={(event) => event.stopPropagation()}
                >
                  <DotsThree aria-hidden="true" size={16} weight="bold" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[190px]">
                <DropdownMenuItem onSelect={() => onProjectAction(node.id, "rename")}>
                  <PencilSimple size={15} /> {t("sidebar.rename")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onProjectAction(node.id, "new-subfolder")}>
                  <FolderPlus size={15} /> {t("sidebar.newSubfolder")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onProjectAction(node.id, "new-document")}>
                  <FilePlus size={15} /> {t("sidebar.addDocument")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onProjectAction(node.id, "add-tag")}>
                  <Tag size={15} /> {t("sidebar.addTag")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onProjectAction(node.id, "toggle-star")}>
                  <Star size={15} /> {node.starred ? t("sidebar.removeFavorite") : t("sidebar.addFavorite")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={() => onProjectAction(node.id, "delete")}>
                  <Trash size={15} /> {t("sidebar.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {node.children?.length && isExpanded ? (
        <div role="group">
          {node.children.map((child) => (
            <SidebarProjectTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedProjectId={selectedProjectId}
              activeDocumentId={activeDocumentId}
              activeDocumentLocation={activeDocumentLocation}
              onToggle={onToggle}
              onSelectProject={onSelectProject}
              onSelectDocument={onSelectDocument}
              onProjectAction={onProjectAction}
              onDocumentAction={onDocumentAction}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
