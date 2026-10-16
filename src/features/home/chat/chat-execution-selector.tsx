"use client";

import { useRef, useState, type CSSProperties } from "react";
import { Brain, CaretDown, Check, Code, ImageSquare, Leaf, MagnifyingGlass, Robot, Sparkle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { chatAgents, chatModels, getChatExecutionOption, type ChatExecutionOption } from "./chat-execution-options";
import type { ChatContext } from "./chat-types";
import type { ChatText } from "./chat-messages";
import styles from "./chat-execution-selector.module.css";

function ExecutionLogo({ option }: { option: ChatExecutionOption }) {
  const { brand } = option;
  const Icon = brand === "codey" ? Code : brand === "sage" ? Leaf : Sparkle;
  return (
    <span className={styles.logo} data-brand={brand} data-tone={option.tone} aria-hidden="true">
      {brand === "nova" || brand === "codey" || brand === "sage" ? (
        <Icon size={16} weight="fill" />
      ) : (
        <span className={styles.brandMask} style={{ "--brand-logo": `url(/agent-logos/ai-major/${brand}.svg)` } as CSSProperties} />
      )}
    </span>
  );
}

export function ChatExecutionSelector({ context, onChange, t }: {
  context: ChatContext;
  onChange: (change: Partial<ChatContext>) => void;
  t: ChatText;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(context.execution.kind);
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const selected = getChatExecutionOption(context.execution);
  const options = (kind === "agent" ? chatAgents : chatModels).filter((option) =>
    `${option.name} ${option.brand}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <DropdownMenu open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) { setKind(context.execution.kind); setQuery(""); }
    }}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className={styles.trigger} aria-label={t("executionSelector")}>
          <ExecutionLogo option={selected} />
          <span className={styles.triggerName}>{selected.name}</span>
          <CaretDown size={11} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" collisionPadding={12} className={styles.menu}>
        <div className={styles.header} onKeyDown={(event) => { if (event.key === "Tab") event.stopPropagation(); }}>
          <label className={styles.search}>
            <MagnifyingGlass size={17} aria-hidden="true" />
            <input ref={search} autoFocus value={query} aria-label={t(kind === "agent" ? "searchAgents" : "searchModels")}
              placeholder={t(kind === "agent" ? "searchAgents" : "searchModels")}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" || event.key === "Tab") return;
                event.stopPropagation();
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  event.currentTarget.closest('[role="menu"]')?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus();
                }
              }} />
          </label>
          <div className={styles.modeSwitch} role="group" aria-label={t("executionMode")}>
            {(["model", "agent"] as const).map((mode) => {
              const Icon = mode === "model" ? Brain : Robot;
              return <Tooltip key={mode}>
                <TooltipTrigger asChild>
                  <Button type="button" variant="ghost" className={styles.modeButton}
                    aria-label={t(mode === "model" ? "modelLabel" : "agentLabel")}
                    aria-pressed={kind === mode} data-active-mode={kind === mode}
                    onClick={() => { setKind(mode); setQuery(""); search.current?.focus(); }}>
                    <Icon size={17} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t(mode === "model" ? "modelLabel" : "agentLabel")}</TooltipContent>
              </Tooltip>;
            })}
          </div>
        </div>
        <ScrollArea className={styles.list} key={kind} viewportClassName={styles.listViewport}
          style={{ "--list-height": `${Math.max(options.length * 43 + 8, 80)}px` } as CSSProperties}>
          {options.length ? options.map((option) => {
            const active = context.execution.kind === kind && context.execution.id === option.id;
            return <DropdownMenuItem key={option.id} className={styles.option} data-selected={active} role="menuitemradio" aria-checked={active}
              textValue={option.name} onSelect={() => onChange({ execution: { kind, id: option.id } })}>
              <ExecutionLogo option={option} />
              <span className={styles.optionDetails}>
                <span className={styles.optionName} title={option.name}>{option.name}</span>
                {option.reasoning ? <span className={styles.reasoning}>{t(option.reasoning)}</span> : null}
                {option.image ? <ImageSquare className={styles.imageIcon} aria-label={t("imageModel")} /> : null}
                {option.isNew ? <span className={styles.newBadge}>{t("newModel")}</span> : null}
              </span>
              {option.capability !== undefined ? <span className={styles.meters} aria-hidden="true">
                <span className={styles.meter}><i style={{ width: `${option.capability}%` }} /></span>
                <span className={styles.meter} data-speed="true"><i style={{ width: `${option.speed}%` }} /></span>
              </span> : null}
              {option.multiplier ? <span className={styles.multiplier}>{option.multiplier}</span> : null}
              {active ? <Check className={styles.selected} size={13} aria-label={t("selectedExecution")} /> : null}
            </DropdownMenuItem>;
          }) : <p className={styles.empty} role="status">{t("noExecutionResults")}</p>}
        </ScrollArea>
        {kind === "model" ? <div className={styles.preview} title={t("modelPreviewDescription")}>{t("modelPreview")}</div> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
