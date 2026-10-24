'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowSquareOut, CheckCircle, File, FileCode, FilePdf, FileText, ImageSquare } from '@phosphor-icons/react';
import type { ChannelAttachment } from '@fouc/shared/chats';
import { useTranslation } from '@/lib/i18n';
import cardStyles from '@/components/ui/resource-card.module.css';
import { channelClient } from './channel-client';
import { formatFileSize } from './channel-ui';
import { messages } from './channels.messages';
import styles from './channels.module.css';

export function ChannelAttachmentCard({ attachment, projectId, channelId, onOpen }: {
  attachment: ChannelAttachment; projectId: string; channelId: string; onOpen: () => void;
}) {
  const { t, locale } = useTranslation(messages);
  const [preview, setPreview] = useState<{ id: string; url: string } | null>(null);
  const { id, mime, messageId, name } = attachment;
  const isImage = /^image\/(png|jpeg|gif|webp|avif)$/.test(mime);
  const imageUrl = preview?.id === id ? preview.url : null;
  useEffect(() => {
    if (!isImage) return;
    let active = true;
    let resource: string | undefined;
    void channelClient.attachment(projectId, channelId, { id, messageId }).then(blob => {
      if (active) { resource = URL.createObjectURL(blob); setPreview({ id, url: resource }); }
    }).catch(() => {});
    return () => { active = false; if (resource) URL.revokeObjectURL(resource); };
  }, [id, isImage, messageId, projectId, channelId]);

  const extension = name.includes('.') ? name.split('.').pop()?.toUpperCase() : '';
  const Icon = mime.includes('pdf') ? FilePdf : /json|javascript|typescript/.test(mime) ? FileCode : /text|word|document/.test(mime) ? FileText : mime.startsWith('image/') ? ImageSquare : File;
  return <button type="button" className={`fouc-action ${cardStyles.card} ${styles.fileCard}`} onClick={onOpen} aria-label={`${t('preview')}: ${name}`}>
    {isImage && <span className={styles.imagePreview}>
      {imageUrl ? <Image src={imageUrl} alt={name} width={640} height={420} unoptimized /> : <ImageSquare size={30} weight="light" aria-hidden />}
    </span>}
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
