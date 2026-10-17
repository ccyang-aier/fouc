"use client";

import { useLayoutEffect, useRef, type ComponentProps, type RefObject } from 'react';
import { ChatTaskTag } from './chat-quick-actions';
import type { ChatTaskKind } from './chat-types';
import type { ChatText } from './chat-messages';
import styles from './chat-prompt-input.module.css';

export function ChatPromptInput({ inputRef, task, onRemoveTask, t, onKeyDown, onScroll, className, ...props }:
  Omit<ComponentProps<'textarea'>, 'ref'> & {
    inputRef: RefObject<HTMLTextAreaElement | null>;
    task: ChatTaskKind | null;
    onRemoveTask: () => void;
    t: ChatText;
  }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = tag.current;
    if (!element) {
      wrapper.current?.style.setProperty('--task-offset', '0px');
      return;
    }
    const measure = () => {
      wrapper.current?.style.setProperty('--task-offset', `${element.getBoundingClientRect().width + 8}px`);
      element.style.transform = `translateY(-${inputRef.current?.scrollTop ?? 0}px)`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [task, t, inputRef]);

  return <div ref={wrapper} className={styles.wrapper}>
    {task ? <div ref={tag} className={styles.tag}>
      <ChatTaskTag task={task} t={t} onRemove={onRemoveTask} />
    </div> : null}
    <textarea {...props} ref={inputRef} className={`${className ?? ''} ${styles.input}`}
      onScroll={event => {
        if (tag.current) tag.current.style.transform = `translateY(-${event.currentTarget.scrollTop}px)`;
        onScroll?.(event);
      }}
      onKeyDown={event => {
        if (task && event.key === 'Backspace' && !event.nativeEvent.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey
          && event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0) {
          event.preventDefault();
          onRemoveTask();
          return;
        }
        onKeyDown?.(event);
      }} />
  </div>;
}
