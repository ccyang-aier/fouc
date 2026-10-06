'use client';

import { DocumentStarIcon, useDocumentStarFeedback } from './document-star-icon';
import styles from './document-star-button.module.css';

export function DocumentStarButton({ starred, onToggle }: { starred: boolean; onToggle: () => void }) {
  const feedback = useDocumentStarFeedback(starred, onToggle);
  const label = starred ? '取消星标' : '添加星标';

  return <button
    type="button"
    className={`fouc-action ${styles.button}`}
    aria-label={label}
    title={label}
    aria-pressed={starred}
    onClick={feedback.toggle}
  >
    <DocumentStarIcon starred={starred} celebrating={feedback.celebrating} onAnimationEnd={feedback.finish} />
  </button>;
}
