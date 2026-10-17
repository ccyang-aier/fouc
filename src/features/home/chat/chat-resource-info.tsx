'use client';

import {
  Binoculars, BracketsCurly, Browser, CalendarDots, ChartBar, ChartPieSlice, ChatsCircle,
  Checks, CheckSquare, Code, Database, EnvelopeSimple, FigmaLogo, FileText, FolderSimple,
  GitBranch, GitDiff, Lightbulb, MagnifyingGlass, Megaphone, NotePencil, PlugsConnected,
  PresentationChart, ShieldCheck, Star, StarHalf, TextT,
} from '@phosphor-icons/react';
import { TooltipContent } from '@/components/ui/tooltip';
import { SkillIcon } from '@/components/icons/skill-icon';
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
  const Icon = resourceIcons[resource.id as keyof typeof resourceIcons] ?? (resource.kind === 'mcp' ? PlugsConnected : null);
  return Icon ? <Icon className={styles.resourceIcon} size={16} weight="duotone" data-static-color aria-hidden="true" />
    : <SkillIcon className={styles.resourceIcon} data-static-color aria-hidden="true" />;
}

export function ChatResourceInfo({ resource, side, onEscape }: {
  resource: ComposerResource;
  side: 'top' | 'bottom';
  onEscape: () => void;
}) {
  const { t } = useTranslation(resourceMessages);
  const rating = resource.rating;
  const stars = Math.round((rating ?? 0) * 2) / 2;

  return <TooltipContent className={styles.infoCard} side={side} sideOffset={8} collisionPadding={12}
    onEscapeKeyDown={event => { event.preventDefault(); onEscape(); }}>
    <div className={styles.infoHeading}>
      <ResourceIcon resource={resource} />
      <h3>{resource.name}</h3>
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
  </TooltipContent>;
}
