"use client";

import { useLayoutEffect, useRef, type ComponentProps, type RefObject } from 'react';
import { ChatModeTag } from './chat-modes';
import type { ChatMode } from './chat-types';
import type { ChatText } from './chat-messages';
import styles from './chat-prompt-input.module.css';

export function ChatPromptInput({ inputRef, mode, onRemoveMode, t, onKeyDown, onScroll, className, ...props }:
  Omit<ComponentProps<'textarea'>, 'ref'> & {
    inputRef: RefObject<HTMLTextAreaElement | null>;
    mode: ChatMode | null;
    onRemoveMode: () => void;
    t: ChatText;
  }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = tag.current;
    if (!element) {
      wrapper.current?.style.setProperty('--mode-offset', '0px');
      return;
    }
    const measure = () => {
      wrapper.current?.style.setProperty('--mode-offset', `${element.getBoundingClientRect().width + 8}px`);
      element.style.transform = `translateY(-${inputRef.current?.scrollTop ?? 0}px)`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [mode, t, inputRef]);

  return <div ref={wrapper} className={styles.wrapper}>
    {mode ? <div ref={tag} className={styles.tag}>
      <ChatModeTag mode={mode} t={t} onRemove={onRemoveMode} />
    </div> : null}
    <textarea {...props} ref={inputRef} className={`${className ?? ''} ${styles.input}`}
      onScroll={event => {
        if (tag.current) tag.current.style.transform = `translateY(-${event.currentTarget.scrollTop}px)`;
        onScroll?.(event);
      }}
      onKeyDown={event => {
        if (mode && event.key === 'Backspace' && !event.nativeEvent.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey
          && event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0) {
          event.preventDefault();
          onRemoveMode();
          return;
        }
        onKeyDown?.(event);
      }} />
  </div>;
}
