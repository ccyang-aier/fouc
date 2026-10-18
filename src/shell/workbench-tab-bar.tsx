'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { AnimatePresence, LayoutGroup, motion, Reorder, useDragControls, useIsPresent } from 'motion/react';
import { CaretLeft, CaretRight, PushPin, Plus, X } from '@phosphor-icons/react';
import { useTranslation } from '@/lib/i18n';
import { workbenchPages, type WorkbenchPage } from './workbench-pages';
import { workbenchPanelId, workbenchTabId, type TabAction, type TabCloseAction, type WorkbenchTab } from './workbench-tabs';
import { WorkbenchNewTabMenu, WorkbenchTabMenu } from './workbench-tab-menu';
import { messages } from './i18n/navigation-sidebar.messages';
import styles from './workbench-tab-bar.module.css';

export function WorkbenchTabBar({ tabs, active, titles, onActivate, onClose, onReorder, onPin, onReload, onDuplicate, onNew }: {
  tabs: WorkbenchTab[]; active: string; titles: ReadonlyMap<string, string>;
  onActivate: (key: string) => void; onClose: (key: string, action?: TabCloseAction) => void; onReorder: (instances: number[]) => void;
  onPin: (key: string) => void; onReload: (key: string) => void; onDuplicate: (key: string) => void; onNew: (view: WorkbenchPage) => void;
}) {
  const { t } = useTranslation(messages);
  const group = useId();
  const ref = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);
  const [context, setContext] = useState<{ instance: number; x: number; y: number } | null>(null);
  const [newContext, setNewContext] = useState<{ x: number; y: number } | null>(null);
  const [edges, setEdges] = useState({ overflow: false, left: false, right: false });
  const revealSelected = useCallback(() => { if (!dragging.current) ref.current?.querySelector('[aria-selected="true"]')?.parentElement?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); }, []);
  useEffect(() => {
    const scroll = viewport.current;
    if (!scroll) return;
    function measure() {
      const end = Math.max(0, scroll!.scrollWidth - scroll!.clientWidth);
      const next = { overflow: end > 1, left: scroll!.scrollLeft > 1, right: scroll!.scrollLeft < end - 1 };
      setEdges(current => current.overflow === next.overflow && current.left === next.left && current.right === next.right ? current : next);
    }
    let previousWidth = 0;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      measure();
      if (scroll.clientWidth !== previousWidth) {
        previousWidth = scroll.clientWidth;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(revealSelected);
      }
    });
    observer.observe(scroll);
    if (ref.current) observer.observe(ref.current);
    scroll.addEventListener('scroll', measure, { passive: true });
    measure();
    return () => { observer.disconnect(); scroll.removeEventListener('scroll', measure); cancelAnimationFrame(frame); };
  }, [revealSelected]);
  useEffect(revealSelected, [active, tabs, revealSelected]);
  function focusSelected() { requestAnimationFrame(() => { revealSelected(); ref.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true }); }); }
  function activate(key: string) { setContext(null); setNewContext(null); onActivate(key); }
  function close(key: string, action?: TabCloseAction) { setContext(null); onClose(key, action); focusSelected(); }
  function newTab(view: WorkbenchPage = 'home') { setContext(null); setNewContext(null); onNew(view); focusSelected(); }
  function action(key: string, value: TabAction) {
    setContext(null);
    if (value === 'pin') onPin(key);
    else if (value === 'reload') onReload(key);
    else if (value === 'duplicate') { onDuplicate(key); focusSelected(); }
    else close(key, value);
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      setContext({ instance: tabs[index].instance, x: bounds.left, y: bounds.bottom });
      return;
    }
    let next: number;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else if (event.key === 'Delete') { event.preventDefault(); close(tabs[index].key); return; }
    else return;
    event.preventDefault();
    activate(tabs[next].key);
    focusSelected();
  }
  const contextIndex = context ? tabs.findIndex(tab => tab.instance === context.instance) : -1;
  return <div className={styles.strip} data-tauri-drag-region="false">
    {edges.overflow && <button type="button" className={`fouc-action ${styles.browse}`} aria-label={t('向左浏览页签')} title={t('向左浏览页签')} disabled={!edges.left} onClick={() => viewport.current?.scrollBy({ left: -viewport.current.clientWidth * .7, behavior: 'smooth' })}><CaretLeft size={13} aria-hidden /></button>}
    <div className={styles.scroller} data-hidden-left={edges.left} data-hidden-right={edges.right}>
    <motion.div ref={viewport} layoutScroll className={styles.viewport}>
      <LayoutGroup id={group}>
        <Reorder.Group as="div" axis="x" values={tabs.map(tab => tab.instance)} onReorder={onReorder} ref={ref} role="tablist" aria-label={t('工作页面')} className={styles.tabs}>
        <AnimatePresence initial={false}>
          {tabs.map((tab, index) => {
            const page = workbenchPages[tab.view];
            const title = tab.conversationId ? titles.get(tab.conversationId) ?? t('新对话') : t(page.label);
            const selected = tab.key === active;
            return <TabItem key={tab.instance} tab={tab} title={title} closeLabel={t('关闭页面', { name: title })} selected={selected}
              onActivate={() => activate(tab.key)} onClose={() => close(tab.key)} onKeyDown={event => keyDown(event, index)} onSettled={revealSelected}
              onDragStart={() => { dragging.current = true; activate(tab.key); }} onDragEnd={() => { dragging.current = false; revealSelected(); }}
              onContextMenu={event => { event.preventDefault(); setNewContext(null); setContext({ instance: tab.instance, x: event.clientX, y: event.clientY }); }} />;
          })}
        </AnimatePresence>
        </Reorder.Group>
      </LayoutGroup>
    </motion.div>
    </div>
    {edges.overflow && <button type="button" className={`fouc-action ${styles.browse}`} aria-label={t('向右浏览页签')} title={t('向右浏览页签')} disabled={!edges.right} onClick={() => viewport.current?.scrollBy({ left: viewport.current.clientWidth * .7, behavior: 'smooth' })}><CaretRight size={13} aria-hidden /></button>}
    <button ref={newButton} type="button" className={`fouc-action ${styles.newTab}`} aria-label={t('新建标签页')} title={t('新建标签页')} aria-haspopup="menu" aria-expanded={Boolean(newContext)} onClick={() => newTab()}
      onContextMenu={event => { event.preventDefault(); setContext(null); setNewContext({ x: event.clientX, y: event.clientY }); }}
      onKeyDown={event => { if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') { event.preventDefault(); const bounds = event.currentTarget.getBoundingClientRect(); setContext(null); setNewContext({ x: bounds.left, y: bounds.bottom }); } }}><Plus size={17} aria-hidden /></button>
    {context && contextIndex >= 0 && <WorkbenchTabMenu key={context.instance} point={context} pinned={Boolean(tabs[contextIndex].pinned)} hasOthers={tabs.length > 1} onClose={() => setContext(null)} onAction={value => action(tabs[contextIndex].key, value)} onReturnFocus={focusSelected} />}
    {newContext && <WorkbenchNewTabMenu point={newContext} onClose={() => setNewContext(null)} onNew={newTab} onReturnFocus={() => newButton.current?.focus()} />}
  </div>;
}

function TabItem({ tab, title, closeLabel, selected, onActivate, onClose, onKeyDown, onSettled, onContextMenu, onDragStart, onDragEnd }: {
  tab: WorkbenchTab; title: string; closeLabel: string; selected: boolean;
  onActivate: () => void; onClose: () => void; onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void; onSettled: () => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void; onDragStart: () => void; onDragEnd: () => void;
}) {
  const present = useIsPresent();
  const controls = useDragControls();
  const moved = useRef(false);
  const [dragging, setDragging] = useState(false);
  const active = selected && present;
  const Icon = workbenchPages[tab.view].icon;
  return <Reorder.Item as="div" value={tab.instance} layout="position" dragListener={false} dragControls={controls} dragMomentum={false} dragTransition={{ bounceStiffness: 600, bounceDamping: 40 }}
    data-dragging={dragging} data-selected={active} data-pinned={Boolean(tab.pinned)} aria-hidden={!present || undefined} inert={!present} className={`fouc-action ${styles.item}`}
    initial={{ width: 0, opacity: 0 }} animate={{ width: (tab.conversationId ? 164 : 128) + (tab.pinned ? 16 : 0), opacity: 1 }} exit={{ width: 0, opacity: 0 }} whileDrag={{ scale: 1.015 }} transition={{ type: 'spring', stiffness: 430, damping: 38, mass: .7 }}
    onDragStart={() => { moved.current = true; setDragging(true); onDragStart(); }} onDragEnd={() => { setDragging(false); onDragEnd(); }}
    onContextMenu={onContextMenu} onAnimationComplete={() => { if (active) onSettled(); }}>
    {active && <motion.span layoutId="selected-tab" className={styles.active} transition={{ type: 'spring', stiffness: 480, damping: 40 }} />}
    <button type="button" id={workbenchTabId(tab.instance)} role="tab" className={styles.select} aria-selected={active} aria-controls={workbenchPanelId(tab.instance)} aria-haspopup="menu" tabIndex={active ? 0 : -1} title={title}
      onPointerDown={event => { if (event.button === 0) { moved.current = false; controls.start(event, { distanceThreshold: 5 }); } }}
      onClick={event => { if (!moved.current || event.detail === 0) onActivate(); }} onKeyDown={onKeyDown}><Icon size={16} weight="duotone" aria-hidden /><span>{title}</span>{tab.pinned && <PushPin className={styles.pin} size={12} weight="duotone" aria-hidden />}</button>
    <button type="button" className={`fouc-action ${styles.close}`} data-variant="nested" aria-label={closeLabel} tabIndex={active ? 0 : -1} onClick={onClose}><X size={13} aria-hidden /></button>
  </Reorder.Item>;
}
