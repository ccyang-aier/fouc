"use client";

import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { ChatText } from "./chat-messages";
import styles from "./chat-tools-link.module.css";

const tools = ["figma", "google-drive", "notion", "github"];

export function ChatToolsLink({ onOpen, t }: { onOpen: () => void; t: ChatText }) {
  return (
    <Button
      type="button"
      variant="ghost"
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
        <ArrowRight size={20} />
      </span>
    </Button>
  );
}
