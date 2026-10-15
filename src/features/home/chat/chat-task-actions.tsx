"use client";

import { useRef } from "react";
import {
  ChatCircleText,
  GlobeHemisphereWest,
  NotePencil,
  RocketLaunch,
  Scan,
  SquaresFour,
  Warning,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatText } from "./chat-messages";
import styles from "./chat-task-actions.module.css";

const primaryActions = [
  { label: "research", prompt: "researchPrompt", icon: GlobeHemisphereWest },
  { label: "deployAgents", prompt: "deployAgentPrompt", icon: RocketLaunch },
] as const;

const moreActions = [
  { label: "review", prompt: "reviewPrompt", icon: Scan },
  { label: "issues", prompt: "issuesPrompt", icon: Warning },
  { label: "explain", prompt: "explainPrompt", icon: ChatCircleText },
  { label: "improve", prompt: "improvePrompt", icon: NotePencil },
] as const;

export function ChatTaskActions({ t, onPrompt }: {
  t: ChatText;
  onPrompt: (prompt: string) => void;
}) {
  const selectedPrompt = useRef<string | null>(null);
  return (
    <div className={styles.actions}>
      {primaryActions.map(({ label, prompt, icon: Icon }) => (
        <Button
          type="button"
          variant="outline"
          className={styles.actionButton}
          key={label}
          onClick={() => onPrompt(t(prompt))}
        >
          <Icon size={18} />
          {t(label)}
        </Button>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className={styles.actionButton}>
            <SquaresFour size={18} />
            {t("more")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          onCloseAutoFocus={(event) => {
            if (selectedPrompt.current === null) return;
            event.preventDefault();
            onPrompt(selectedPrompt.current);
            selectedPrompt.current = null;
          }}
        >
          {moreActions.map(({ label, prompt, icon: Icon }) => (
            <DropdownMenuItem key={label} onSelect={() => { selectedPrompt.current = t(prompt); }}>
              <Icon />
              {t(label)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
