'use client';

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import styles from './model-info-card.module.css';

export const modelInfoPaneWidth = 400;
export const modelInfoPaneGap = 8;
export const modelInfoNarrowWidth = 760;

/** Keep the detail pane aligned to the whole list, independent of the hovered row. */
export function ModelInfoPane({ anchorRef, focusOnOpen, panelId, onPointerEnter, onPointerLeave, children }: {
    children: ReactNode;
    anchorRef: RefObject<HTMLDivElement | null>;
    focusOnOpen: boolean;
    panelId: string;
    onPointerEnter: () => void;
    onPointerLeave: () => void;
  }) {
  const paneRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const pane = paneRef.current;
    const anchor = anchorRef.current;
    if (!pane || !anchor) return;
    function position() {
      if (!pane || !anchor) return;
      const bounds = anchor.getBoundingClientRect();
      const narrow = window.innerWidth <= modelInfoNarrowWidth;
      const width = narrow ? window.innerWidth - 24 : Math.min(modelInfoPaneWidth, Math.max(0, bounds.left - modelInfoPaneGap - 12));
      pane.style.width = `${width}px`;
      pane.style.left = `${(narrow ? 12 : bounds.left - width - modelInfoPaneGap) - bounds.left}px`;
      pane.style.top = `${(narrow ? 12 : Math.max(12, Math.min(bounds.top, window.innerHeight - pane.offsetHeight - 12))) - bounds.top}px`;
    }
    position();
    const observer = new ResizeObserver(position);
    observer.observe(anchor);
    observer.observe(pane);
    // Radix can move the list without changing its size (collision/anchor updates).
    const placementObserver = new MutationObserver(position);
    if (anchor.parentElement) placementObserver.observe(anchor.parentElement, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, { capture: true, passive: true });
    anchor.addEventListener('animationend', position);
    if (focusOnOpen) {
      const target = Array.from(pane.querySelectorAll('button')).find(button => !button.disabled && button.getClientRects().length);
      (target ?? pane).focus({ preventScroll: true });
    }
    return () => {
      observer.disconnect();
      placementObserver.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      anchor.removeEventListener('animationend', position);
    };
  }, [anchorRef, focusOnOpen]);

  return <div id={panelId} ref={paneRef} tabIndex={-1} className={styles.pane} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
    {children}
  </div>;
}
