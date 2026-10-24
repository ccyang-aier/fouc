'use client';

import { ArrowSquareOut, CheckCircle, File, FileCode, FilePdf, FileText, ImageSquare } from '@phosphor-icons/react';
import type { ChannelAttachment } from '@fouc/shared/chats';
import { useTranslation } from '@/lib/i18n';
import cardStyles from '@/components/ui/resource-card.module.css';
import { formatFileSize } from './channel-ui';
import { messages } from './channels.messages';
import styles from './channels.module.css';

export function ChannelAttachmentCard({ attachment, onOpen }: {
  attachment: ChannelAttachment; onOpen: () => void;
}) {
  const { t, locale } = useTranslation(messages);
  const { mime, name } = attachment;

  const extension = name.includes('.') ? name.split('.').pop()?.toUpperCase() : '';
  const Icon = mime.includes('pdf') ? FilePdf : /json|javascript|typescript/.test(mime) ? FileCode : /text|word|document/.test(mime) ? FileText : mime.startsWith('image/') ? ImageSquare : File;
  return <button type="button" className={`fouc-action ${cardStyles.card} ${styles.fileCard}`} onClick={onOpen} aria-label={`${t('preview')}: ${name}`}>
    <span className={styles.fileDetails}>
      <Icon className={styles.fileIcon} size={30} weight="fill" aria-hidden />
      <span className={styles.fileInfo}>
        <strong title={name}>{name}</strong>
        <span className={styles.fileMeta}>
          <span className={styles.fileType}>{formatFileSize(attachment.size, locale)}{extension && <> {extension}</>}</span>
          <span className={styles.metaDot} aria-hidden>·</span>
          <span className={styles.uploaded}><CheckCircle size={13} weight="fill" aria-hidden />{t('uploaded')}</span>
        </span>
      </span>
      <ArrowSquareOut className={styles.fileOpen} size={16} aria-hidden />
    </span>
  </button>;
}
