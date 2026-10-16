"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Brain, CaretDown, Check, Code, ImageSquare, Leaf, Sparkle } from "@phosphor-icons/react";
import type { ModelCatalogEntry } from '@fouc/shared/model-catalog';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from '@/lib/i18n';
import { chatAgents, getChatExecutionOption, modelExecutionOption, type ChatExecutionOption } from "./chat-execution-options";
import type { ChatContext } from "./chat-types";
import type { ChatText } from "./chat-messages";
import { ChatPickerContent, ChatPickerItem, ChatPickerSearch } from "./chat-picker";
import { formatModelTokens, type ModelInfoSections } from './model-info-card';
import { ModelInfoPane, modelInfoNarrowWidth, modelInfoPaneGap, modelInfoPaneWidth } from './model-info-pane';
import { modelInfoMessages } from './model-info-messages';
import { useModelCatalog } from './use-model-catalog';
import styles from "./chat-execution-selector.module.css";
import picker from "./chat-picker.module.css";

function AgentModeIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 11V9a6 6 0 0 1 12 0v2M4 10v3m16-3v3" />
    <rect x="6" y="8" width="12" height="7" rx="3.5" />
    <path d="M9.5 11.5h.01m5 0h.01M9 15v2l-4 1.5V21h14v-2.5L15 17v-2M9 18l3 1 3-1" />
  </svg>;
}

function ExecutionLogo({ option }: { option: ChatExecutionOption }) {
  const { brand } = option;
  const Icon = brand === "codey" ? Code : brand === "sage" ? Leaf : brand === 'model' ? Brain : Sparkle;
  return <span className={styles.logo} data-brand={brand} aria-hidden="true">
    {["nova", "codey", "sage", "model"].includes(brand) ? <Icon weight="fill" /> :
      <span className={styles.brandMask} style={{ "--brand-logo": `url(/agent-logos/ai-major/${brand}.svg)` } as CSSProperties} />}
  </span>;
}

export function ChatExecutionSelector({ context, onChange, t }: {
  context: ChatContext;
  onChange: (change: Partial<ChatContext>) => void;
  t: ChatText;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ChatContext["execution"]["kind"]>("model");
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [focusPreview, setFocusPreview] = useState(false);
  const [menuOffset, setMenuOffset] = useState(0);
  const [expanded, setExpanded] = useState<ModelInfoSections>({ benchmarks: true, capabilities: false, pricing: false });
  const search = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewPanelId = useId();
  const pointerType = useRef('mouse');
  const catalog = useModelCatalog((open && kind === 'model') || context.execution.kind === 'model');
  const { t: info } = useTranslation(modelInfoMessages);
  const currentModel = catalog.data?.find(model => model.id === context.execution.id);
  const selected = context.execution.kind === 'model' && currentModel ? modelExecutionOption(currentModel) : getChatExecutionOption(context.execution);
  const normalizedQuery = query.trim().toLowerCase();
  const models = (catalog.data ?? []).filter(model => `${model.name} ${model.provider} ${model.id}`.toLowerCase().includes(normalizedQuery));
  const agents = chatAgents.filter(agent => `${agent.name} ${agent.brand}`.toLowerCase().includes(normalizedQuery));
  const rowCount = kind === 'model' ? models.length : agents.length;
  const previewModel = kind === 'model' ? models.find(model => model.id === previewId) : undefined;

  function updateMenuOffset() {
    const left = trigger.current?.getBoundingClientRect().left ?? 0;
    setMenuOffset(window.innerWidth <= modelInfoNarrowWidth ? 0 : Math.max(0, modelInfoPaneWidth + modelInfoPaneGap + 12 - left));
  }
  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', updateMenuOffset);
    return () => window.removeEventListener('resize', updateMenuOffset);
  }, [open]);
  useEffect(() => () => { if (previewTimer.current) clearTimeout(previewTimer.current); }, []);

  function keepPreview() {
    if (previewTimer.current) clearTimeout(previewTimer.current);
  }
  function leavePreview() {
    if (window.innerWidth <= modelInfoNarrowWidth || focusPreview) return;
    keepPreview();
    previewTimer.current = setTimeout(() => setPreviewId(null), 220);
  }
  function showPreview(id: string, focus = false) {
    keepPreview();
    setFocusPreview(focus);
    setPreviewId(id);
  }

  function selectModel(model: ModelCatalogEntry) {
    onChange({ execution: { kind: 'model', id: model.id, name: model.name, provider: model.provider } });
    setPreviewId(null);
    setOpen(false);
  }
  function closePreview() {
    keepPreview();
    setPreviewId(null);
    requestAnimationFrame(() => search.current?.focus());
  }

  return <DropdownMenu open={open} onOpenChange={next => {
    keepPreview();
    setOpen(next);
    setPreviewId(null);
    if (next) { setQuery(''); updateMenuOffset(); }
  }}>
    <DropdownMenuTrigger asChild>
      <Button ref={trigger} type="button" variant="outline" className={styles.trigger} aria-label={t("executionSelector")}>
        <ExecutionLogo option={selected} /><span className={styles.triggerName}>{selected.name}</span><CaretDown size={11} />
      </Button>
    </DropdownMenuTrigger>
    <ChatPickerContent ref={menu} className={styles.menu} alignOffset={menuOffset} aria-description={info('detailsHint')}
      onPointerEnter={keepPreview} onPointerLeave={leavePreview}
      onEscapeKeyDown={event => { if (previewModel) { event.preventDefault(); closePreview(); } }}>
      <div className={picker.header} onKeyDown={event => { if (event.key === 'Tab') event.stopPropagation(); }}>
        <ChatPickerSearch ref={search} value={query} aria-label={t(kind === 'agent' ? 'searchAgents' : 'searchModels')}
          placeholder={t(kind === 'agent' ? 'searchAgents' : 'searchModels')}
          onChange={event => { setQuery(event.target.value); setPreviewId(null); }} />
        <div className={styles.modeSwitch} role="group" aria-label={t('executionMode')}>
          {(['model', 'agent'] as const).map(mode => {
            const Icon = mode === 'model' ? Brain : AgentModeIcon;
            return <Tooltip key={mode}><TooltipTrigger asChild>
              <Button type="button" variant="ghost" className={styles.modeButton} aria-label={t(mode === 'model' ? 'modelLabel' : 'agentLabel')}
                aria-pressed={kind === mode} data-active-mode={kind === mode}
                onClick={() => { setKind(mode); setQuery(''); setPreviewId(null); search.current?.focus(); }}><Icon size={14} /></Button>
            </TooltipTrigger><TooltipContent>{t(mode === 'model' ? 'modelLabel' : 'agentLabel')}</TooltipContent></Tooltip>;
          })}
        </div>
      </div>
      {kind === 'model' && catalog.isPending ? <p className={styles.status} role="status">{info('loading')}</p> :
        kind === 'model' && catalog.isError && !catalog.data ? <div className={styles.status} role="status"><span>{info('unavailable')}</span>
          <Button type="button" variant="ghost" size="sm" loading={catalog.isFetching} onClick={() => void catalog.refetch()}>{info('retry')}</Button></div> :
          <ScrollArea className={styles.list} key={kind} viewportClassName={styles.listViewport} style={{ '--list-rows': rowCount } as CSSProperties}>
            {kind === 'model' ? models.map(model => {
              const active = context.execution.kind === 'model' && context.execution.id === model.id;
              return <ChatPickerItem key={model.id} className={styles.option} role="menuitemradio" aria-checked={active} textValue={model.name}
                  aria-expanded={previewId === model.id} aria-controls={previewId === model.id ? previewPanelId : undefined}
                  aria-label={model.name} onPointerDown={event => { pointerType.current = event.pointerType; }}
                  onPointerMove={event => { if (event.pointerType === 'mouse' && previewId !== model.id) showPreview(model.id); }}
                  onSelect={event => { if (pointerType.current === 'touch') { event.preventDefault(); showPreview(model.id); } else selectModel(model); }}
                  onKeyDown={event => {
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); showPreview(model.id, true); }
                    else if (event.key === 'Enter' || event.key === ' ') pointerType.current = 'keyboard';
                  }}>
                  <ExecutionLogo option={modelExecutionOption(model)} />
                  <span className={styles.optionName}>{model.name}</span>
                  {model.capabilities.imageGeneration ? <ImageSquare className={styles.imageIcon} aria-label={t('imageModel')} /> : null}
                  <span className={styles.contextSize}>{formatModelTokens(model.contextWindow)}</span>
                  {active ? <Check size={13} className={styles.selected} aria-label={t('selectedExecution')} /> : null}
                </ChatPickerItem>;
            }) : agents.map(agent => {
              const active = context.execution.kind === 'agent' && context.execution.id === agent.id;
              return <ChatPickerItem key={agent.id} className={styles.option} role="menuitemradio" aria-checked={active} textValue={agent.name}
                onSelect={() => onChange({ execution: { kind: 'agent', id: agent.id, name: agent.name } })}>
                <ExecutionLogo option={agent} /><span className={styles.optionName}>{agent.name}</span>{active ? <Check className={styles.selected} size={13} /> : null}
              </ChatPickerItem>;
            })}
            {!rowCount ? <p className={picker.empty} role="status">{kind === 'model' && !normalizedQuery ? info('empty') : t('noExecutionResults')}</p> : null}
          </ScrollArea>}
      {previewModel ? <ModelInfoPane key={previewModel.id} anchorRef={menu} focusOnOpen={focusPreview}
        panelId={previewPanelId} onPointerEnter={keepPreview} onPointerLeave={leavePreview}
        model={previewModel} expanded={expanded} onToggle={section => setExpanded(current => ({ ...current, [section]: !current[section] }))}
        onSelect={() => selectModel(previewModel)} onClose={closePreview} /> : null}
    </ChatPickerContent>
  </DropdownMenu>;
}
