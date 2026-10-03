'use client';

import { useEffect, useEffectEvent, useId, useState } from 'react';
import styles from './connection-options.module.css';

export function ConnectionDurationField({
  label,
  milliseconds,
  maximum,
  disabled,
  onChange,
  onValidityChange,
}: {
  label: string;
  milliseconds: number;
  maximum: number;
  disabled?: boolean;
  onChange: (milliseconds: number) => void;
  onValidityChange: (valid: boolean) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState({
    source: milliseconds,
    text: String(milliseconds / 1000),
    error: '',
  });
  const current =
    draft.source === milliseconds
      ? draft
      : { source: milliseconds, text: String(milliseconds / 1000), error: '' };
  const valid = !current.error;
  const notifyValidity = useEffectEvent((next: boolean) =>
    onValidityChange(next),
  );
  useEffect(() => {
    notifyValidity(valid);
  }, [valid]);
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}</span>
      <div className={styles.unitInput}>
        <input
          id={id}
          type="number"
          min={1}
          max={maximum / 1000}
          step={0.001}
          required
          disabled={disabled}
          aria-invalid={!!current.error}
          aria-describedby={current.error ? `${id}-error` : undefined}
          value={current.text}
          onChange={(event) => {
            const text = event.target.value,
              seconds = Number(text),
              next = seconds * 1000;
            const valid =
              text !== '' &&
              Number.isFinite(next) &&
              Math.abs(next - Math.round(next)) < 1e-7 &&
              next >= 1000 &&
              next <= maximum;
            setDraft({
              source: valid ? Math.round(next) : milliseconds,
              text,
              error: valid ? '' : `请输入 1–${maximum / 1000} 秒，最多三位小数`,
            });
            if (valid) onChange(Math.round(next));
          }}
        />
        <span>秒</span>
      </div>
      {current.error && (
        <small id={`${id}-error`} className={styles.error}>
          {current.error}
        </small>
      )}
    </label>
  );
}
