'use client';

import { BookOpenText, PlugsConnected, X } from '@phosphor-icons/react';
import { useTranslation } from '@/lib/i18n';
import type { ComposerResourceReference } from '@/features/community/composer-catalog';
import { resourceMessages } from './chat-resource-messages';
import styles from './chat-resource-menu.module.css';

export function ChatResourceTags({ resources, onRemove }: {
  resources: ComposerResourceReference[];
  onRemove?: (resource: ComposerResourceReference) => void;
}) {
  const { t } = useTranslation(resourceMessages);
  if (!resources.length) return null;
  return <div className={styles.selectedResources}>
    {resources.map(resource => {
      const Icon = resource.kind === 'skills' ? BookOpenText : PlugsConnected;
      return <span key={`${resource.kind}:${resource.id}`} className={styles.resourceTag}><Icon size={12} aria-hidden="true" /><span>{resource.name}</span>
        {onRemove ? <button type="button" className={`fouc-action ${styles.removeTag}`} aria-label={t('remove', { name: resource.name })}
          onPointerDown={event => event.preventDefault()} onClick={() => onRemove(resource)}><X size={11} /></button> : null}
      </span>;
    })}
  </div>;
}
