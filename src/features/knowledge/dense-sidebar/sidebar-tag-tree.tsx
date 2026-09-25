"use client";

import {
  CaretDown,
  CaretRight,
  DotsThree,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";

import {
  SidebarCreateIcon,
  SidebarDocumentActions,
  sidebarDocumentIconClass,
} from "@/features/knowledge/dense-sidebar/sidebar-navigation-primitives";
import type { DocumentAction } from "@/features/knowledge/dense-sidebar/document-action-menu-content";
import type { HyperdocDocumentSummary } from "@/features/knowledge/knowledge-model";
import type { TagSummary } from "@/features/knowledge/knowledge-model";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/features/knowledge/dense-sidebar/use-i18n";
import styles from "./sidebar-interactions.module.css";

export type SidebarTagAction = "new-document" | "rename" | "delete";

export function SidebarTagTreeNode({
  tag,
  documents,
  expanded,
  activeDocumentId,
  activeDocumentLocation,
  onToggle,
  onSelectDocument,
  onTagAction,
  onDocumentAction,
}: {
  tag: TagSummary;
  documents: HyperdocDocumentSummary[];
  expanded: boolean;
  activeDocumentId: string | null;
  activeDocumentLocation: "project" | "recent" | "tag" | null;
  onToggle: (tagId: string) => void;
  onSelectDocument: (documentId: string) => void;
  onTagAction: (tagId: string, action: SidebarTagAction) => void;
  onDocumentAction: (documentId: string, action: DocumentAction) => void;
}) {
  const { t } = useI18n();
  const hasDocuments = documents.length > 0;

  return (
    <div role="treeitem" aria-expanded={hasDocuments ? expanded : undefined} aria-selected={false}>
      <div
        className={cn(
          styles.row,
          "group flex h-[29px] w-full items-center rounded-[6px] pr-1 text-[12px] leading-none text-[var(--sidebar-text)]",
        )}
        style={{ paddingLeft: 5 }}
      >
        {hasDocuments ? (
          <button
            type="button"
            aria-label={t(expanded ? "sidebar.collapseSection" : "sidebar.expandSection", { section: tag.name })}
            aria-expanded={expanded}
            onClick={() => onToggle(tag.id)}
            className="mr-0.5 inline-flex size-[17px] shrink-0 items-center justify-center rounded-[4px] outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            {expanded ? <CaretDown aria-hidden="true" size={10} weight="bold" /> : <CaretRight aria-hidden="true" size={10} weight="bold" />}
          </button>
        ) : (
          <span className="mr-0.5 size-[17px] shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onToggle(tag.id)}
          className="flex h-full min-w-0 flex-1 items-center text-left outline-none"
        >
          <span
            aria-hidden="true"
            className="mr-2 size-2 shrink-0 rounded-full"
            style={{ backgroundColor: tag.color }}
          />
          <span className="my-auto inline-flex h-4 min-w-0 items-center truncate leading-4">{tag.name}</span>
        </button>
        <div className={cn(styles.actions, "ml-auto flex shrink-0 items-center gap-0.5")}>
          <button
            type="button"
            aria-label={t("sidebar.newDocumentInTag", { tag: tag.name })}
            className={styles.actionButton}
            onClick={() => onTagAction(tag.id, "new-document")}
          >
            <SidebarCreateIcon />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("sidebar.tagMenu", { tag: tag.name })}
                className={styles.actionButton}
                onClick={(event) => event.stopPropagation()}
              >
                <DotsThree aria-hidden="true" size={16} weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[170px]">
              <DropdownMenuItem onSelect={() => onTagAction(tag.id, "rename")}>
                <PencilSimple size={15} /> {t("sidebar.rename")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:bg-red-50 focus:text-red-700"
                onSelect={() => onTagAction(tag.id, "delete")}
              >
                <Trash size={15} /> {t("sidebar.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasDocuments && expanded ? (
        <div role="group">
          {documents.map((document) => {
            const selected = activeDocumentLocation === "tag" && activeDocumentId === document.id;
            return (
              <div
                key={document.id}
                data-selected={selected ? "true" : undefined}
                className={cn(
                  styles.row,
                  "group flex h-[29px] w-full items-center rounded-[6px] pr-1 text-[12px] leading-none text-[var(--sidebar-text)]",
                  selected && "font-medium text-foreground",
                )}
                style={{ paddingLeft: 30 }}
              >
                <button
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  onClick={() => onSelectDocument(document.id)}
                  className="flex h-full min-w-0 flex-1 items-center text-left outline-none"
                >
                  <FileText aria-hidden="true" size={13} className={sidebarDocumentIconClass} />
                  <span className="my-auto inline-flex h-4 min-w-0 items-center truncate leading-4">{document.title}</span>
                </button>
                <SidebarDocumentActions
                  documentId={document.id}
                  starred={document.starred}
                  onAction={onDocumentAction}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
