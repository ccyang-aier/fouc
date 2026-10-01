'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import { FolderSimple, List, Plus, ShareNetwork } from '@phosphor-icons/react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DocumentMoreMenu, type DocumentMenuActions } from './document-more-menu';
import { DocumentStarButton } from './document-star-button';
import { useDocumentNavigation } from '../document-tools';
import styles from './document-editor-header.module.css';

export function DocumentEditorHeader({
  editor, folderName, title, avatarName, starred, onOpenSidebar,
  onToggleStar, onCreateDocument, canCreateDocument = true, shareDescription, menuActions, presence,
}: {
  editor: Editor | null;
  folderName: string;
  title: string;
  avatarName: string;
  starred: boolean;
  onOpenSidebar: () => void;
  onToggleStar: () => void;
  onCreateDocument: () => void;
  canCreateDocument?: boolean;
  shareDescription: string;
  menuActions: DocumentMenuActions;
  presence?: ReactNode;
}) {
  const navigation = useDocumentNavigation();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(`${title || '无标题文档'}\n\n${editor?.getText() ?? ''}`);
      setCopyState('copied');
    } catch { setCopyState('failed'); }
  };

  return <header className={styles.header}>
    <div className={styles.leading}>
      <button type="button" className={styles.folderButton} aria-label={`打开所属文件夹：${folderName}`} onClick={onOpenSidebar} title={`展开知识库侧栏 · ${folderName}`}>
        <FolderSimple aria-hidden size={18} weight="duotone" />
        <span className={styles.folderName}>{folderName}</span>
      </button>
      <span className={styles.divider} aria-hidden>/</span>
      <button ref={navigation?.outlineTrigger} type="button" className={styles.iconButton} aria-label="文档目录" title={navigation?.outlineOpen ? '收起目录' : '展开目录'} aria-expanded={navigation?.outlineOpen ?? false} aria-controls={navigation?.outlineId} disabled={!navigation?.onToggleOutline} onClick={navigation?.onToggleOutline}><List aria-hidden size={16} weight="bold" /></button>
      <DocumentStarButton starred={starred} onToggle={onToggleStar} />
    </div>
    <div className={styles.actions}>
      <span className={styles.presence}>{presence ?? <span className={styles.avatar} title={avatarName || '我'}>{Array.from(avatarName || '我')[0]?.toUpperCase()}</span>}</span>
      <DropdownMenu onOpenChange={(open) => { if (open) setCopyState('idle'); }}>
        <DropdownMenuTrigger asChild><button type="button" aria-label="分享" className={`${styles.outlineButton} ${styles.shareButton}`}><ShareNetwork aria-hidden size={16} /><span className={styles.shareLabel}>分享</span></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.shareMenu}>
          <div className={styles.shareTitle}>分享文档</div>
          <p className={styles.shareDescription}>{shareDescription}</p>
          <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void copyContent(); }}>复制标题和正文</DropdownMenuItem>
          {copyState !== 'idle' ? <p role="status" className={styles.shareStatus}>{copyState === 'copied' ? '已复制到剪贴板' : '复制失败，请检查浏览器权限'}</p> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button" aria-label="新建文档" className={`${styles.outlineButton} ${styles.createButton}`} disabled={!canCreateDocument} title={canCreateDocument ? '新建文档' : '没有创建文档的权限'} onClick={onCreateDocument}><Plus aria-hidden size={16} weight="bold" /><span className={styles.createLabel}>新建</span></button>
      <DocumentMoreMenu editor={editor} title={title} starred={starred} onToggleStar={onToggleStar} actions={menuActions} />
    </div>
  </header>;
}
