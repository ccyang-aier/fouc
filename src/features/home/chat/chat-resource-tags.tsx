'use client';

import { X } from '@phosphor-icons/react';
import { resourceKindIcons } from './chat-resource-icons';
import { useTranslation } from '@/lib/i18n';
import type { ComposerResourceReference } from '@/features/community/composer-catalog';
import { resourceMessages } from './chat-resource-messages';
import styles from './chat-resource-menu.module.css';
import tones from './chat-resource-tones.module.css';

export function ChatResourceTags({ resources, onRemove }: {
  resources: ComposerResourceReference[];
  onRemove?: (resource: ComposerResourceReference) => void;
}) {
  const { t } = useTranslation(resourceMessages);
  if (!resources.length) return null;
  return <div className={styles.selectedResources} data-readonly={!onRemove || undefined} role="group" aria-label={t('selectedResources')}>
    {resources.map(resource => {
      const Icon = resourceKindIcons[resource.kind];
      return <span key={`${resource.kind}:${resource.id}`} className={`${tones.tone} ${styles.resourceTag}`} data-resource-kind={resource.kind}>
        <Icon size={14} aria-hidden="true" /><span>{resource.name}</span>
        {onRemove ? <button type="button" className={`fouc-action ${styles.removeTag}`} aria-label={t('remove', { name: resource.name })}
          onPointerDown={event => event.preventDefault()} onClick={() => onRemove(resource)}><X size={11} /></button> : null}
      </span>;
    })}
  </div>;
}
