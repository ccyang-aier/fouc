'use client'

import { ArrowsClockwise, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import common from '../relational.module.css'
import styles from './connection-dialog.module.css'
import type { DatabaseConnectionOptionsInput } from '@fouc/shared/connection-options'

export type ConnectionPendingAction = 'test' | 'submit' | null
export type ConnectionVerification = { password: string; connectionOptions?: DatabaseConnectionOptionsInput }

export function ConnectionDialogActions({ pending, valid, feedback, testError, submitLabel, onTest, onClose }: {
  pending: ConnectionPendingAction
  valid: boolean
  feedback: string
  testError: string
  submitLabel: string
  onTest: () => void
  onClose: () => void
}) {
  const busy = pending !== null
  const detail = testError || feedback
  return <footer className={common.dialogFooter}>
    <div className={styles.testGroup}>
      <button type="button" className={`fouc-action ${common.secondary}`} disabled={busy || !valid} aria-busy={pending === 'test'} onClick={onTest}>
        <ArrowsClockwise size={15} weight="bold" className={pending === 'test' ? styles.spinner : undefined} />
        {pending === 'test' ? '测试中' : '测试连接'}
      </button>
      {detail && <Tooltip>
        <TooltipTrigger asChild>
          <span className={styles.testResult} data-error={Boolean(testError)} role={testError ? 'alert' : 'status'} tabIndex={0}>
            {testError ? <WarningCircle size={15} weight="bold" /> : <CheckCircle size={15} weight="bold" />}
            <span>{testError ? '连接失败' : '测试通过'}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[min(480px,80vw)] break-words">{detail}</TooltipContent>
      </Tooltip>}
    </div>
    <div className={styles.footerActions}>
      <button type="button" className={`fouc-action ${common.secondary}`} disabled={busy} onClick={onClose}>取消</button>
      <button type="submit" className={common.primary} disabled={busy || !valid}>{pending === 'submit' ? '处理中…' : submitLabel}</button>
    </div>
  </footer>
}
