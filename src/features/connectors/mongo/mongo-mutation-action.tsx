'use client';
import { useTranslation } from '@/lib/i18n';
import type { MongoMutationInput } from '@fouc/shared/mongo-mutation';
import { useState } from 'react';
import { messages as unitMessages } from './i18n/mongo-mutation-action';
import styles from './mongo.module.css';
import { MongoMutationDialog } from './mutation';

export function MongoMutationAction({
  base,
  input,
  label,
  writable,
  disabled,
  onApplied,
}: {
  base: string;
  input: MongoMutationInput;
  label: string;
  writable: boolean;
  disabled?: boolean;
  onApplied: () => void;
}) {
  const { t: tu } = useTranslation(unitMessages);

  const [snapshot, setSnapshot] = useState<MongoMutationInput | null>(null);
  return (
    <>
      <button
        type="button"
        className={styles.smallButton}
        disabled={!writable || disabled}
        title={writable ? label : tu('先解锁 MongoDB 写入')}
        onClick={() => setSnapshot({ ...input })}
      >
        {label}
      </button>
      {snapshot && (
        <MongoMutationDialog
          base={base}
          input={snapshot}
          onClose={() => setSnapshot(null)}
          onApplied={onApplied}
        />
      )}
    </>
  );
}
