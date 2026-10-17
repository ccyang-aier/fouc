'use client';

import { ArrowLeft, ArrowRight, ClipboardText, Minus, Square, X } from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { KnowledgeNotificationBell } from '@/features/knowledge/notifications/components/notification-bell';
import { useTranslation } from '@/lib/i18n';
import { performWindowAction } from '@/lib/tauri-window';
import { GlobalSearch } from './global-search';
import type { useWorkbenchView, WorkbenchView } from './workbench-view';
import { messages } from './i18n/system-bar.messages';
import styles from './system-bar.module.css';

export function SystemBar({ onNavigate, navigation }: {
  onNavigate: (view: WorkbenchView) => void;
  navigation: ReturnType<typeof useWorkbenchView>[3];
}) {
  const { t } = useTranslation(messages);
  return <header data-tauri-drag-region className={styles.bar}>
    <nav aria-label={t('页面历史')} className={styles.actions} data-tauri-drag-region="false">
      <Tooltip><TooltipTrigger asChild><button type="button" className={`fouc-action ${styles.button}`} aria-label={t('后退')} disabled={!navigation.canGoBack} onClick={navigation.goBack}><ArrowLeft size={19} aria-hidden /></button></TooltipTrigger><TooltipContent side="bottom">{t('后退')}</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><button type="button" className={`fouc-action ${styles.button}`} aria-label={t('前进')} disabled={!navigation.canGoForward} onClick={navigation.goForward}><ArrowRight size={19} aria-hidden /></button></TooltipTrigger><TooltipContent side="bottom">{t('前进')}</TooltipContent></Tooltip>
    </nav>
    <div className={`${styles.actions} ${styles.trailing}`} data-tauri-drag-region="false">
      <GlobalSearch className={styles.button} onNavigate={onNavigate} />
      <KnowledgeNotificationBell onOpenWorkbench={() => onNavigate('knowledge')} />
      <Tooltip><TooltipTrigger asChild><button type="button" className={`fouc-action ${styles.button}`} aria-label={t('任务')} onClick={() => onNavigate('tasks')}><ClipboardText size={17} weight="duotone" aria-hidden /></button></TooltipTrigger><TooltipContent side="bottom">{t('任务')}</TooltipContent></Tooltip>
      <span aria-hidden className={styles.separator} />
      <WindowControl label={t('最小化')} icon={Minus} onClick={() => void performWindowAction('minimize')} />
      <WindowControl label={t('最大化或还原')} icon={Square} onClick={() => void performWindowAction('toggleMaximize')} />
      <WindowControl label={t('关闭')} icon={X} onClick={() => void performWindowAction('close')} danger />
    </div>
  </header>;
}

function WindowControl({ label, icon: Icon, onClick, danger }: { label: string; icon: typeof Minus; onClick: () => void; danger?: boolean }) {
  return <button type="button" className={`fouc-action ${styles.button}`} aria-label={label} title={label} onClick={onClick} data-variant={danger ? 'destructive' : undefined}><Icon size={14} aria-hidden /></button>;
}
