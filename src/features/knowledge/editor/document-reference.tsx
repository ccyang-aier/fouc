'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { PushPin, X } from '@phosphor-icons/react';
import type { DocumentLinkTarget } from './document-link';
import { requestOpenPageBlock } from './open-target';
import styles from './document-tools.module.css';

export type FixedDocument = { target: DocumentLinkTarget; title: string };
export type RenderFixedDocument = (document: FixedDocument, onClose: () => void) => ReactNode;
type ReferenceContext = { fixed: boolean; pins: FixedDocument[]; togglePin: (pin: FixedDocument) => void; openReference?: (document: FixedDocument) => void; reportTitle?: (title: string) => void };
const pinSnapshots = new Map<string, FixedDocument[]>();
const pinListeners = new Map<string, Set<() => void>>();
const emptyPins: FixedDocument[] = [];
const Context = createContext<ReferenceContext | null>(null);
export const useDocumentReference = () => useContext(Context);
const clampSize = (value: number) => Math.max(20, Math.min(80, value));

/** Resource adapters supply a real editor with its existing access and storage boundaries. */
export function DocumentReferenceWorkspace({ scope, children, renderDocument }: { scope: string; children: ReactNode; renderDocument?: RenderFixedDocument }) {
  const [reference, setReference] = useState<FixedDocument | null>(null);
  const [size, setSize] = useState(50);
  const [stacked, setStacked] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const key = `fouc.document.pins:${scope}`;
  const getPins = useCallback(() => {
    if (!pinSnapshots.has(key)) {
      try { const saved = JSON.parse(localStorage.getItem(key) ?? '[]') as FixedDocument[]; pinSnapshots.set(key, saved.filter(pin => typeof pin.title === 'string' && typeof pin.target?.workspaceId === 'string' && typeof pin.target?.pageId === 'string')); }
      catch { pinSnapshots.set(key, []); }
    }
    return pinSnapshots.get(key)!;
  }, [key]);
  const subscribePins = useCallback((listener: () => void) => {
    const group = pinListeners.get(key) ?? new Set<() => void>(); group.add(listener); pinListeners.set(key, group);
    return () => { group.delete(listener); };
  }, [key]);
  const pins = useSyncExternalStore(subscribePins, getPins, () => emptyPins);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setStacked(entry.contentRect.width < 640));
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const togglePin = useCallback((pin: FixedDocument) => {
    const current = getPins();
    const next = current.some(item => item.target.pageId === pin.target.pageId) ? current.filter(item => item.target.pageId !== pin.target.pageId) : [...current, pin];
    pinSnapshots.set(key, next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Navigation remains usable in memory. */ }
    for (const listener of pinListeners.get(key) ?? []) listener();
  }, [getPins, key]);
  const close = useCallback(() => setReference(null), []);
  const reportTitle = useCallback((title: string) => setReference(current => current && current.title !== title ? { ...current, title } : current), []);
  const primaryContext = useMemo(() => ({ fixed: false, pins, togglePin, openReference: renderDocument ? setReference : undefined }), [pins, togglePin, renderDocument]);
  const fixedContext = useMemo(() => ({ fixed: true, pins, togglePin, reportTitle }), [pins, togglePin, reportTitle]);
  const document = useMemo(() => reference && renderDocument?.(reference, close), [reference, renderDocument, close]);
  return <div className={styles.workspace}>
    <div className={`${styles.workspaceBody} ${styles.splitWorkspace}`} ref={host} data-split={Boolean(reference)} data-stacked={stacked} style={{ '--reference-size': `${size}%` } as CSSProperties}>
      <Context.Provider value={primaryContext}>
        <div className={styles.primary}>
          {pins.length > 0 && <nav className={styles.pins} aria-label="固定文档">{pins.map(pin => <span key={pin.target.pageId}>
            <button type="button" onClick={() => requestOpenPageBlock(pin.target)} title={pin.title}><PushPin size={13} weight="fill" /><span>{pin.title || '无标题文档'}</span></button>
            <button type="button" aria-label={`取消固定${pin.title}`} onClick={() => togglePin(pin)}><X size={12} /></button>
          </span>)}</nav>}
          {children}
        </div>
      </Context.Provider>
      {reference && <>
        <button type="button" className={styles.resizer} role="separator" aria-label={stacked ? '调整拆分视图高度' : '调整拆分视图宽度'} aria-orientation={stacked ? 'horizontal' : 'vertical'} aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(size)}
          onKeyDown={event => {
            const before = stacked ? 'ArrowUp' : 'ArrowLeft';
            const after = stacked ? 'ArrowDown' : 'ArrowRight';
            if (event.key === before || event.key === after) { event.preventDefault(); setSize(value => clampSize(value + (event.key === before ? 2 : -2))); }
            if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setSize(event.key === 'Home' ? 20 : 80); }
          }}
          onDoubleClick={() => setSize(50)}
          onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={event => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId) || !host.current) return;
            const box = host.current.getBoundingClientRect();
            setSize(clampSize(stacked ? (box.bottom - event.clientY) / box.height * 100 : (box.right - event.clientX) / box.width * 100));
          }}
          onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} />
        <aside className={styles.reference} aria-label="拆分文档" data-page-id={reference.target.pageId}>
          <div className={styles.referenceTabs}>
            <div className={styles.referenceTab}><PushPin size={14} weight="fill" aria-hidden /><span title={reference.title}>{reference.title || '无标题文档'}</span><button type="button" aria-label="关闭拆分视图" onClick={close}><X size={14} /></button></div>
          </div>
          <Context.Provider value={fixedContext}>{document}</Context.Provider>
        </aside>
      </>}
    </div>
  </div>;
}
