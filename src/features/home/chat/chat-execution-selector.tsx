"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Brain, CaretDown, ImageSquare, Robot, VideoCamera } from "@phosphor-icons/react";
import type { ModelCatalogEntry } from '@fouc/shared/model-catalog';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from '@/lib/i18n';
import { autoExecutionOption, chatAgents, getChatExecutionOption, modelExecutionOption, modelProviders } from "./chat-execution-options";
import { ChatExecutionLogo } from './chat-execution-logo';
import { AutoModelInfoCard } from './auto-model-info-card';
import type { ChatContext } from "./chat-types";
import type { ChatText } from "./chat-messages";
import { ChatPickerContent, ChatPickerItem, ChatPickerSearch } from "./chat-picker";
import { ModelInfoCard, formatModelTokens, type ModelInfoSections } from './model-info-card';
import { ModelInfoPane, modelInfoNarrowWidth, modelInfoPaneGap, modelInfoPaneWidth } from './model-info-pane';
import { modelInfoMessages } from './model-info-messages';
import { useModelCatalog } from './use-model-catalog';
import { ModelReasoningControl } from './model-reasoning-control';
import { aggregateModelUsage, getMockModelUsage } from './model-usage-data';
import { ModelUsageSparkline } from './model-usage-sparkline';
import styles from "./chat-execution-selector.module.css";
import picker from "./chat-picker.module.css";

type ExecutionPreview = { kind: 'auto' } | { kind: 'model'; id: string };

export function ChatExecutionSelector({ context, onChange, t }: {
  context: ChatContext;
  onChange: (change: Partial<ChatContext>) => void;
  t: ChatText;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'model' | 'agent'>("model");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<ExecutionPreview | null>(null);
  const [focusPreview, setFocusPreview] = useState(false);
  const [menuOffset, setMenuOffset] = useState(0);
  const [expanded, setExpanded] = useState<ModelInfoSections>({ ratings: true, capabilities: true, pricing: true });
  const search = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewPanelId = useId();
  const pointerType = useRef('mouse');
  const catalog = useModelCatalog((open && kind === 'model') || context.execution.kind === 'model');
  const { t: info } = useTranslation(modelInfoMessages);
  const execution = context.execution;
  const currentModel = execution.kind === 'model' ? catalog.data?.find(model => model.id === execution.id) : undefined;
  const selected = currentModel ? modelExecutionOption(currentModel) : getChatExecutionOption(execution);
  const normalizedQuery = query.trim().toLowerCase();
  const models = (catalog.data ?? []).filter(model => `${model.name} ${model.provider} ${model.id}`.toLowerCase().includes(normalizedQuery));
  const autoCandidates = (catalog.data ?? []).filter(model => context.autoRules.modelIds === null || context.autoRules.modelIds.includes(model.id));
  const autoContextWindow = autoCandidates.reduce<number | null>((max, model) => model.contextWindow === null ? max : Math.max(max ?? 0, model.contextWindow), null);
  const autoUsage = aggregateModelUsage(autoCandidates.map(model => getMockModelUsage(model.id)));
  const groups = modelProviders.map(provider => ({ ...provider, models: models.filter(model => model.provider === provider.id) })).filter(group => group.models.length > 0);
  const showAuto = kind === 'model' && `${autoExecutionOption.name} ${t('autoMode')}`.toLowerCase().includes(normalizedQuery);
  const agents = chatAgents.filter(agent => `${agent.name} ${agent.brand}`.toLowerCase().includes(normalizedQuery));
  const rowCount = kind === 'model' ? models.length + Number(showAuto) : agents.length;
  const catalogPending = kind === 'model' && catalog.isPending;
  const catalogUnavailable = kind === 'model' && catalog.isError && !catalog.data;
  const showEmpty = !catalogPending && !catalogUnavailable && (kind === 'model' ? !models.length && (!normalizedQuery || !showAuto) : !agents.length);
  const listHeight = Math.max(56, rowCount * 34 + 8 + (kind === 'model' ? groups.length * 32 : 0) + (catalogPending || catalogUnavailable ? 60 : showEmpty ? 44 : 0));
  const previewModel = kind === 'model' && preview?.kind === 'model' ? models.find(model => model.id === preview.id) : undefined;
  const previewAuto = kind === 'model' && preview?.kind === 'auto';

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
  useEffect(() => {
    if (open) menu.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, kind, catalog.data, execution]);

  function keepPreview() {
    if (previewTimer.current) clearTimeout(previewTimer.current);
  }
  function leavePreview() {
    if (window.innerWidth <= modelInfoNarrowWidth || focusPreview) return;
    keepPreview();
    previewTimer.current = setTimeout(() => setPreview(null), 220);
  }
  function showPreview(target: ExecutionPreview, focus = false) {
    keepPreview();
    setFocusPreview(focus);
    setPreview(target);
  }
  function previewKeys(event: KeyboardEvent, target: ExecutionPreview) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); showPreview(target, true); }
    else if (event.key === 'Enter' || event.key === ' ') pointerType.current = 'keyboard';
  }

  function selectAuto() {
    onChange({ execution: { kind: 'auto' } });
    setPreview(null);
    setOpen(false);
  }

  function selectModel(model: ModelCatalogEntry) {
    const reasoningEffort = execution.kind === 'model' && execution.id === model.id && execution.reasoningEffort && model.reasoning?.levels.includes(execution.reasoningEffort)
      ? execution.reasoningEffort : model.reasoning?.defaultLevel ?? null;
    onChange({ execution: { kind: 'model', id: model.id, name: model.name, provider: model.provider, reasoningEffort } });
    setPreview(null);
    setOpen(false);
  }
  function closePreview() {
    keepPreview();
    setPreview(null);
    requestAnimationFrame(() => search.current?.focus());
  }

  return <div className={styles.selection}>
    <DropdownMenu open={open} onOpenChange={next => {
    keepPreview();
    setOpen(next);
    setPreview(null);
    if (next) { setKind(execution.kind === 'agent' ? 'agent' : 'model'); setQuery(''); updateMenuOffset(); }
  }}>
    <DropdownMenuTrigger asChild>
      <Button ref={trigger} type="button" variant="outline" className={styles.trigger} aria-label={t("executionSelector")}>
        <ChatExecutionLogo option={selected} size={16} /><span className={styles.triggerName}>{selected.name}</span><CaretDown size={11} />
      </Button>
    </DropdownMenuTrigger>
    <ChatPickerContent ref={menu} className={styles.menu} alignOffset={menuOffset} aria-description={info('detailsHint')}
      onPointerEnter={keepPreview} onPointerLeave={leavePreview}
      onEscapeKeyDown={event => { if (preview) { event.preventDefault(); closePreview(); } }}>
      <div className={styles.header} onKeyDown={event => { if (event.key === 'Tab') event.stopPropagation(); }}>
        <ChatPickerSearch ref={search} containerClassName={styles.search} value={query} aria-label={t(kind === 'agent' ? 'searchAgents' : 'searchModels')}
          placeholder={t(kind === 'agent' ? 'searchAgents' : 'searchModels')}
          onChange={event => { setQuery(event.target.value); setPreview(null); }} />
        <div className={styles.modeSwitch} role="group" aria-label={t('executionMode')}>
          {(['model', 'agent'] as const).map(mode => {
            const Icon = mode === 'model' ? Brain : Robot;
            return <Tooltip key={mode}><TooltipTrigger asChild>
              <Button type="button" variant="ghost" className={styles.modeButton} aria-label={t(mode === 'model' ? 'modelLabel' : 'agentLabel')}
                aria-pressed={kind === mode} data-active-mode={kind === mode}
                onClick={() => { setKind(mode); setQuery(''); setPreview(null); search.current?.focus(); }}><Icon size={14} /></Button>
            </TooltipTrigger><TooltipContent>{t(mode === 'model' ? 'modelLabel' : 'agentLabel')}</TooltipContent></Tooltip>;
          })}
        </div>
      </div>
      <ScrollArea className={styles.list} key={kind} viewportClassName={styles.listViewport} style={{ '--list-height': `${listHeight}px` } as CSSProperties}>
        {showAuto ? <ChatPickerItem className={`${styles.option} ${styles.modelOption}`} role="menuitemradio" aria-checked={execution.kind === 'auto'} data-current={execution.kind === 'auto'} textValue={autoExecutionOption.name}
          aria-label={autoExecutionOption.name} aria-expanded={previewAuto} aria-controls={previewAuto ? previewPanelId : undefined}
          aria-describedby={`${previewPanelId}-usage-auto`}
          onPointerDown={event => { pointerType.current = event.pointerType; }}
          onPointerMove={event => { if (event.pointerType === 'mouse' && !previewAuto) showPreview({ kind: 'auto' }); }}
          onKeyDown={event => previewKeys(event, { kind: 'auto' })}
          onSelect={event => { if (pointerType.current === 'touch') { event.preventDefault(); showPreview({ kind: 'auto' }); } else selectAuto(); }}>
          <ChatExecutionLogo option={autoExecutionOption} /><span className={styles.optionName}>{autoExecutionOption.name}</span>
          <ModelUsageSparkline modelId="auto" series={autoUsage} descriptionId={`${previewPanelId}-usage-auto`} />
          <span className={styles.contextSize}>{formatModelTokens(autoContextWindow)}</span>
        </ChatPickerItem> : null}
        {catalogPending ? <p className={styles.status} role="status">{info('loading')}</p> :
          catalogUnavailable ? <div className={styles.status} role="status"><span>{info('unavailable')}</span>
            <Button type="button" variant="ghost" size="sm" loading={catalog.isFetching} onClick={() => void catalog.refetch()}>{info('retry')}</Button></div> : null}
        {kind === 'model' ? groups.map(group => <DropdownMenuGroup key={group.id} aria-label={group.name}>
          <DropdownMenuLabel className={styles.providerLabel}>{group.name}</DropdownMenuLabel>
          {group.models.map(model => {
            const active = execution.kind === 'model' && execution.id === model.id;
            return <ChatPickerItem key={model.id} className={`${styles.option} ${styles.modelOption}`} role="menuitemradio" aria-checked={active} data-current={active} textValue={model.name}
              aria-expanded={previewModel?.id === model.id} aria-controls={previewModel?.id === model.id ? previewPanelId : undefined}
              aria-label={model.name} aria-describedby={`${previewPanelId}-usage-${model.id}`} onPointerDown={event => { pointerType.current = event.pointerType; }}
              onPointerMove={event => { if (event.pointerType === 'mouse' && previewModel?.id !== model.id) showPreview({ kind: 'model', id: model.id }); }}
              onSelect={event => { if (pointerType.current === 'touch') { event.preventDefault(); showPreview({ kind: 'model', id: model.id }); } else selectModel(model); }}
              onKeyDown={event => previewKeys(event, { kind: 'model', id: model.id })}>
              <ChatExecutionLogo option={modelExecutionOption(model)} />
              <span className={styles.modelName}><span className={styles.optionName}>{model.name}</span>
                {model.capabilities.imageGeneration ? <ImageSquare className={styles.imageIcon} data-static-color aria-label={t('imageModel')} /> : null}
                {model.capabilities.videoGeneration ? <VideoCamera className={styles.videoIcon} data-static-color aria-label={t('videoModel')} /> : null}
              </span>
              <ModelUsageSparkline modelId={model.id} descriptionId={`${previewPanelId}-usage-${model.id}`} />
              <span className={styles.contextSize}>{formatModelTokens(model.contextWindow)}</span>
            </ChatPickerItem>;
          })}
        </DropdownMenuGroup>) : agents.map(agent => {
          const active = execution.kind === 'agent' && execution.id === agent.id;
          return <ChatPickerItem key={agent.id} className={styles.option} role="menuitemradio" aria-checked={active} data-current={active} textValue={agent.name}
            onSelect={() => onChange({ execution: { kind: 'agent', id: agent.id, name: agent.name } })}>
            <ChatExecutionLogo option={agent} /><span className={styles.optionName}>{agent.name}</span>
          </ChatPickerItem>;
        })}
        {showEmpty ? <p className={picker.empty} role="status">{kind === 'model' && !normalizedQuery ? info('empty') : t('noExecutionResults')}</p> : null}
      </ScrollArea>
      {previewModel || previewAuto ? <ModelInfoPane key={previewAuto ? 'auto' : previewModel?.id} anchorRef={menu} focusOnOpen={focusPreview}
        panelId={previewPanelId} preferredWidth={previewAuto ? 300 : modelInfoPaneWidth} onPointerEnter={keepPreview} onPointerLeave={leavePreview}>
        {previewAuto ? <AutoModelInfoCard models={catalog.data ?? []} rules={context.autoRules}
          onChange={autoRules => onChange({ autoRules })} onSelect={selectAuto} onClose={closePreview}
          loading={catalogPending} unavailable={catalogUnavailable} onRetry={() => void catalog.refetch()} /> :
          previewModel ? <ModelInfoCard model={previewModel} expanded={expanded} onToggle={section => setExpanded(current => ({ ...current, [section]: !current[section] }))}
            onSelect={() => selectModel(previewModel)} onClose={closePreview} /> : null}
      </ModelInfoPane> : null}
    </ChatPickerContent>
    </DropdownMenu>
    {currentModel?.reasoning && execution.kind === 'model' ?
      <ModelReasoningControl key={currentModel.id} reasoning={currentModel.reasoning} value={execution.reasoningEffort}
        onChange={reasoningEffort => onChange({ execution: { ...execution, reasoningEffort } })} t={t} />
    : null}
  </div>;
}
