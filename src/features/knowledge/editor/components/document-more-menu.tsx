'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import { Bell, ChatCircleDots, ClockCounterClockwise, Copy, DotsThree, DownloadSimple, FileArrowUp, FileCode, FilePdf, FileText, LinkSimple, LockSimple, MagnifyingGlass, Printer, PushPin, SlidersHorizontal, SplitHorizontal, Star, Trash, Presentation, FolderSimple, SquaresFour } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { ModalDialog } from '../../organization/ui';
import { documentLink, type DocumentLinkTarget } from '../document-link';
import { useDocumentAppearance } from './document-appearance';
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
  const { appearance, update } = useDocumentAppearance();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const action = async (work: () => Promise<void> | void, success: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setStatus('');
    try { await work(); setStatus(success); }
    catch { setStatus('操作失败，请检查浏览器权限或稍后重试'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const copy = (format: ContentFormat | 'link') => action(async () => {
    const content = format === 'link' ? documentLink(window.location.href, actions.target) : await documentContent(editor!, title, format);
    await navigator.clipboard.writeText(content);
  }, '已复制到剪贴板');
  const exportContent = (format: 'markdown' | 'html') => action(async () => downloadDocument(await documentContent(editor!, title, format), title, format), '已导出文档');

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
              <DropdownMenuItem className={styles.item} disabled={!editor || busy} onSelect={() => void copy('markdown')}><FileCode aria-hidden />复制为 Markdown</DropdownMenuItem>
              <DropdownMenuItem className={styles.item} disabled={!editor || busy} onSelect={() => void copy('html')}><FileCode aria-hidden />复制为 HTML</DropdownMenuItem>
              {actions.target.source === 'local' ? <p className={styles.hint}>本机链接仅在保存该文档的浏览器中可访问。</p> : null}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={styles.item}><SlidersHorizontal aria-hidden />个性化设置</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className={styles.submenu}>
              <DropdownMenuLabel>页宽</DropdownMenuLabel>
              {([['compact', '紧凑'], ['standard', '标准'], ['wide', '宽版']] as const).map(([width, label]) => <DropdownMenuCheckboxItem key={width} checked={appearance.width === width} onSelect={(event) => event.preventDefault()} onCheckedChange={() => update({ width })}>{label}</DropdownMenuCheckboxItem>)}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>字体</DropdownMenuLabel>
              {([['default', '默认'], ['serif', '衬线'], ['mono', '等宽']] as const).map(([font, label]) => <DropdownMenuCheckboxItem key={font} checked={appearance.font === font} onSelect={(event) => event.preventDefault()} onCheckedChange={() => update({ font })}>{label}</DropdownMenuCheckboxItem>)}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>字号</DropdownMenuLabel>
              {([['small', '小'], ['standard', '标准'], ['large', '大']] as const).map(([size, label]) => <DropdownMenuCheckboxItem key={size} checked={appearance.size === size} onSelect={(event) => event.preventDefault()} onCheckedChange={() => update({ size })}>{label}</DropdownMenuCheckboxItem>)}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <ReservedItem icon={<Presentation aria-hidden />}>演示</ReservedItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup aria-label="关注与协作">
          <DropdownMenuItem className={styles.item} onSelect={onToggleStar}><Star aria-hidden weight={starred ? 'fill' : 'regular'} />{starred ? '取消收藏' : '收藏'}</DropdownMenuItem>
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
              <ReservedItem icon={<FilePdf aria-hidden />}>导出为 PDF</ReservedItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem className={styles.item} disabled={!editor || busy} onSelect={() => void action(async () => printDocument(await documentContent(editor!, title, 'html')), '已打开打印窗口')}><Printer aria-hidden />打印</DropdownMenuItem>
          <ReservedItem icon={<FileArrowUp aria-hidden />}>导入</ReservedItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup aria-label="组织与浏览">
          <ReservedItem icon={<FolderSimple aria-hidden />}>移动</ReservedItem>
          <ReservedItem icon={<PushPin aria-hidden />}>固定</ReservedItem>
          <ReservedItem icon={<SplitHorizontal aria-hidden />}>在拆分视图打开</ReservedItem>
          <ReservedItem icon={<MagnifyingGlass aria-hidden />}>在文档中搜索</ReservedItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup aria-label="删除文档">
          <DropdownMenuItem className={`${styles.item} ${styles.danger}`} disabled={!actions.onDelete || busy} title={!actions.onDelete ? '当前权限不能删除文档' : undefined} onSelect={() => { setDeleteError(''); setConfirmDelete(true); }}><Trash aria-hidden />删除</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    {status ? <div role="status" className={styles.status}>{status}<button type="button" aria-label="关闭操作提示" onClick={() => setStatus('')}>×</button></div> : null}
    <ModalDialog open={confirmDelete} width="w-[min(440px,calc(100vw-32px))]" onClose={() => { if (!busy) setConfirmDelete(false); }} title="删除文档？" description={`「${title.trim() || '无标题文档'}」将移至回收站，可以从回收站恢复。`} footer={<><button type="button" autoFocus className={styles.cancel} disabled={busy} onClick={() => setConfirmDelete(false)}>取消</button><button type="button" className={styles.delete} disabled={busy} onClick={() => void action(async () => { try { await actions.onDelete?.(); setConfirmDelete(false); } catch (error) { setDeleteError('删除失败，文档已保留，请稍后重试。'); throw error; } }, '文档已移至回收站')}>{busy ? '正在删除…' : '移至回收站'}</button></>}>
      {deleteError ? <p role="alert" className={styles.error}>{deleteError}</p> : null}
    </ModalDialog>
  </>;
}
