'use client';
import { uiText, type UiMessage } from '../../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './connection-target.messages';
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, WarningCircle } from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ConnectionListRow } from './types';
import styles from './connection-list.module.css';
export function ConnectionTarget({
  row,
  file = false,
}: {
  row: ConnectionListRow;
  file?: boolean;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [feedbackStored, setFeedback] = useState<UiMessage | null>(null);
  const feedback = feedbackStored === null ? null : uiText(feedbackStored, locale);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(row.targetTitle);
      setFeedback('copied');
    } catch {
      setFeedback('error');
    }
    timer.current = setTimeout(() => setFeedback(null), 2000);
  }
  const message =
    feedback === 'copied'
      ? tConnector('copied')
      : feedback === 'error'
        ? tConnector('copyFailedTryAgain')
        : tConnector('copy', {
            p0: String(file ? tConnector('filePath') : tConnector('connectionTarget')),
          });
  return (
    <div className={styles.targetCell}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={styles.target} tabIndex={0}>
            {row.target}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[min(640px,80vw)] break-all font-mono">
          {row.targetTitle}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.copyButton}`}
            aria-label={`${message} · ${row.name}`}
            data-copied={feedback === 'copied'}
            data-error={feedback === 'error'}
            onClick={() => void copy()}
          >
            {feedback === 'copied' ? (
              <Check size={14} weight="bold" />
            ) : feedback === 'error' ? (
              <WarningCircle size={14} weight="bold" />
            ) : (
              <Copy size={14} weight="bold" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{message}</TooltipContent>
      </Tooltip>
      {feedback && (
        <span className="sr-only" role="status">
          {message}
        </span>
      )}
    </div>
  );
}
