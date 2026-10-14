'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './resource-tree-resize.messages';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from 'react';
import { SidebarResizeHandle } from '@/components/sidebar-resize';
const MIN_WIDTH = 210,
  MAX_WIDTH = 520,
  CENTER_MIN_WIDTH = 400;
const widthProperty = '--resource-tree-width';
type Gesture = {
  pointer: number;
  startX: number;
  startWidth: number;
  latestX: number;
  original: string;
  pane: HTMLElement;
  handle: HTMLButtonElement;
};
function maximum(pane: HTMLElement): number {
  return Math.min(
    MAX_WIDTH,
    Math.max(
      MIN_WIDTH,
      (pane.parentElement?.getBoundingClientRect().width ?? MAX_WIDTH + CENTER_MIN_WIDTH) -
        CENTER_MIN_WIDTH,
    ),
  );
}
/** Preview is local CSS; only a completed gesture updates the workbench's preferred width. */
export function ResourceTreeResize({
  paneRef,
  controls,
  onChange,
}: {
  paneRef: RefObject<HTMLElement | null>;
  controls: string;
  onChange: (width: number | undefined) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const gesture = useRef<Gesture | null>(null),
    frame = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false),
    [bounds, setBounds] = useState({ width: 284, maximum: MAX_WIDTH });
  const stop = useCallback(
    (commit: boolean, update = true) => {
      const current = gesture.current;
      if (!current) return;
      gesture.current = null;
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      const width = Math.round(
        Math.max(
          MIN_WIDTH,
          Math.min(maximum(current.pane), current.startWidth + current.latestX - current.startX),
        ),
      );
      delete current.pane.dataset.resourceResizing;
      if (commit && width !== Math.round(current.startWidth)) {
        current.pane.style.setProperty(widthProperty, `${width}px`);
        onChange(width);
      } else if (current.original) current.pane.style.setProperty(widthProperty, current.original);
      else current.pane.style.removeProperty(widthProperty);
      if (current.handle.hasPointerCapture(current.pointer))
        current.handle.releasePointerCapture(current.pointer);
      if (update) setDragging(false);
    },
    [onChange],
  );
  useLayoutEffect(() => () => stop(false, false), [stop]);
  // The parent host ref is attached after child layout effects.
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const measure = () => {
      const width = pane.getBoundingClientRect().width;
      if (!width) {
        stop(false);
        return;
      }
      const next = { width: Math.round(width), maximum: Math.round(maximum(pane)) };
      setBounds((previous) =>
        previous.width === next.width && previous.maximum === next.maximum ? previous : next,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    if (pane.parentElement) observer.observe(pane.parentElement);
    measure();
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) {
        event.preventDefault();
        event.stopPropagation();
        stop(false);
      }
    };
    const blur = () => stop(false);
    document.addEventListener('keydown', cancel, true);
    window.addEventListener('blur', blur);
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', cancel, true);
      window.removeEventListener('blur', blur);
      stop(false, false);
    };
  }, [paneRef, stop]);
  function start(event: PointerEvent<HTMLButtonElement>) {
    const pane = paneRef.current;
    if (event.button !== 0 || gesture.current || !pane) return;
    event.preventDefault();
    gesture.current = {
      pointer: event.pointerId,
      startX: event.clientX,
      latestX: event.clientX,
      startWidth: pane.getBoundingClientRect().width,
      original: pane.style.getPropertyValue(widthProperty),
      pane,
      handle: event.currentTarget,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    pane.dataset.resourceResizing = 'true';
    setDragging(true);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    current.latestX = event.clientX;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (gesture.current !== current) return;
      const width = Math.round(
        Math.max(
          MIN_WIDTH,
          Math.min(maximum(current.pane), current.startWidth + current.latestX - current.startX),
        ),
      );
      current.pane.style.setProperty(widthProperty, `${width}px`);
    });
  }
  return (
    <SidebarResizeHandle
      dragging={dragging}
      role="separator"
      aria-label={tConnector('resizeDatabaseSidebar')}
      title={tConnector('dragToResizeArrowKeysToAdjustDoubleClickTo')}
      aria-orientation="vertical"
      aria-controls={controls}
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={bounds.maximum}
      aria-valuenow={bounds.width}
      aria-valuetext={tConnector('pixels', { p0: String(bounds.width) })}
      tabIndex={0}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={(event) => {
        if (gesture.current?.pointer === event.pointerId) {
          gesture.current.latestX = event.clientX;
          stop(true);
        }
      }}
      onPointerCancel={(event) => {
        if (gesture.current?.pointer === event.pointerId) stop(false);
      }}
      onLostPointerCapture={(event) => {
        if (gesture.current?.pointer === event.pointerId) stop(false);
      }}
      onDoubleClick={() => {
        stop(false);
        paneRef.current?.style.removeProperty(widthProperty);
        onChange(undefined);
      }}
      onKeyDown={(event) => {
        if (
          !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) ||
          dragging ||
          !paneRef.current
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        const pane = paneRef.current,
          max = maximum(pane),
          step = event.shiftKey ? 40 : 16;
        onChange(
          event.key === 'Home'
            ? MIN_WIDTH
            : event.key === 'End'
              ? max
              : Math.max(
                  MIN_WIDTH,
                  Math.min(
                    max,
                    pane.getBoundingClientRect().width + (event.key === 'ArrowLeft' ? -step : step),
                  ),
                ),
        );
      }}
    />
  );
}
