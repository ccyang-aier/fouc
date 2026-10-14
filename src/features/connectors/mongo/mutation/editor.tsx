'use client';
import { useTranslation } from '@/lib/i18n';
import { formatJsonSource } from '@fouc/shared';
import { BracketsCurly } from '@phosphor-icons/react/dist/csr/BracketsCurly';
import { useState } from 'react';
import { uiFailure, uiText, type UiMessage } from '../../i18n/ui-message';
import { messages as unitMessages } from './../i18n/mutation-editor';
import styles from './mutation.module.css';

export function MongoEjsonEditor({
  label,
  value,
  onChange,
  disabled,
  helper,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  disabled: boolean;
  helper: string;
  compact?: boolean;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [error, setError] = useState<UiMessage>('');
  function format() {
    try {
      onChange(formatJsonSource(value, 2));
      setError('');
    } catch (reason) {
      setError(uiFailure(reason));
    }
  }
  return (
    <label className={styles.editor}>
      <span className={styles.editorLabel}>
        <span>
          <BracketsCurly size={14} />
          {label}
        </span>
        <button type="button" disabled={disabled} onClick={format}>
          {tu('格式化')}
        </button>
      </span>
      <textarea
        aria-label={label}
        value={value}
        disabled={disabled}
        spellCheck={false}
        data-compact={compact}
        onChange={(event) => {
          setError('');
          onChange(event.target.value);
        }}
      />
      <small>{helper}</small>
      {error && (
        <span className={styles.error} role="alert">
          {uiText(error, locale)}
        </span>
      )}
    </label>
  );
}
