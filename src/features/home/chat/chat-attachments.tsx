"use client";

import { useEffect, useRef } from "react";
import { File, FilePdf, FileText, X } from "@phosphor-icons/react";
import type { ChatAttachment } from "./chat-types";
import type { ChatText } from "./chat-messages";
import styles from "./chat.module.css";

export function attachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentVisual({ file }: { file: File }) {
  const preview = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    if (preview.current) preview.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const Icon =
    file.type === "application/pdf"
      ? FilePdf
      : file.type.startsWith("text/")
        ? FileText
        : File;
  return file.type.startsWith("image/") ? (
    // User-selected images are temporary object URLs, not remote Next.js assets.
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={preview} alt="" className={styles.filePreview} />
  ) : (
    <span
      className={styles.fileIcon}
      data-pdf={file.type === "application/pdf"}
    >
      <Icon size={23} />
    </span>
  );
}

export function ChatAttachments({
  attachments,
  onRemove,
  t,
}: {
  attachments: ChatAttachment[];
  onRemove?: (id: string) => void;
  t: ChatText;
}) {
  return (
    <div className={styles.attachments} aria-label={t("attachments")}>
      {attachments.map(({ id, file }) => (
        <div key={id} className={styles.fileCard}>
          <AttachmentVisual file={file} />
          <div className={styles.fileDetails}>
            <span className={styles.fileName} title={file.name}>
              {file.name}
            </span>
            <span className={styles.fileMeta}>
              {attachmentSize(file.size)}
              <span aria-hidden>·</span>
              {file.name.split(".").at(-1)?.toUpperCase() || "FILE"}
            </span>
          </div>
          {onRemove ? (
            <button
              type="button"
              className={`fouc-action ${styles.removeFile}`}
              data-variant="destructive"
              aria-label={t("remove", { name: file.name })}
              onClick={() => onRemove(id)}
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
