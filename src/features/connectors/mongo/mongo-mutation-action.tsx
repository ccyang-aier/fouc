'use client'
import { useState } from 'react'
import type { MongoMutationInput } from '@fouc/shared/mongo-mutation'
import { MongoMutationDialog } from './mutation'
import styles from './mongo.module.css'

export function MongoMutationAction({ base, input, label, writable, disabled, onApplied }: { base: string; input: MongoMutationInput; label: string; writable: boolean; disabled?: boolean; onApplied: () => void }) {
  const [snapshot, setSnapshot] = useState<MongoMutationInput | null>(null)
  return <><button type="button" className={styles.smallButton} disabled={!writable || disabled} title={writable ? label : '先解锁 MongoDB 写入'} onClick={() => setSnapshot({ ...input })}>{label}</button>{snapshot && <MongoMutationDialog base={base} input={snapshot} onClose={() => setSnapshot(null)} onApplied={onApplied} />}</>
}
