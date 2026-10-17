'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import {
  Binoculars, BookOpenText, BracketsCurly, Browser, CalendarDots, ChartBar, ChartPieSlice, ChatsCircle,
  Checks, CheckSquare, Code, Database, EnvelopeSimple, FigmaLogo, FileText, FolderSimple,
  GitBranch, GitDiff, Lightbulb, MagnifyingGlass, Megaphone, NotePencil, PlugsConnected,
  PresentationChart, ShieldCheck, Star, StarHalf, TextT, X,
} from '@phosphor-icons/react';
import { useTranslation } from '@/lib/i18n';
import type { ComposerResource } from '@/features/community/composer-catalog';
import { resourceMessages } from './chat-resource-messages';
import styles from './chat-resource-menu.module.css';

const resourceIcons = {
  'builtin-research': MagnifyingGlass, 'builtin-documents': FileText, 'builtin-code': Code,
  'skill-review': GitDiff, 'skill-apiread': BracketsCurly, 'skill-unittest': CheckSquare,
  'skill-depaudit': ShieldCheck, 'skill-regex': TextT, 'skill-slides': PresentationChart,
  'skill-weekly': CalendarDots, 'skill-minutes': NotePencil, 'skill-email': EnvelopeSimple,
  'skill-brainstorm': Lightbulb, 'skill-release-note': Megaphone, 'skill-sql': Database,
  'skill-validation': Checks, 'skill-competitor': Binoculars, 'skill-attribution': ChartPieSlice, 'skill-chart': ChartBar,
  'mcp-github': GitBranch, 'mcp-browser': Browser, 'mcp-filesystem': FolderSimple, 'mcp-notion': FileText,
  'mcp-postgres': Database, 'mcp-figma': FigmaLogo, 'mcp-search': MagnifyingGlass, 'mcp-slack': ChatsCircle,
};

export function ResourceIcon({ resource }: { resource: ComposerResource }) {
  const Icon = resourceIcons[resource.id as keyof typeof resourceIcons] ?? (resource.kind === 'mcp' ? PlugsConnected : BookOpenText);
  return <Icon className={styles.resourceIcon} size={16} data-static-color aria-hidden="true" />;
}

export function ChatResourceInfo({ resource, anchor, onClose }: {
  resource: ComposerResource;
  anchor: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const { t } = useTranslation(resourceMessages);
  const card = useRef<HTMLDivElement>(null);
  const rating = resource.rating;
  const stars = Math.round((rating ?? 0) * 2) / 2;
  useLayoutEffect(() => {
    const panel = card.current;
    const menu = anchor.current;
    if (!panel || !menu) return;
    function position() {
      if (!panel || !menu) return;
      const bounds = menu.getBoundingClientRect();
      const width = Math.min(264, window.innerWidth - 24);
      const right = window.innerWidth - bounds.right;
      const left = right >= width + 8 ? bounds.right + 8 : bounds.left >= width + 8 ? bounds.left - width - 8
        : Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12));
      panel.style.width = `${width}px`;
      panel.style.left = `${left - bounds.left}px`;
      panel.style.top = `${Math.max(12, Math.min(bounds.top, window.innerHeight - panel.offsetHeight - 12)) - bounds.top}px`;
    }
    position();
    const observer = new ResizeObserver(position);
    observer.observe(panel);
    observer.observe(menu);
    const placement = new MutationObserver(position);
    if (menu.parentElement) placement.observe(menu.parentElement, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', position);
    return () => { observer.disconnect(); placement.disconnect(); window.removeEventListener('resize', position); };
  }, [anchor, resource.id]);

  return <div ref={card} className={styles.infoCard} role="region" aria-label={t('details', { name: resource.name })}>
    <div className={styles.infoHeading}>
      <ResourceIcon resource={resource} />
      <h3>{resource.name}</h3>
      <button type="button" className={`fouc-action ${styles.closeInfo}`} aria-label={t('close')} onClick={onClose}><X size={14} /></button>
    </div>
    <p className={styles.infoDescription}>{resource.description}</p>
    <dl className={styles.infoMeta}>
      <div><dt>{t('author')}</dt><dd>{resource.author}</dd></div>
      <div><dt>{t('updated')}</dt><dd>{resource.updated}</dd></div>
    </dl>
    <div className={styles.rating}>
      <span>{t('recommendation')}</span>
      {rating === null ? <span className={styles.unrated}>{t('unrated')}</span> : <span className={styles.stars} aria-label={`${rating} / 5`}>
        {Array.from({ length: 5 }, (_, index) => {
          const Icon = stars - index === 0.5 ? StarHalf : Star;
          return <Icon key={index} size={13} weight={index < stars ? 'fill' : 'regular'} aria-hidden="true" />;
        })}<strong>{rating.toFixed(1)}</strong>
      </span>}
    </div>
  </div>;
}
