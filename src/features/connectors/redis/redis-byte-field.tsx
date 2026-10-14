'use client';

import { useTranslation } from '@/lib/i18n';
import { useState } from 'react';
import { createUiMessages, uiFailure, uiText, type UiMessage } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/redis-byte-field';
import styles from './redis-editing.module.css';
import { bytesToDraft, draftToBytes, type RedisByteDraft } from './redis-mutation-model';
const { error: uiError } = createUiMessages(unitMessages);

export function RedisByteField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: RedisByteDraft;
  onChange: (value: RedisByteDraft) => void;
  multiline?: boolean;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [error, setError] = useState<UiMessage>('');
  function changeEncoding(encoding: RedisByteDraft['encoding']) {
    try {
      const raw = draftToBytes(value);
      const converted = bytesToDraft(raw);
      if (encoding === 'text' && converted.encoding !== 'text')
        throw uiError('此值包含二进制字节，请使用 Base64 编辑。');
      onChange(encoding === 'base64' ? { encoding, text: raw } : converted);
      setError('');
    } catch (reason) {
      setError(uiFailure(reason));
    }
  }
  return (
    <div className={styles.byteField}>
      <div className={styles.fieldHead}>
        <span>{label}</span>
        <select
          aria-label={tu('{v0}编码', { v0: String(label) })}
          value={value.encoding}
          onChange={(event) => changeEncoding(event.target.value as RedisByteDraft['encoding'])}
        >
          <option value="text">{tu('UTF-8 文本')}</option>
          <option value="base64">{tu('Base64 字节')}</option>
        </select>
      </div>
      {multiline ? (
        <textarea
          aria-label={label}
          rows={8}
          value={value.text}
          spellCheck={false}
          onChange={(event) => {
            setError('');
            onChange({ ...value, text: event.target.value });
          }}
        />
      ) : (
        <input
          aria-label={label}
          value={value.text}
          spellCheck={false}
          onChange={(event) => {
            setError('');
            onChange({ ...value, text: event.target.value });
          }}
        />
      )}
      {error && (
        <small role="alert" className={styles.error}>
          {uiText(error, locale)}
        </small>
      )}
    </div>
  );
}
