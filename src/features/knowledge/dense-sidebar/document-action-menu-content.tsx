"use client";

import { ArrowSquareOut, FileDashed, PencilSimple, ShareNetwork, Star, Trash } from "@phosphor-icons/react";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useI18n } from "./use-i18n";
import styles from './sidebar-interactions.module.css';

export type DocumentAction = "toggle-draft" | "rename" | "toggle-star" | "trash" | "share" | "open-tab";

export function DocumentActionMenuContent({ documentId, starred, onAction }: { documentId: string; starred: boolean; onAction: (id: string, action: DocumentAction) => void }) {
  const { t } = useI18n();
  return <DropdownMenuContent align="end" className={styles.documentMenu}>
    <DropdownMenuItem onSelect={() => onAction(documentId, "rename")}><PencilSimple weight="bold" />{t("sidebar.rename")}</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onAction(documentId, "share")}><ShareNetwork weight="bold" />分享</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onAction(documentId, "open-tab")}><ArrowSquareOut weight="bold" />在新标签页打开</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onSelect={() => onAction(documentId, "toggle-star")}><Star weight={starred ? "fill" : "bold"} />{t(starred ? "sidebar.removeFavorite" : "sidebar.addFavorite")}</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onAction(documentId, "toggle-draft")}><FileDashed weight="bold" />切换草稿标记</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={() => onAction(documentId, "trash")}><Trash weight="bold" />{t("sidebar.moveToTrash")}</DropdownMenuItem>
  </DropdownMenuContent>;
}
