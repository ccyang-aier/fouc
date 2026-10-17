"use client";

import { Browser, Monitor, PresentationChart, Intersect, PenNib, MagnifyingGlass, ChartBar, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ChatText } from './chat-messages';
import type { ChatTaskKind } from './chat-types';
import styles from './chat-quick-actions.module.css';

const tasks = {
  website: { icon: Browser, label: 'buildWebsite', tag: 'websiteTag' },
  desktop: { icon: Monitor, label: 'developDesktop', tag: 'desktopTag' },
  slides: { icon: PresentationChart, label: 'createSlides', tag: 'slidesTag' },
  design: { icon: Intersect, label: 'designTask', tag: 'designTask' },
  writing: { icon: PenNib, label: 'writingTask', tag: 'writingTask' },
  research: { icon: MagnifyingGlass, label: 'researchTask', tag: 'researchTask' },
  data: { icon: ChartBar, label: 'dataTask', tag: 'dataTask' },
} as const;
const primaryTasks = ['website', 'desktop', 'slides', 'design'] as const;
const moreTasks = ['writing', 'research', 'data'] as const;

function animatePress(button: HTMLButtonElement) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  button.animate([
    { transform: 'scale(1)' },
    { transform: 'scale(0.95)', offset: 0.35 },
    { transform: 'scale(1)' },
  ], { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
}

export function ChatQuickActions({ value, onSelect, t }: {
  value: ChatTaskKind | null;
  onSelect: (task: ChatTaskKind) => void;
  t: ChatText;
}) {
  return <div className={styles.actions} role="group" aria-label={t('quickActions')}>
    {primaryTasks.map(task => {
      const { icon: Icon, label } = tasks[task];
      return <Button key={task} type="button" variant="outline" className={styles.action}
        aria-pressed={value === task} onClick={event => {
          animatePress(event.currentTarget);
          onSelect(task);
        }}>
        <Icon size={17} aria-hidden="true" />{t(label)}
      </Button>;
    })}
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className={styles.action}
          data-selected={moreTasks.some(task => task === value)} onClick={event => animatePress(event.currentTarget)}>{t('moreTasks')}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6}>
        {moreTasks.map(task => {
          const { icon: Icon, label } = tasks[task];
          return <DropdownMenuItem key={task} onSelect={() => onSelect(task)}>
            <Icon size={16} aria-hidden="true" />{t(label)}
          </DropdownMenuItem>;
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}

export function ChatTaskTag({ task, onRemove, t }: {
  task: ChatTaskKind;
  onRemove?: () => void;
  t: ChatText;
}) {
  const label = t(tasks[task].tag);
  return onRemove ? <Button type="button" variant="ghost" className={styles.tag}
    aria-label={t('removeTask', { task: label })} onPointerDown={event => event.preventDefault()} onClick={onRemove}>
    <X size={12} aria-hidden="true" /><span>{label}</span>
  </Button> : <span className={`${styles.tag} ${styles.messageTag}`}>{label}</span>;
}
