"use client";

import { DotsThree } from "@phosphor-icons/react";

import {
  DocumentActionMenuContent,
  type DocumentAction,
} from "@/features/knowledge/dense-sidebar/document-action-menu-content";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/features/knowledge/dense-sidebar/use-i18n";
import styles from "./sidebar-interactions.module.css";

export function SidebarDocumentMenu({
  documentId,
  starred,
  onAction,
  onOpenChange,
}: {
  documentId: string;
  starred: boolean;
  onAction: (documentId: string, action: DocumentAction) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <div className={styles.actions}>
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("sidebar.documentActions")}
            className={styles.actionButton}
            onClick={(event) => event.stopPropagation()}
          >
            <DotsThree aria-hidden="true" size={15} weight="bold" />
          </button>
        </DropdownMenuTrigger>
        <DocumentActionMenuContent documentId={documentId} starred={starred} onAction={onAction} />
      </DropdownMenu>
    </div>
  );
}
