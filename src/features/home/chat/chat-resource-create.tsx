'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useAppAlert } from '@/components/app-alert-provider';
import { useTranslation } from '@/lib/i18n';
import { addComposerResource, type ComposerResource, type ComposerResourceKind } from '@/features/community/composer-catalog';
import { resourceMenuText, resourceMessages } from './chat-resource-messages';
import styles from './chat-resource-create.module.css';

export function ChatResourceCreate({ kind, onClose, onCreated }: {
  kind: ComposerResourceKind;
  onClose: () => void;
  onCreated: (resource: ComposerResource) => void;
}) {
  const { t, locale } = useTranslation(resourceMessages);
  const { notify } = useAppAlert();
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('研发');
  useEffect(() => { dialog.current?.showModal(); nameInput.current?.focus(); }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} className={styles.dialog}
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <form onSubmit={event => {
      event.preventDefault();
      if (!name.trim() || !description.trim()) return;
      onCreated(addComposerResource({ kind, name: name.trim(), description: description.trim(), author: t('creator'), category }));
      notify('success', t('created'));
      onClose();
    }}>
      <header><h2 id={titleId}>{t(resourceMenuText[kind].add)}</h2><Button type="button" variant="ghost" className={styles.close} aria-label={t('cancel')} onClick={onClose}><X size={16} /></Button></header>
      <div className={styles.body}>
        <p>{t('createHint')}</p>
        <label>{t('name')}<input ref={nameInput} required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder={t('namePlaceholder')} /></label>
        <label>{t('resourceCategory')}<select value={category} onChange={event => setCategory(event.target.value)}>
          {(['研发', '办公', '数据', '内容'] as const).map((value, index) => <option key={value} value={value}>{locale === 'zh-CN' ? value : ['Development', 'Office', 'Data', 'Content'][index]}</option>)}
        </select></label>
        <label>{t('description')}<textarea required maxLength={600} rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder={t('descriptionPlaceholder')} /></label>
      </div>
      <footer><Button type="button" variant="outline" onClick={onClose}>{t('cancel')}</Button><Button type="submit" disabled={!name.trim() || !description.trim()}>{t('save')}</Button></footer>
    </form>
  </dialog>;
}
