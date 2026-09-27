// Dense sidebar navigation model, narrowed to the knowledge surface in Fouc.
export type SidebarIconName = "star" | "archive" | "trash" | "hash" | "calendar" | "sprout" | "image" | "file" | "draft" | "folder" | "tasks" | "blocks";
export interface SidebarNavigationItem { id: string; labelKey: string; icon: SidebarIconName; count?: number; tone?: "teal" | "amber" | "indigo" | "rose" | "blue" | "violet" }
import type { ProjectIconId } from "./project-icons";
export interface SidebarProjectNode { id: string; kind?: "project" | "document"; label?: string; labelKey?: string; projectIconId?: ProjectIconId; icon?: SidebarIconName; expandable?: boolean; defaultExpanded?: boolean; starred?: boolean; count?: number; children?: SidebarProjectNode[] }
export interface SidebarRecentNote { id: string; label?: string; labelKey?: string; starred?: boolean }
export const SIDEBAR_MAIN_ITEMS: SidebarNavigationItem[] = [
  { id: "all-documents", labelKey: "sidebar.allDocuments", icon: "file", tone: "indigo" },
  { id: "starred", labelKey: "sidebar.starred", icon: "star", tone: "amber" },
  { id: "drafts", labelKey: "sidebar.drafts", icon: "draft", tone: "teal" },
  { id: "trash", labelKey: "sidebar.trash", icon: "trash", tone: "rose" },
];

export type TagSummary = { id: string; name: string; color: string };
export type SidebarDocumentSummary = { id: string; title: string; starred: boolean };
