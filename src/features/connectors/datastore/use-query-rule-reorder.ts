'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';

type Preview = { source: number; slot: number };
type Gesture = Preview & {
  pointer: number;
  element: HTMLButtonElement;
  timer: ReturnType<typeof setTimeout>;
  active: boolean;
  y: number;
};

/** A held grip previews an insertion; releasing commits once, Escape cancels. */
export function useQueryRuleReorder(
  count: number,
  disabled: boolean,
  onMove: (source: number, target: number) => void,
) {
  const list = useRef<HTMLElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const release = useCallback(() => {
    const current = gesture.current;
    gesture.current = null;
    if (current) {
      clearTimeout(current.timer);
      if (current.element.hasPointerCapture(current.pointer))
        current.element.releasePointerCapture(current.pointer);
    }
    return current;
  }, []);
  useEffect(
    () => () => {
      release();
    },
    [release],
  );

  function target(source: number, slot: number) {
    return slot > source ? slot - 1 : slot;
  }
  function update(current: Gesture) {
    const rows = [
      ...(list.current?.querySelectorAll<HTMLElement>('[data-query-rule-row]') ?? []),
    ].filter((row) => row.closest('[data-query-rule-list]') === list.current);
    let slot = rows.findIndex((row) => {
      const bounds = row.getBoundingClientRect();
      return current.y < bounds.top + bounds.height / 2;
    });
    if (slot < 0) slot = count;
    current.slot = slot;
    setPreview((value) =>
      value?.source === current.source && value.slot === slot
        ? value
        : { source: current.source, slot },
    );
  }
  function start(event: PointerEvent<HTMLButtonElement>, source: number) {
    if (event.button !== 0 || disabled) return;
    // Radix opens on pointer down; a short click opens the menu after release instead.
    event.preventDefault();
    suppressClick.current = false;
    if (count < 2) return;
    release();
    const element = event.currentTarget;
    const current: Gesture = {
      source,
      slot: source,
      pointer: event.pointerId,
      element,
      active: false,
      y: event.clientY,
      timer: setTimeout(() => {
        if (gesture.current !== current) return;
        current.active = true;
        suppressClick.current = true;
        element.focus({ preventScroll: true });
        update(current);
      }, 220),
    };
    gesture.current = current;
    element.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    current.y = event.clientY;
    if (current.active) {
      event.preventDefault();
      update(current);
    }
  }
  function finish(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    if (gesture.current?.pointer !== event.pointerId) return;
    const current = release()!;
    setPreview(null);
    const next = target(current.source, current.slot);
    if (current.active && !cancel && next !== current.source) onMove(current.source, next);
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (disabled || count < 2) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (event.repeat) return;
      if (preview?.source === index) {
        const next = target(index, preview.slot);
        release();
        setPreview(null);
        if (next !== index) onMove(index, next);
      } else setPreview({ source: index, slot: index });
    } else if (
      preview?.source === index &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown')
    ) {
      event.preventDefault();
      const next = Math.max(
        0,
        Math.min(count - 1, target(index, preview.slot) + (event.key === 'ArrowUp' ? -1 : 1)),
      );
      setPreview({ source: index, slot: next > index ? next + 1 : next });
    } else if (event.key === 'Escape' && (preview || gesture.current)) {
      event.preventDefault();
      if (gesture.current) suppressClick.current = true;
      release();
      setPreview(null);
    }
  }
  return {
    list,
    handle(index: number) {
      return {
        'aria-pressed': preview?.source === index,
        onPointerDown: (event: PointerEvent<HTMLButtonElement>) => start(event, index),
        onPointerMove: move,
        onPointerUp: (event: PointerEvent<HTMLButtonElement>) => finish(event),
        onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
        onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
        onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => keyboard(event, index),
        onClickCapture: (event: MouseEvent<HTMLButtonElement>) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            event.preventDefault();
            event.stopPropagation();
          }
        },
      };
    },
    row(index: number) {
      const moved = preview && target(preview.source, preview.slot) !== preview.source;
      return {
        'data-query-rule-row': index,
        'data-rule-dragging': preview?.source === index || undefined,
        'data-drop-edge':
          moved && preview.slot === index
            ? 'before'
            : moved && preview.slot === count && index === count - 1
              ? 'after'
              : undefined,
      };
    },
  };
}

export type QueryRuleDragHandle = ReturnType<ReturnType<typeof useQueryRuleReorder>['handle']>;
