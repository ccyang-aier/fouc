'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './table-query-row-actions.messages';
import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, DotsSixVertical, Eye, EyeSlash, Scan, X } from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { QueryRuleDragHandle } from './use-query-rule-reorder';
import styles from './table-query.module.css';
export function QueryRuleActions({
  kind,
  disabled,
  enabled,
  onOnly,
  onToggle,
  onRemove,
}: {
  kind: 'filter' | 'sort';
  disabled: boolean;
  enabled: boolean;
  onOnly: () => void;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const label = kind === 'filter' ? tConnector('condition') : tConnector('sort');
  const onlyLabel =
    kind === 'filter' ? tConnector('filterByThisItemOnly') : tConnector('sortByThisItemOnly');
  const toggleLabel = `${enabled ? tConnector('disable') : tConnector('enable')}${label}`;
  const removeLabel = tConnector('delete', { p0: String(label) });
  return (
    <div className={styles.ruleActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="fouc-action"
            disabled={disabled}
            aria-label={onlyLabel}
            onClick={onOnly}
          >
            <Scan size={16} weight="bold" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="z-[90]">{onlyLabel}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="fouc-action"
            disabled={disabled}
            aria-label={toggleLabel}
            aria-pressed={!enabled}
            onClick={onToggle}
          >
            {enabled ? <Eye size={16} weight="bold" /> : <EyeSlash size={16} weight="bold" />}
          </button>
        </TooltipTrigger>
        <TooltipContent className="z-[90]">{toggleLabel}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="fouc-action"
            data-variant="destructive"
            disabled={disabled}
            aria-label={removeLabel}
            onClick={onRemove}
          >
            <X size={16} weight="bold" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="z-[90]">{removeLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
}
export function QueryRuleHandle({
  kind,
  index,
  count,
  disabled,
  onMove,
  drag,
  children,
}: {
  kind: 'filter' | 'sort';
  index: number;
  count: number;
  disabled: boolean;
  onMove: (target: number) => void;
  drag: QueryRuleDragHandle;
  children?: ReactNode;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const label = kind === 'filter' ? tConnector('condition') : tConnector('sort');
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          {...drag}
          type="button"
          className={`fouc-action ${styles.grip}`}
          title={tConnector('pressAndHoldToReorderClickForMoreOptionsSpace')}
          aria-label={tConnector('move', { p0: String(label), p1: String(index + 1) })}
          disabled={disabled}
          onClick={() => setOpen((value) => !value)}
        >
          <DotsSixVertical size={16} weight="bold" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className={styles.popoverMenu}
        data-table-query-menu=""
        density="compact"
        align="start"
      >
        <DropdownMenuItem disabled={disabled || index === 0} onSelect={() => onMove(index - 1)}>
          <ArrowUp />
          {tConnector('moveUp')}
          {label}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled || index === count - 1}
          onSelect={() => onMove(index + 1)}
        >
          <ArrowDown />
          {tConnector('moveDown')}
          {label}
        </DropdownMenuItem>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
