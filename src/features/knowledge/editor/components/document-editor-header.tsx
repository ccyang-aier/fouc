'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import { BookOpen, List, Plus, Star } from '@phosphor-icons/react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DocumentMoreMenu, type DocumentMenuActions } from './document-more-menu';
import styles from './document-editor-header.module.css';

export function DocumentEditorHeader({
  editor, collectionName, title, avatarName, starred, onBack, onToggleSidebar,
  onToggleStar, onCreateDocument, canCreateDocument = true, shareDescription, menuActions, presence,
}: {
  editor: Editor | null;
  collectionName: string;
  title: string;
  avatarName: string;
  starred: boolean;
  onBack: () => void;
  onToggleSidebar: () => void;
  onToggleStar: () => void;
  onCreateDocument: () => void;
  canCreateDocument?: boolean;
  shareDescription: string;
  menuActions: DocumentMenuActions;
  presence?: ReactNode;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(`${title || '无标题文档'}\n\n${editor?.getText() ?? ''}`);
      setCopyState('copied');
    } catch { setCopyState('failed'); }
  };

  return <header className={styles.header}>
    <div className={styles.leading}>
      <button type="button" className={styles.libraryButton} aria-label="返回文档列表" title="返回文档列表" onClick={onBack}>
        <BookOpen aria-hidden size={18} weight="duotone" />
      </button>
      <button type="button" className={styles.collectionName} onClick={onBack} title={collectionName}>{collectionName}</button>
      <span className={styles.divider} aria-hidden>/</span>
      <button type="button" className={styles.iconButton} aria-label="打开知识库导航" title="打开知识库导航" onClick={onToggleSidebar}><List aria-hidden size={16} weight="bold" /></button>
      <button type="button" className={styles.iconButton} aria-label={starred ? '取消星标' : '添加星标'} title={starred ? '取消星标' : '添加星标'} onClick={onToggleStar}><Star aria-hidden size={16} weight={starred ? 'fill' : 'bold'} /></button>
    </div>
    <div className={styles.actions}>
      {presence ?? <span className={styles.avatar} title={avatarName || '我'}>{Array.from(avatarName || '我')[0]?.toUpperCase()}</span>}
      <DropdownMenu onOpenChange={(open) => { if (open) setCopyState('idle'); }}>
        <DropdownMenuTrigger asChild><button type="button" className={`${styles.outlineButton} ${styles.shareButton}`}>分享</button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.shareMenu}>
          <div className={styles.shareTitle}>分享文档</div>
          <p className={styles.shareDescription}>{shareDescription}</p>
          <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void copyContent(); }}>复制标题和正文</DropdownMenuItem>
          {copyState !== 'idle' ? <p role="status" className={styles.shareStatus}>{copyState === 'copied' ? '已复制到剪贴板' : '复制失败，请检查浏览器权限'}</p> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button" aria-label="新建文档" className={`${styles.outlineButton} ${styles.createButton}`} disabled={!canCreateDocument} title={canCreateDocument ? '新建文档' : '没有创建文档的权限'} onClick={onCreateDocument}><Plus aria-hidden size={20} weight="bold" /><span className={styles.createLabel}>新建文档</span></button>
      <DocumentMoreMenu editor={editor} title={title} starred={starred} onToggleStar={onToggleStar} actions={menuActions} />
    </div>
  </header>;
}
