// Dense sidebar navigation model, narrowed to the knowledge surface in Fouc.
export type SidebarIconName = "home" | "star" | "archive" | "trash" | "hash" | "calendar" | "sprout" | "image" | "file" | "folder" | "tasks" | "blocks";
export interface SidebarNavigationItem { id: string; labelKey: string; icon: SidebarIconName; count?: number; tone?: "teal" | "amber" | "indigo" | "rose" | "blue" | "violet" }
import type { ProjectIconId } from "./project-icons";
export interface SidebarProjectNode { id: string; kind?: "project" | "document"; label?: string; labelKey?: string; projectIconId?: ProjectIconId; icon?: SidebarIconName; expandable?: boolean; defaultExpanded?: boolean; starred?: boolean; children?: SidebarProjectNode[] }
export interface SidebarRecentNote { id: string; label?: string; labelKey?: string; starred?: boolean }
export const SIDEBAR_MAIN_ITEMS: SidebarNavigationItem[] = [
  { id: "home", labelKey: "sidebar.home", icon: "home", tone: "teal" },
  { id: "all-documents", labelKey: "sidebar.allDocuments", icon: "file", tone: "indigo" },
  { id: "starred", labelKey: "sidebar.starred", icon: "star", tone: "amber" },
  { id: "trash", labelKey: "sidebar.trash", icon: "trash", tone: "rose" },
];
