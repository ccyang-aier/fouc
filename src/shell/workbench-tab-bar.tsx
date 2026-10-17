'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, LayoutGroup, motion, useIsPresent } from 'motion/react';
import { CaretLeft, CaretRight, X } from '@phosphor-icons/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/lib/i18n';
import { workbenchPages } from './workbench-pages';
import { workbenchPanelId, workbenchTabId, type WorkbenchTab } from './workbench-tabs';
import { messages } from './i18n/navigation-sidebar.messages';
import styles from './workbench-tab-bar.module.css';

export function WorkbenchTabBar({ tabs, active, titles, onActivate, onClose }: {
  tabs: WorkbenchTab[]; active: string; titles: ReadonlyMap<string, string>;
  onActivate: (key: string) => void; onClose: (key: string) => void;
}) {
  const { t } = useTranslation(messages);
  const group = useId();
  const ref = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ overflow: false, left: false, right: false });
  const revealSelected = useCallback(() => { ref.current?.querySelector('[aria-selected="true"]')?.parentElement?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); }, []);
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
  function close(key: string) { onClose(key); focusSelected(); }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else if (event.key === 'Delete') { event.preventDefault(); close(tabs[index].key); return; }
    else return;
    event.preventDefault();
    onActivate(tabs[next].key);
    focusSelected();
  }
  return <div className={styles.strip} data-tauri-drag-region="false">
    {edges.overflow && <button type="button" className={`fouc-action ${styles.browse}`} aria-label={t('向左浏览页签')} title={t('向左浏览页签')} disabled={!edges.left} onClick={() => viewport.current?.scrollBy({ left: -viewport.current.clientWidth * .7, behavior: 'smooth' })}><CaretLeft size={13} aria-hidden /></button>}
    <ScrollArea orientation="horizontal" scrollbar={false} viewportRef={viewport} className={styles.scroller} viewportClassName={styles.viewport} data-hidden-left={edges.left} data-hidden-right={edges.right}>
    <div ref={ref} role="tablist" aria-label={t('工作页面')} className={styles.tabs}>
      <LayoutGroup id={group}>
        <AnimatePresence initial={false}>
          {tabs.map((tab, index) => {
            const page = workbenchPages[tab.view];
            const title = tab.conversationId ? titles.get(tab.conversationId) ?? t('新对话') : t(page.label);
            const selected = tab.key === active;
            return <TabItem key={tab.instance} tab={tab} title={title} closeLabel={t('关闭页面', { name: title })} selected={selected} onActivate={() => onActivate(tab.key)} onClose={() => close(tab.key)} onKeyDown={event => keyDown(event, index)} onSettled={revealSelected} />;
          })}
        </AnimatePresence>
      </LayoutGroup>
    </div>
    </ScrollArea>
    {edges.overflow && <button type="button" className={`fouc-action ${styles.browse}`} aria-label={t('向右浏览页签')} title={t('向右浏览页签')} disabled={!edges.right} onClick={() => viewport.current?.scrollBy({ left: viewport.current.clientWidth * .7, behavior: 'smooth' })}><CaretRight size={13} aria-hidden /></button>}
  </div>;
}

function TabItem({ tab, title, closeLabel, selected, onActivate, onClose, onKeyDown, onSettled }: {
  tab: WorkbenchTab; title: string; closeLabel: string; selected: boolean;
  onActivate: () => void; onClose: () => void; onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void; onSettled: () => void;
}) {
  const present = useIsPresent();
  const active = selected && present;
  const Icon = workbenchPages[tab.view].icon;
  return <motion.div layout="position" aria-hidden={!present || undefined} inert={!present} className={`fouc-action ${styles.item}`} initial={{ width: 0, opacity: 0 }} animate={{ width: tab.conversationId ? 164 : 128, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 430, damping: 38, mass: .7 }} onAnimationComplete={() => { if (active) onSettled(); }}>
    {active && <motion.span layoutId="selected-tab" className={styles.active} transition={{ type: 'spring', stiffness: 480, damping: 40 }} />}
    <button type="button" id={workbenchTabId(tab.instance)} role="tab" className={styles.select} aria-selected={active} aria-controls={workbenchPanelId(tab.instance)} tabIndex={active ? 0 : -1} title={title} onClick={onActivate} onKeyDown={onKeyDown}><Icon size={16} weight="duotone" aria-hidden /><span>{title}</span></button>
    <button type="button" className={`fouc-action ${styles.close}`} data-variant="nested" aria-label={closeLabel} tabIndex={active ? 0 : -1} onClick={onClose}><X size={13} aria-hidden /></button>
  </motion.div>;
}
