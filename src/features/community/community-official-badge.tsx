'use client';

import { SealCheck } from '@phosphor-icons/react';
import { useTranslation } from '@/lib/i18n/react';
import { cn } from '@/lib/utils';
import { messages } from './i18n/community-official-badge.messages';
import styles from './community-official-badge.module.css';

/** 官方认证是资源身份信息，独立于操作控件的黑白灰选中态。 */
export function CommunityOfficialBadge({ className }: { className?: string }) {
  const { t } = useTranslation(messages);
  return (
    <SealCheck
      role="img"
      aria-label={t('官方资源')}
      weight="fill"
      className={cn('size-3.5 shrink-0', styles.badge, className)}
    />
  );
}
