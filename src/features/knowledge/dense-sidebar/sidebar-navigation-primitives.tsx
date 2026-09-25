"use client";

import * as React from "react";
import {
  Archive,
  CalendarDots,
  CaretRight,
  CheckSquareOffset,
  FileText,
  FolderOpen,
  HashStraight,
  House,
  ImageSquare,
  Plant,
  SquaresFour,
  Star,
  TrashSimple,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";

import { ProjectIcon } from "@/features/knowledge/dense-sidebar/project-icon";
import type { ProjectIconId } from "@/features/knowledge/dense-sidebar/project-icons";
import type { DocumentAction } from "@/features/knowledge/dense-sidebar/document-action-menu-content";
import type {
  SidebarIconName,
  SidebarNavigationItem,
} from "@/features/knowledge/dense-sidebar/sidebar-navigation";
import { useI18n } from "@/features/knowledge/dense-sidebar/use-i18n";
import { cn } from "@/lib/utils";
import { SidebarDocumentMenu } from "@/features/knowledge/dense-sidebar/sidebar-document-menu";
import styles from "./sidebar-interactions.module.css";

export const sidebarIconMap: Record<SidebarIconName, PhosphorIcon> = {
  home: House,
  star: Star,
  archive: Archive,
  trash: TrashSimple,
  hash: HashStraight,
  calendar: CalendarDots,
  sprout: Plant,
  image: ImageSquare,
  file: FileText,
  folder: FolderOpen,
  tasks: CheckSquareOffset,
  blocks: SquaresFour,
};

export const sidebarDocumentIconClass =
  "mr-2 shrink-0 text-[#7c8387] transition-colors duration-150 ease-out group-hover:text-foreground group-focus-within:text-foreground group-data-[selected=true]:text-foreground";

export const sidebarIconToneClasses: Record<
  NonNullable<SidebarNavigationItem["tone"]>,
  string
> = {
  teal: "text-[#3f8990]",
  amber: "text-[#e9ad16]",
  indigo: "text-[#667dc4]",
  rose: "text-[#d76d68]",
  blue: "text-[#3989c9]",
  violet: "text-[#7a67d5]",
};

export function SidebarSectionHeader({
  icon: Icon,
  label,
  expanded,
  onToggle,
  onSelect,
  selected,
  actions,
}: {
  icon: PhosphorIcon;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  onSelect?: () => void;
  selected?: boolean;
  actions?: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div
      data-selected={selected ? "true" : undefined}
      className={cn(styles.row, "group/section flex h-[30px] items-center rounded-[6px] pl-1.5 pr-1")}
    >
      <Icon
        aria-hidden="true"
        size={15}
        weight="regular"
        className="mr-2 shrink-0 text-[#7c8387] transition-colors group-hover/section:text-foreground group-focus-within/section:text-foreground"
      />
      <button
        type="button"
        aria-current={selected ? "page" : undefined}
        onClick={onSelect ?? onToggle}
        className="flex h-full min-w-0 items-center truncate text-left text-[13px] font-medium leading-none text-[var(--sidebar-heading)] outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        <span className="my-auto inline-flex h-4 items-center truncate leading-4">{label}</span>
      </button>
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={t(expanded ? "sidebar.collapseSection" : "sidebar.expandSection", {
          section: label,
        })}
        onClick={onToggle}
        className="ml-0.5 inline-flex size-[23px] shrink-0 items-center justify-center rounded-[5px] text-[var(--sidebar-heading)] outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        <CaretRight
          weight="fill"
          className={cn(
            "size-[10px] shrink-0 transition-transform duration-200",
            expanded && "rotate-90",
          )}
        />
      </button>
      {actions ? (
        <div className="pointer-events-none ml-auto flex shrink-0 items-center gap-px opacity-0 transition-opacity group-hover/section:pointer-events-auto group-hover/section:opacity-100 group-focus-within/section:pointer-events-auto group-focus-within/section:opacity-100">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function SidebarCollapsibleContent({
  expanded,
  children,
  className,
  contentClassName,
}: {
  expanded: boolean;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
        expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className,
      )}
    >
      <div className={cn("min-h-0 overflow-hidden", contentClassName)}>{children}</div>
    </div>
  );
}

export function SidebarRow({
  label,
  icon: Icon,
  selected,
  count,
  iconTone,
  compact,
  depth = 0,
  leading,
  onClick,
}: {
  label: string;
  icon?: PhosphorIcon;
  selected?: boolean;
  count?: number;
  iconTone?: SidebarNavigationItem["tone"];
  compact?: boolean;
  depth?: number;
  leading?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-selected={selected ? "true" : undefined}
      className={cn(
        styles.row,
        "group flex h-[30px] w-full items-center rounded-[6px] pr-1 text-left leading-none text-[var(--sidebar-text)] outline-none",
        compact ? "text-[12px]" : "text-[13px]",
        selected && "font-medium text-foreground",
      )}
      style={{ paddingLeft: 4 + depth * 18 }}
    >
      {leading ??
        (Icon ? (
          <Icon
            aria-hidden="true"
            size={15}
            weight="fill"
            className={cn(
              "mr-2 shrink-0 text-[#7c8387]",
              iconTone && sidebarIconToneClasses[iconTone],
            )}
          />
        ) : null)}
      <span className="my-auto inline-flex h-4 min-w-0 items-center truncate leading-4">{label}</span>
      {count !== undefined ? (
        <span className="ml-2 text-[10.5px] tabular-nums text-[#8b9093]">{count}</span>
      ) : null}
    </button>
  );
}

export function ProductivityGlyph({
  icon,
  tone,
  className,
}: {
  icon: SidebarIconName;
  tone?: SidebarNavigationItem["tone"];
  className?: string;
}) {
  const Icon = sidebarIconMap[icon];

  return (
    <span
      className={cn(
        "mr-2 inline-flex size-[15px] shrink-0 items-center justify-center rounded-[4px] text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.14)]",
        tone === "blue" && "bg-[#3989c9]",
        tone === "violet" && "bg-[#7a67d5]",
        className,
      )}
    >
      <Icon aria-hidden="true" size={10} weight="fill" />
    </span>
  );
}

export function SidebarDocumentActions({
  documentId,
  starred,
  onAction,
}: {
  documentId: string;
  starred: boolean;
  onAction: (documentId: string, action: DocumentAction) => void;
}) {
  return (
    <div className={cn(styles.actions, "ml-auto flex shrink-0 items-center gap-0.5")} data-starred={starred ? "true" : undefined}>
      <button
        type="button"
        className={styles.actionButton}
        aria-label={starred ? "取消收藏文档" : "收藏文档"}
        title={starred ? "取消收藏" : "收藏"}
        onClick={() => onAction(documentId, "toggle-star")}
      >
        <Star aria-hidden="true" size={14} weight={starred ? "fill" : "regular"} className={starred ? "text-[#e5aa14]" : undefined} />
      </button>
      <SidebarDocumentMenu
        documentId={documentId}
        starred={starred}
        onAction={onAction}
      />
    </div>
  );
}

export function RecentNoteRow({
  documentId,
  label,
  selected,
  starred,
  onClick,
  onAction,
}: {
  documentId: string;
  label: string;
  selected?: boolean;
  starred?: boolean;
  onClick: () => void;
  onAction: (documentId: string, action: DocumentAction) => void;
}) {
  return (
    <div
      data-selected={selected ? "true" : undefined}
      className={cn(
        styles.row,
        "group flex h-[28px] w-full items-center rounded-[6px] pl-[22px] pr-1 text-left text-[12px] leading-none tracking-[-0.005em] text-muted-foreground outline-none",
        selected && "font-medium text-foreground",
      )}
    >
      <button type="button" onClick={onClick} className="flex h-full min-w-0 flex-1 items-center text-left outline-none">
        <FileText
          aria-hidden="true"
          size={13}
          weight="fill"
          className={sidebarDocumentIconClass}
        />
        <span className="my-auto inline-flex h-4 min-w-0 items-center truncate leading-4">{label}</span>
      </button>
      <SidebarDocumentActions documentId={documentId} starred={Boolean(starred)} onAction={onAction} />
    </div>
  );
}

export function ProjectGlyph({
  iconId,
  className,
}: {
  iconId?: ProjectIconId;
  className?: string;
}) {
  return (
    <ProjectIcon
      iconId={iconId}
      className={cn("mr-2 size-[15px] rounded-[4px]", className)}
    />
  );
}
