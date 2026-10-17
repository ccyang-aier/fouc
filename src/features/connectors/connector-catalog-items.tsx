'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './connector-catalog-items.messages';
import Image from 'next/image';
import { Check } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import styles from '@/components/ui/resource-card.module.css';
import { connectorCategoryLabel, connectorPresentation, type Connector } from './connectors-data';
type ConnectorItemProps = {
  connector: Connector;
  onConnect: () => void;
  onDisconnect: () => void;
  onOpen: () => void;
};
function ConnectorLogo({
  connector,
  size = 'large',
}: {
  connector: Connector;
  size?: 'small' | 'large';
}) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[color-mix(in_srgb,var(--line)_72%,transparent)] bg-white',
        size === 'large' ? 'size-11' : 'size-8 rounded-[7px]',
        connector.id === 'connector-shimo' && 'bg-[#252a31]',
      )}
    >
      <Image
        src={connector.logo}
        alt=""
        fill
        sizes={size === 'large' ? '44px' : '32px'}
        className={cn('object-contain', size === 'large' ? 'p-[7px]' : 'p-[5px]')}
      />
    </span>
  );
}
function ConnectorAction({ connector, onConnect, onDisconnect }: ConnectorItemProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const presentation = connectorPresentation(connector, locale);
  if (connector.connected) {
    return (
      <button
        type="button"
        aria-label={tConnector('disconnect', { p0: String(presentation.name) })}
        onClick={(event) => {
          event.stopPropagation();
          onDisconnect();
        }}
        className="group/connected relative z-10 flex h-[29px] min-w-[74px] items-center justify-center overflow-hidden rounded-[6px] border border-[color-mix(in_srgb,var(--ok-ink)_22%,var(--line))] bg-[color-mix(in_srgb,var(--ok-ink)_6%,var(--panel))] px-2 text-[10px] font-medium outline-none transition-colors hover:border-[color-mix(in_srgb,var(--err-ink)_36%,var(--line))] hover:bg-[color-mix(in_srgb,var(--err-ink)_5%,var(--panel))] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <span className="flex items-center gap-1.5 text-[var(--ok-ink)] transition-opacity group-hover/connected:opacity-0 group-focus-visible/connected:opacity-0">
          <Check className="size-3" weight="bold" />
          {tConnector('connected')}
        </span>
        <span className="absolute inset-0 flex items-center justify-center text-[var(--err-ink)] opacity-0 transition-opacity group-hover/connected:opacity-100 group-focus-visible/connected:opacity-100">
          {tConnector('disconnect3')}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onConnect();
      }}
      className="relative z-10 flex h-[29px] min-w-[66px] items-center justify-center rounded-[6px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] px-3 text-[10.5px] font-semibold text-[var(--accent-ink)] outline-none transition-[background-color,border-color,color,transform] hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] active:translate-y-px focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      {tConnector('connect')}
    </button>
  );
}
export function ConnectorCard(props: ConnectorItemProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const { connector, onOpen } = props;
  const presentation = connectorPresentation(connector, locale);
  return (
    <article
      className={cn(
        'group relative flex min-h-[174px] cursor-pointer flex-col p-4 outline-none',
        styles.card,
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={tConnector('openDetails', { p0: String(presentation.name) })}
        className="absolute inset-0 z-0 rounded-[8px] outline-none"
      />
      <div className="flex min-w-0 items-start gap-3">
        <ConnectorLogo connector={connector} />
        <div className="min-w-0 pt-0.5">
          <h2 className="truncate text-[13px] font-semibold tracking-[-0.015em] text-[var(--ink)]">
            {presentation.name}
          </h2>
          <p className="mt-1 text-[9.5px] text-[var(--muted)]">
            {connectorCategoryLabel(connector.category, locale)}
          </p>
        </div>
        {connector.connected ? (
          <span
            className="ml-auto mt-1 size-1.5 shrink-0 rounded-full bg-[var(--ok-ink)]"
            aria-label={tConnector('connected')}
          />
        ) : null}
      </div>

      <p className="mt-3 line-clamp-2 min-h-9 text-[10.5px] leading-[18px] text-[var(--ink-soft)]">
        {presentation.description}
      </p>

      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[9.5px] tabular-nums text-[var(--muted)]">
          <span className="font-medium text-[var(--ink-soft)]">v{connector.version}</span>
          <span aria-hidden className="text-[var(--line-strong)]">
            ·
          </span>
          <span>{tConnector('updatedAt', { time: presentation.updated })}</span>
        </div>
        <ConnectorAction {...props} />
      </div>
    </article>
  );
}
export function ConnectorRow(props: ConnectorItemProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const { connector, onOpen } = props;
  const presentation = connectorPresentation(connector, locale);
  return (
    <article className="group relative grid min-w-[780px] cursor-pointer grid-cols-[minmax(168px,1fr)_96px_minmax(230px,2.2fr)_64px_92px_84px] items-center gap-4 border-b border-[var(--line)] px-3 py-2.5 outline-none transition-colors hover:bg-[var(--surface-subtle)] focus-within:bg-[color-mix(in_srgb,var(--accent)_4%,transparent)]">
      <button
        type="button"
        onClick={onOpen}
        aria-label={tConnector('openDetails', { p0: String(presentation.name) })}
        className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
      />
      <div className="flex min-w-0 items-center gap-3">
        <ConnectorLogo connector={connector} size="small" />
        <p className="truncate text-[12px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {presentation.name}
        </p>
      </div>
      <span className="truncate text-[10px] text-[var(--muted-strong)]">
        {connectorCategoryLabel(connector.category, locale)}
      </span>
      <p className="truncate text-[10.5px] leading-5 text-[var(--ink-soft)]">
        {presentation.description}
      </p>
      <span className="whitespace-nowrap text-[9.5px] font-medium tabular-nums text-[var(--ink-soft)]">
        v{connector.version}
      </span>
      <span className="whitespace-nowrap text-[9.5px] tabular-nums text-[var(--muted)]">
        {presentation.updated}
      </span>
      <ConnectorAction {...props} />
    </article>
  );
}
