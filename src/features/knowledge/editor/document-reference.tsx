'use client';

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import { PushPin, X } from '@phosphor-icons/react';
import type { DocumentLinkTarget } from './document-link';
import { requestOpenPageBlock } from './open-target';
import { exportDocumentHtml } from './components/document-html-export';
import styles from './document-tools.module.css';

type Pin = { target: DocumentLinkTarget; title: string };
type Reference = { title: string; html?: string; error?: string };
type ReferenceContext = { pins: Pin[]; togglePin: (pin: Pin) => void; openReference: (editor: Editor, title: string) => void };
const pinSnapshots = new Map<string, Pin[]>();
const pinListeners = new Map<string, Set<() => void>>();
const emptyPins: Pin[] = [];
const Context = createContext<ReferenceContext | null>(null);
export const useDocumentReference = () => useContext(Context);

export function DocumentReferenceWorkspace({ scope, children }: { scope: string; children: ReactNode }) {
  const [reference, setReference] = useState<Reference | null>(null);
  const [width, setWidth] = useState(46);
  const host = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const key = `fouc.document.pins:${scope}`;
  const getPins = () => {
    if (!pinSnapshots.has(key)) {
      try { const saved = JSON.parse(localStorage.getItem(key) ?? '[]') as Pin[]; pinSnapshots.set(key, saved.filter(pin => typeof pin.title === 'string' && typeof pin.target?.workspaceId === 'string' && typeof pin.target?.pageId === 'string')); }
      catch { pinSnapshots.set(key, []); }
    }
    return pinSnapshots.get(key)!;
  };
  const pins = useSyncExternalStore(listener => {
    const group = pinListeners.get(key) ?? new Set<() => void>(); group.add(listener); pinListeners.set(key, group);
    return () => { group.delete(listener); };
  }, getPins, () => emptyPins);
  useEffect(() => () => { sequence.current++; }, []);
  function togglePin(pin: Pin) {
    const current = getPins();
    const next = current.some(item => item.target.pageId === pin.target.pageId) ? current.filter(item => item.target.pageId !== pin.target.pageId) : [...current, pin];
    pinSnapshots.set(key, next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Navigation remains usable in memory. */ }
    for (const listener of pinListeners.get(key) ?? []) listener();
  }
  async function openReference(editor: Editor, title: string) {
    const request = ++sequence.current;
    setReference({ title });
    try {
      const html = await exportDocumentHtml(editor, title);
      if (request === sequence.current) setReference({ title, html });
    } catch { if (request === sequence.current) setReference({ title, error: '无法打开参考视图，请重新打开文档后重试。' }); }
  }
  const close = () => { sequence.current++; setReference(null); };
  return <Context.Provider value={{ pins, togglePin, openReference: (editor, title) => { void openReference(editor, title); } }}>
    <div className={styles.workspace} ref={host}>
      {pins.length > 0 && <nav className={styles.pins} aria-label="固定文档">{pins.map(pin => <span key={pin.target.pageId}>
        <button type="button" onClick={() => requestOpenPageBlock(pin.target)} title={pin.title}><PushPin size={13} weight="fill" /><span>{pin.title || '无标题文档'}</span></button>
        <button type="button" aria-label={`取消固定${pin.title}`} onClick={() => togglePin(pin)}><X size={12} /></button>
      </span>)}</nav>}
      <div className={styles.workspaceBody}>
        <div className={styles.primary}>{children}</div>
        {reference && <>
          <button type="button" className={styles.resizer} role="separator" aria-label="调整拆分视图宽度" aria-orientation="vertical" aria-valuemin={25} aria-valuemax={70} aria-valuenow={width}
            onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setWidth(value => Math.max(25, Math.min(70, value + (event.key === 'ArrowLeft' ? 2 : -2)))); } }}
            onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const box = host.current!.getBoundingClientRect(); setWidth(Math.max(25, Math.min(70, (box.right - event.clientX) / box.width * 100))); }}
            onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} />
          <aside className={styles.reference} style={{ width: `${width}%` }} aria-label="拆分参考视图">
            <header><span title={reference.title}>{reference.title || '无标题文档'}</span><span className={styles.caption}>参考视图</span><button type="button" aria-label="关闭拆分视图" onClick={close}><X size={17} /></button></header>
            {reference.html ? <iframe title={`参考：${reference.title}`} srcDoc={reference.html} sandbox="" /> : <div className={styles.state} role={reference.error ? 'alert' : 'status'}>{reference.error ?? '正在打开参考视图…'}</div>}
          </aside>
        </>}
      </div>
    </div>
  </Context.Provider>;
}
