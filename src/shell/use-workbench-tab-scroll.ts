'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkbenchTab } from './workbench-tabs';

export function useWorkbenchTabScroll(active: string, tabs: readonly WorkbenchTab[]) {
  const strip = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);
  const pending = useRef(0);
  const [edges, setEdges] = useState({ overflow: false, left: false, right: false });
  const cancelReveal = useCallback(() => { cancelAnimationFrame(pending.current); pending.current = 0; }, []);
  const reveal = useCallback(() => {
    const scroll = viewport.current;
    const item = ref.current?.querySelector('[aria-selected="true"]')?.parentElement;
    if (!scroll || !item || dragging.current) return;
    // Layout offsets ignore drag/FLIP transforms and already reflect the final tab widths.
    const left = item.offsetLeft;
    const right = left + item.offsetWidth;
    const current = scroll.scrollLeft;
    const target = left < current ? left : right > current + scroll.clientWidth ? right - scroll.clientWidth : current;
    const next = Math.max(0, Math.min(scroll.scrollWidth - scroll.clientWidth, target));
    if (Math.abs(next - current) > 1) scroll.scrollTo({ left: next, behavior: 'smooth' });
  }, []);
  const revealSelected = useCallback(() => {
    cancelReveal();
    // Let overflow controls and ResizeObserver finish layout before issuing one scroll.
    pending.current = requestAnimationFrame(() => {
      pending.current = requestAnimationFrame(() => { pending.current = 0; reveal(); });
    });
  }, [cancelReveal, reveal]);

  useEffect(() => {
    const root = strip.current;
    const scroll = viewport.current;
    const content = ref.current;
    if (!root || !scroll || !content) return;
    let previousWidth = 0;
    let previousContentWidth = 0;
    function measure() {
      const end = Math.max(0, scroll!.scrollWidth - scroll!.clientWidth);
      const gap = Number.parseFloat(getComputedStyle(root!).columnGap) || 0;
      // Compare with the space before arrows are inserted, so they cannot toggle themselves.
      const available = root!.clientWidth - (newButton.current?.offsetWidth ?? 0) - gap;
      const next = { overflow: content!.offsetWidth > available + 1, left: scroll!.scrollLeft > 1, right: scroll!.scrollLeft < end - 1 };
      setEdges(current => current.overflow === next.overflow && current.left === next.left && current.right === next.right ? current : next);
      if (previousWidth !== scroll!.clientWidth || previousContentWidth !== content!.offsetWidth) {
        previousWidth = scroll!.clientWidth;
        previousContentWidth = content!.offsetWidth;
        revealSelected();
      }
    }
    function wheel(event: WheelEvent) {
      if (event.ctrlKey) return;
      cancelReveal();
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY) || scroll!.scrollWidth <= scroll!.clientWidth + 1) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroll!.clientWidth : 1;
      scroll!.scrollLeft += event.deltaY * unit;
    }
    const observer = new ResizeObserver(measure);
    for (const element of [root, scroll, content]) observer.observe(element);
    scroll.addEventListener('scroll', measure, { passive: true });
    scroll.addEventListener('wheel', wheel, { passive: false });
    scroll.addEventListener('pointerdown', cancelReveal);
    measure();
    return () => {
      observer.disconnect(); cancelReveal();
      scroll.removeEventListener('scroll', measure);
      scroll.removeEventListener('wheel', wheel);
      scroll.removeEventListener('pointerdown', cancelReveal);
    };
  }, [cancelReveal, revealSelected]);
  useEffect(revealSelected, [active, tabs, revealSelected]);
  return { strip, viewport, ref, newButton, dragging, edges, revealSelected };
}
