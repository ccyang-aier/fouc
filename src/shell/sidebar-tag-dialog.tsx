'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Trash, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { messages } from './i18n/navigation-sidebar.messages';
import type { SidebarTag } from './sidebar-tags';
import styles from './sidebar-sections.module.css';

export function SidebarTagDialog({ tag, tags, onSave, onRemove, onClose }: {
  tag: SidebarTag | null; tags: SidebarTag[]; onSave: (tag: SidebarTag) => boolean;
  onRemove: (id: string) => boolean; onClose: () => void;
}) {
  const { t } = useTranslation(messages);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [name, setName] = useState(tag?.name ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const duplicate = tags.some(item => item.id !== tag?.id && item.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector('input')?.focus();
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); if (name.trim() && !duplicate && onSave({ id: tag?.id ?? crypto.randomUUID(), name: name.trim() })) onClose(); }}>
      <header><h2 id={titleId}>{t(tag ? '编辑标签' : '新建标签')}</h2><button type="button" className={`fouc-action ${styles.action}`} onClick={onClose} aria-label={t('关闭')}><X size={16} /></button></header>
      <label className={styles.field}>{t('标签名称')}<input value={name} maxLength={40} placeholder={t('输入标签名称')} onChange={event => { setName(event.target.value); setConfirmDelete(false); }} />{duplicate && <span role="alert" className={styles.error}>{t('标签名称已存在')}</span>}{confirmDelete && <span role="alert" className={styles.error}>{t('再次点击删除以确认')}</span>}</label>
      <footer>{tag && <Button type="button" variant="ghost" data-variant="destructive" className={styles.delete} size="sm" onClick={() => { if (!confirmDelete) setConfirmDelete(true); else if (onRemove(tag.id)) onClose(); }}><Trash size={14} weight="duotone" />{t(confirmDelete ? '确认删除' : '删除标签')}</Button>}<Button type="button" variant="outline" size="sm" onClick={onClose}>{t('取消')}</Button><Button type="submit" size="sm" disabled={!name.trim() || duplicate}>{t('保存')}</Button></footer>
    </form>
  </dialog>;
}
