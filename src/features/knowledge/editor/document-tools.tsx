'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import { ArrowsIn, ArrowsOut, CaretDown, CaretLeft, CaretRight, CaretUp, ListBullets, MagnifyingGlass, TextAa, X } from '@phosphor-icons/react';
import { documentSearchKey, findDocumentMatches } from './extensions/document-search';
import type { DocumentLinkTarget } from './document-link';
import { useDocumentReference } from './document-reference';
import { exportDocumentHtml } from './components/document-html-export';
import { presentationSlides } from './presentation-slides';
import styles from './document-tools.module.css';

type Navigation = { onPresent: () => void; onSearch: () => void; onSplit?: () => void; onTogglePin?: () => void; pinned: boolean };
const Context = createContext<Navigation | null>(null);
export const useDocumentNavigation = () => useContext(Context);

export function DocumentNavigationTools({ editor, title, target, children }: { editor: Editor | null; title: string; target: DocumentLinkTarget; children: ReactNode }) {
  const reference = useDocumentReference();
  const host = useRef<HTMLDivElement>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [current, setCurrent] = useState(0);
  const [revision, setRevision] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const presentation = useRef<HTMLDialogElement>(null);
  const [slides, setSlides] = useState<string[]>([]);
  const [slide, setSlide] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [presentError, setPresentError] = useState('');
  const [fullscreenError, setFullscreenError] = useState('');
  const pending = useRef(0);
  const [activeHeading, setActiveHeading] = useState(-1);
  const headings: { pos: number; level: number; title: string }[] = [];
  if (editor) editor.state.doc.descendants((node, pos) => { if (node.type.name === 'heading') headings.push({ pos, level: node.attrs.level as number, title: node.textContent || '无标题章节' }); });
  useEffect(() => {
    if (!editor) return;
    const update = () => setRevision(value => value + 1);
    editor.on('update', update);
    return () => { editor.off('update', update); };
  }, [editor]);
  useEffect(() => {
    const frame = host.current?.closest('[aria-label="页面编辑器"]');
    const scroll = frame?.querySelector('[data-document-scroll]');
    const update = () => {
      if (!editor || !scroll) return;
      let active = -1;
      const top = scroll.getBoundingClientRect().top + 90;
      editor.state.doc.descendants((node, pos) => { if (node.type.name === 'heading') { const index = headings.findIndex(heading => heading.pos === pos); const element = editor.view.nodeDOM(pos); if (element instanceof HTMLElement && element.getBoundingClientRect().top <= top) active = index; } });
      setActiveHeading(active);
    };
    scroll?.addEventListener('scroll', update, { passive: true }); update();
    return () => { scroll?.removeEventListener('scroll', update); };
    // Heading positions are rebuilt after each document update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, revision]);
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(documentSearchKey, { query: searchOpen ? query : '', matchCase, current }));
    const active = documentSearchKey.getState(editor.state);
    const match = searchOpen ? active?.matches[active.current] : undefined;
    if (match) { const node = editor.view.domAtPos(match.from).node; (node instanceof HTMLElement ? node : node.parentElement)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }, [editor, searchOpen, query, matchCase, current, revision]);
  const matches = editor ? findDocumentMatches(editor.state.doc, query, matchCase) : [];
  function moveMatch(delta: number) {
    if (!editor || !matches.length) return;
    const index = (current + delta + matches.length) % matches.length;
    setCurrent(index);
  }
  function openSearch() { setOutlineOpen(false); setSearchOpen(true); requestAnimationFrame(() => input.current?.focus()); }
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && host.current?.closest('[aria-label="页面编辑器"]')?.contains(document.activeElement)) { event.preventDefault(); openSearch(); }
      if (event.key === 'Escape') { setSearchOpen(false); setOutlineOpen(false); }
    }
    const changed = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('keydown', keydown); document.addEventListener('fullscreenchange', changed);
    // This is a request counter, not a DOM ref: invalidate pending snapshots on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { document.removeEventListener('keydown', keydown); document.removeEventListener('fullscreenchange', changed); pending.current++; };
  }, []);
  async function onPresent() {
    if (!editor) return;
    const request = ++pending.current;
    setPresenting(true); setSlides([]); setSlide(0); setPresentError('');
    presentation.current?.showModal();
    try { const html = await exportDocumentHtml(editor, title); if (request === pending.current) setSlides(presentationSlides(html, title)); }
    catch { if (request === pending.current) setPresentError('演示内容生成失败，请关闭后重试。'); }
  }
  const closePresentation = () => { pending.current++; setPresenting(false); setSlides([]); presentation.current?.close(); };
  function navigatePresentation(event: { key: string; preventDefault: () => void }) {
    const delta = ['ArrowRight', 'PageDown', ' '].includes(event.key) ? 1 : ['ArrowLeft', 'PageUp'].includes(event.key) ? -1 : 0;
    if (delta) { event.preventDefault(); setSlide(value => Math.max(0, Math.min(slides.length - 1, value + delta))); }
    if (event.key === 'Home') { event.preventDefault(); setSlide(0); }
    if (event.key === 'End') { event.preventDefault(); setSlide(Math.max(0, slides.length - 1)); }
    if (event.key === 'Escape') closePresentation();
  }
  return <Context.Provider value={{ onPresent: () => { void onPresent(); }, onSearch: openSearch, onSplit: reference && editor ? () => reference.openReference(editor, title) : undefined,
    onTogglePin: reference ? () => reference.togglePin({ title, target }) : undefined, pinned: reference?.pins.some(pin => pin.target.pageId === target.pageId) ?? false }}>
    <div ref={host} className={styles.toolbarHost}>{children}
      <div className={styles.navigation}>
        <button type="button" aria-label="文档目录" title="文档目录" aria-expanded={outlineOpen} disabled={!editor} onClick={() => { setSearchOpen(false); setOutlineOpen(value => !value); }} data-active={outlineOpen}><ListBullets size={18} /></button>
        <button type="button" aria-label={fullscreen ? '退出全屏' : '全屏编辑'} title={fullscreen ? '退出全屏' : '全屏编辑'} onClick={() => { if (fullscreen) void document.exitFullscreen(); else void host.current?.closest<HTMLElement>('[aria-label="页面编辑器"]')?.requestFullscreen().catch(() => setFullscreenError('浏览器未允许全屏，请检查浏览器权限。')); }}>{fullscreen ? <ArrowsIn size={17} /> : <ArrowsOut size={17} />}</button>
      </div>
      {fullscreenError && <div role="alert" className={styles.search}>{fullscreenError}<button aria-label="关闭提示" onClick={() => setFullscreenError('')}><X size={16} /></button></div>}
      {outlineOpen && <aside className={`${styles.outline} menu-surface`} aria-label="文档目录">
        <header><strong>目录</strong><button type="button" aria-label="关闭目录" onClick={() => setOutlineOpen(false)}><X size={16} /></button></header>
        <nav>{headings.length ? headings.map((heading, index) => <button type="button" key={heading.pos} data-active={index === activeHeading} style={{ paddingLeft: `${12 + (heading.level - 1) * 12}px` }} onClick={() => { const element = editor!.view.nodeDOM(heading.pos); if (element instanceof HTMLElement) element.scrollIntoView({ block: 'start', behavior: 'smooth' }); setActiveHeading(index); }} title={heading.title}>{heading.title}</button>) : <p>添加标题后，章节会显示在这里。</p>}</nav>
      </aside>}
      {searchOpen && <div className={`${styles.search} menu-surface`} role="search" aria-label="在文档中搜索">
        <MagnifyingGlass size={17} /><input ref={input} aria-label="文档内搜索词" placeholder="在文档中搜索" value={query} onChange={event => { setQuery(event.target.value); setCurrent(0); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); moveMatch(event.shiftKey ? -1 : 1); } }} />
        <span role="status">{matches.length ? `${Math.min(current + 1, matches.length)}/${matches.length}` : query ? '无结果' : '0/0'}</span>
        <button type="button" aria-label="区分大小写" title="区分大小写" aria-pressed={matchCase} onClick={() => { setMatchCase(value => !value); setCurrent(0); }}><TextAa size={17} /></button>
        <button type="button" aria-label="上一个匹配" disabled={!matches.length} onClick={() => moveMatch(-1)}><CaretUp size={16} /></button><button type="button" aria-label="下一个匹配" disabled={!matches.length} onClick={() => moveMatch(1)}><CaretDown size={16} /></button>
        <button type="button" aria-label="关闭文档搜索" onClick={() => setSearchOpen(false)}><X size={16} /></button>
      </div>}
      <dialog ref={presentation} className={styles.presentation} aria-label="文档演示" onCancel={closePresentation} onKeyDown={navigatePresentation}>
        {presenting && <><header><span>{title || '无标题文档'}</span><button type="button" aria-label="退出演示" onClick={closePresentation}><X size={20} /></button></header>
          <div className={styles.stage}>{slides.length ? <iframe key={slide} title={`演示第 ${slide + 1} 页`} srcDoc={slides[slide]} sandbox="allow-same-origin" onLoad={event => { const document = event.currentTarget.contentDocument; document?.addEventListener('keydown', navigatePresentation); if (document) { document.body.tabIndex = 0; document.body.focus(); } }} /> : <div role={presentError ? 'alert' : 'status'}>{presentError || '正在准备演示…'}</div>}</div>
          <footer><button type="button" aria-label="上一页" disabled={slide === 0 || !slides.length} onClick={() => setSlide(value => value - 1)}><CaretLeft size={20} /></button><span>{slides.length ? `${slide + 1} / ${slides.length}` : '…'}</span><button type="button" aria-label="下一页" disabled={slide >= slides.length - 1} onClick={() => setSlide(value => value + 1)}><CaretRight size={20} /></button></footer></>}
      </dialog>
    </div>
  </Context.Provider>;
}
