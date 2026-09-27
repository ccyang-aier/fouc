"use client";

import { FilePlus, PencilSimple, Star, Trash, ArrowUp, ArrowDown, ArrowBendDownRight, ArrowBendUpLeft, ImageSquare } from "@phosphor-icons/react";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useI18n } from "./use-i18n";

export type DocumentAction = "rename" | "toggle-star" | "trash" | "create-child" | "move-up" | "move-down" | "indent" | "outdent" | "set-icon" | "set-cover";

export function DocumentActionMenuContent({ documentId, starred, onAction }: { documentId: string; starred: boolean; onAction: (id: string, action: DocumentAction) => void }) {
  const { t } = useI18n();
  return <DropdownMenuContent align="end" className="w-[210px]">
    <DropdownMenuItem onSelect={() => onAction(documentId, "rename")}><PencilSimple />{t("sidebar.rename")}</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onAction(documentId, "create-child")}><FilePlus />新建子页面</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onAction(documentId, "set-icon")}><ImageSquare />更改图标</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onAction(documentId, "set-cover")}><ImageSquare />设置封面</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onSelect={() => onAction(documentId, "toggle-star")}><Star />{t(starred ? "sidebar.removeFavorite" : "sidebar.addFavorite")}</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onAction(documentId, "move-up")}><ArrowUp />上移</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onAction(documentId, "move-down")}><ArrowDown />下移</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onAction(documentId, "indent")}><ArrowBendDownRight />缩进一级</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onAction(documentId, "outdent")}><ArrowBendUpLeft />移出父页面</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={() => onAction(documentId, "trash")}><Trash />{t("sidebar.moveToTrash")}</DropdownMenuItem>
  </DropdownMenuContent>;
}
