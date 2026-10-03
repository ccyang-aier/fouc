import { useState } from 'react';
import { BracketsCurly } from '@phosphor-icons/react/dist/csr/BracketsCurly';
import { formatJsonSource } from '@fouc/shared';
import styles from './mutation.module.css';

export function MongoEjsonEditor({ label, value, onChange, disabled, helper, compact = false }: { label: string; value: string; onChange: (text: string) => void; disabled: boolean; helper: string; compact?: boolean }) {
  const [error, setError] = useState('');
  function format() {
    try { onChange(formatJsonSource(value, 2)); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }
  return <label className={styles.editor}>
    <span className={styles.editorLabel}><span><BracketsCurly size={14} />{label}</span><button type="button" disabled={disabled} onClick={format}>格式化</button></span>
    <textarea aria-label={label} value={value} disabled={disabled} spellCheck={false} data-compact={compact} onChange={event => { setError(''); onChange(event.target.value); }} />
    <small>{helper}</small>{error && <span className={styles.error} role="alert">{error}</span>}
  </label>;
}
