'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import { Bell, ChatCircleDots, ClockCounterClockwise, Copy, DotsThree, DownloadSimple, FileArrowUp, FileCode, FilePdf, FileText, LinkSimple, LockSimple, MagnifyingGlass, MarkdownLogo, Printer, PushPin, SplitHorizontal, Trash, Presentation, FolderSimple, SquaresFour } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ModalDialog } from '../../organization/ui';
import { AppAlert } from '@/components/app-alert';
import { useAppAlert } from '@/components/app-alert-provider';
import { documentLink, type DocumentLinkTarget } from '../document-link';
import { useDocumentNavigation } from '../document-tools';
import { DocumentAppearanceMenu } from './document-appearance-menu';
import { DocumentStarMenuItem } from './document-star-menu-item';
import { documentContent, downloadDocument, printDocument, type ContentFormat } from './document-content-actions';
import styles from './document-more-menu.module.css';
import headerStyles from './document-editor-header.module.css';

export type DocumentMenuActions = {
  target: DocumentLinkTarget;
  onComments?: () => void;
  onHistory?: () => void;
  onDelete?: () => Promise<void> | void;
};

function ReservedItem({ children, icon }: { children: string; icon: ReactNode }) {
  return <DropdownMenuItem disabled className={styles.item} title="功能待实现"><span className={styles.icon}>{icon}</span>{children}<span className={styles.pending}>待实现</span></DropdownMenuItem>;
}

export function DocumentMoreMenu({ editor, title, starred, onToggleStar, actions }: {
  editor: Editor | null; title: string; starred: boolean; onToggleStar: () => void; actions: DocumentMenuActions;
}) {
  const navigation = useDocumentNavigation();
  const { notify } = useAppAlert();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const action = async (work: () => Promise<void> | void, success: string, failure?: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try { await work(); notify('success', success); }
    catch (error) { notify('error', failure ? (error instanceof Error ? error.message : failure) : '操作失败，请检查浏览器权限或稍后重试'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const copy = (format: ContentFormat | 'link') => action(async () => {
    const content = format === 'link' ? documentLink(window.location.href, actions.target) : await documentContent(editor!, title, format);
    await navigator.clipboard.writeText(content);
  }, '已复制到剪贴板');
  const exportContent = (format: 'markdown' | 'html') => action(async () => downloadDocument(await documentContent(editor!, title, format), title, format), '已导出文档');
  const exportPdf = () => action(async () => {
    notify('info', '正在生成 PDF…', undefined, { duration: 0 });
    const { exportDocumentPdf } = await import('./document-pdf-export');
    await exportDocumentPdf(editor!, title);
  }, '已导出 PDF', 'PDF 导出失败，请稍后重试');

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button type="button" className={headerStyles.moreButton} aria-label="更多文档操作" title="更多文档操作"><DotsThree aria-hidden size={24} weight="bold" /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={styles.menu}>
        <DropdownMenuGroup aria-label="内容与外观">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={styles.item}><Copy aria-hidden />复制</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className={styles.submenu}>
              <DropdownMenuItem className={styles.item} disabled={busy} onSelect={() => void copy('link')}><LinkSimple aria-hidden />复制为链接</DropdownMenuItem>
              <DropdownMenuItem className={styles.item} disabled={!editor || busy} onSelect={() => void copy('text')}><FileText aria-hidden />复制为文本</DropdownMenuItem>
              <DropdownMenuItem className={styles.item} disabled={!editor || busy} onSelect={() => void copy('markdown')}><MarkdownLogo aria-hidden />复制为 Markdown</DropdownMenuItem>
              <DropdownMenuItem className={styles.item} disabled={!editor || busy} onSelect={() => void copy('html')}><FileCode aria-hidden />复制为 HTML</DropdownMenuItem>
              {actions.target.source === 'local' ? <p className={styles.hint}>本机链接仅在保存该文档的浏览器中可访问。</p> : null}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DocumentAppearanceMenu triggerClassName={styles.item} />
          <DropdownMenuItem className={styles.item} disabled={!editor || !navigation} onSelect={navigation?.onPresent}><Presentation aria-hidden />演示</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup aria-label="关注与协作">
          <DocumentStarMenuItem className={styles.item} starred={starred} onToggleStar={onToggleStar} />
          <ReservedItem icon={<Bell aria-hidden />}>订阅</ReservedItem>
          <ReservedItem icon={<LockSimple aria-hidden />}>权限</ReservedItem>
          <ReservedItem icon={<SquaresFour aria-hidden />}>模板化</ReservedItem>
          {actions.onComments ? <DropdownMenuItem className={styles.item} onSelect={actions.onComments}><ChatCircleDots aria-hidden />评论</DropdownMenuItem> : <ReservedItem icon={<ChatCircleDots aria-hidden />}>评论</ReservedItem>}
          {actions.onHistory ? <DropdownMenuItem className={styles.item} onSelect={actions.onHistory}><ClockCounterClockwise aria-hidden />历史记录</DropdownMenuItem> : <ReservedItem icon={<ClockCounterClockwise aria-hidden />}>历史记录</ReservedItem>}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup aria-label="导入与输出">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={styles.item}><DownloadSimple aria-hidden />导出</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className={styles.submenu}>
              <DropdownMenuItem className={styles.item} disabled={!editor || busy} onSelect={() => void exportContent('html')}><FileCode aria-hidden />导出为 HTML</DropdownMenuItem>
              <DropdownMenuItem className={styles.item} disabled={!editor || busy} onSelect={() => void exportContent('markdown')}><FileText aria-hidden />导出为 Markdown</DropdownMenuItem>
              <DropdownMenuItem className={styles.item} disabled={!editor || busy} onSelect={() => void exportPdf()}><FilePdf aria-hidden />导出为 PDF</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem className={styles.item} disabled={!editor || busy} onSelect={() => void action(async () => printDocument(await documentContent(editor!, title, 'html')), '已打开打印窗口')}><Printer aria-hidden />打印</DropdownMenuItem>
          <ReservedItem icon={<FileArrowUp aria-hidden />}>导入</ReservedItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup aria-label="组织与浏览">
          <ReservedItem icon={<FolderSimple aria-hidden />}>移动</ReservedItem>
          <DropdownMenuItem className={styles.item} disabled={!navigation?.onTogglePin} onSelect={event => { event.preventDefault(); navigation?.onTogglePin?.(); }}><PushPin aria-hidden weight={navigation?.pinned ? "fill" : "regular"} />{navigation?.pinned ? "取消固定" : "固定"}</DropdownMenuItem>
          <DropdownMenuItem className={styles.item} disabled={!editor || !navigation?.onSplit} onSelect={navigation?.onSplit}><SplitHorizontal aria-hidden />在拆分视图打开</DropdownMenuItem>
          <DropdownMenuItem className={styles.item} disabled={!editor || !navigation} onSelect={navigation?.onSearch}><MagnifyingGlass aria-hidden />在文档中搜索</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup aria-label="删除文档">
          <DropdownMenuItem variant="destructive" className={styles.item} disabled={!actions.onDelete || busy} title={!actions.onDelete ? '当前权限不能删除文档' : undefined} onSelect={() => { setDeleteError(''); setConfirmDelete(true); }}><Trash aria-hidden />删除</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    <ModalDialog open={confirmDelete} width="w-[min(440px,calc(100vw-32px))]" onClose={() => { if (!busy) setConfirmDelete(false); }} title="删除文档？" description={`「${title.trim() || '无标题文档'}」将移至回收站，可以从回收站恢复。`} footer={<><button type="button" autoFocus className={styles.cancel} disabled={busy} onClick={() => setConfirmDelete(false)}>取消</button><button type="button" className={styles.delete} disabled={busy} onClick={() => void action(async () => { try { await actions.onDelete?.(); setConfirmDelete(false); } catch (error) { setDeleteError('删除失败，文档已保留，请稍后重试。'); throw error; } }, '文档已移至回收站')}>{busy ? '正在删除…' : '移至回收站'}</button></>}>
      {deleteError ? <AppAlert tone="error" title={deleteError} /> : null}
    </ModalDialog>
  </>;
}
