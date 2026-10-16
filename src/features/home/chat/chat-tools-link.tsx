"use client";

import Image from "next/image";
import { CaretRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { ChatText } from "./chat-messages";
import styles from "./chat-tools-link.module.css";

const tools = ["figma", "google-drive", "notion", "github"];

export function ChatToolsLink({ onOpen, t }: { onOpen: () => void; t: ChatText }) {
  return (
    <Button
      type="button"
      variant="ghost"
      data-variant="text"
      className={styles.toolsLink}
      onClick={onOpen}
    >
      <span>{t("connectTools")}</span>
      <span className={styles.toolsLinkEnd} aria-hidden="true">
        <span className={styles.toolLogos}>
          {tools.map((tool) => (
            <span className={styles.toolLogo} key={tool}>
              <Image
                src={`/connector-logos/${tool}.svg`}
                alt=""
                width={15}
                height={15}
              />
            </span>
          ))}
        </span>
        <CaretRight className={styles.toolsArrow} size={16} />
      </span>
    </Button>
  );
}
