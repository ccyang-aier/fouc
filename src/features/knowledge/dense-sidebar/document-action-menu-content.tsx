"use client";

import { Columns, ArrowSquareOut, FolderMinus, ClockCounterClockwise, Info, PencilSimple, Star, Trash } from "@phosphor-icons/react";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useI18n } from "./use-i18n";

export type DocumentAction = "rename" | "info" | "open-new-tab" | "open-split" | "toggle-star" | "remove-from-folder" | "history" | "trash";

export function DocumentActionMenuContent({ documentId, starred, onAction }: { documentId: string; starred: boolean; onAction: (id: string, action: DocumentAction) => void }) {
  const { t } = useI18n();
  return <DropdownMenuContent align="end" className="w-[210px]">
    <DropdownMenuItem onSelect={() => onAction(documentId, "rename")}><PencilSimple />{t("sidebar.rename")}</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onAction(documentId, "info")}><Info />{t("sidebar.viewInformation")}</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onAction(documentId, "open-new-tab")}><ArrowSquareOut />{t("sidebar.openNewTab")}</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onAction(documentId, "open-split")}><Columns />{t("sidebar.openSplitView")}</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onSelect={() => onAction(documentId, "toggle-star")}><Star />{t(starred ? "sidebar.removeFavorite" : "sidebar.addFavorite")}</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onAction(documentId, "remove-from-folder")}><FolderMinus />{t("sidebar.removeFromFolder")}</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onAction(documentId, "history")}><ClockCounterClockwise />{t("sidebar.versionHistory")}</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={() => onAction(documentId, "trash")}><Trash />{t("sidebar.moveToTrash")}</DropdownMenuItem>
  </DropdownMenuContent>;
}
