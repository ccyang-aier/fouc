'use client';

import { ArrowSquareOut, CheckCircle } from '@/components/icons';
import type { ChannelAttachment } from '@fouc/shared/chats';
import { useTranslation } from '@/lib/i18n';
import cardStyles from '@/components/ui/resource-card.module.css';
import { formatFileSize } from './channel-ui';
import { ChannelFileIcon } from './channel-file-icon';
import { messages } from './channels.messages';
import styles from './channels.module.css';

export function ChannelAttachmentCard({ attachment, onOpen }: {
  attachment: ChannelAttachment; onOpen: () => void;
}) {
  const { t, locale } = useTranslation(messages);
  const { name } = attachment;

  const extension = name.includes('.') ? name.split('.').pop()?.toUpperCase() : '';
  return <button type="button" className={`fouc-action ${cardStyles.card} ${styles.fileCard}`} onClick={onOpen} aria-label={`${t('preview')}: ${name}`}>
    <span className={styles.fileDetails}>
      <span className={styles.fileEmblem}><ChannelFileIcon attachment={attachment} size={28} className={styles.fileIcon} /></span>
      <span className={styles.fileInfo}>
        <strong title={name}>{name}</strong>
        <span className={styles.fileMeta}>
          <span className={styles.fileType}>{formatFileSize(attachment.size, locale)}{extension && <span className={styles.fileFormat}>{extension}</span>}</span>
          <span className={styles.metaDot} aria-hidden>·</span>
          <span className={styles.uploaded}><CheckCircle size={13} aria-hidden />{t('uploaded')}</span>
        </span>
      </span>
      <ArrowSquareOut className={styles.fileOpen} size={16} aria-hidden />
    </span>
  </button>;
}
