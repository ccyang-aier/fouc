'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-query-toolbar.messages';
import type { ReactNode } from 'react';
import { Play, PlayCircle, PlaySquare, Stop } from '@/components/icons';
import type { SqlExecutionMode } from '@fouc/shared';
import { Button } from '@/components/ui/button';
import styles from './sql-query-toolbar.module.css';
export function SqlQueryToolbar({
  running,
  cancelling,
  disabled,
  mode,
  onRun,
  onRunNewResult,
  onCancel,
  children,
  target,
  database,
  status,
}: {
  running: boolean;
  cancelling: boolean;
  disabled: boolean;
  mode: SqlExecutionMode;
  onRun: (mode: SqlExecutionMode) => void;
  onRunNewResult: () => void;
  onCancel: () => void;
  children: ReactNode;
  target: ReactNode;
  database: string;
  status: ReactNode;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  return (
    <div className={styles.toolbar} aria-label={tConnector('sqlQueryToolbar')}>
      <>
        <div className={styles.controls}>
          <Button
            variant="ghost"
            size="icon-sm"
            className={styles.run}
            data-running={running || undefined}
            aria-label={running ? tConnector('cancelQuery') : tConnector('run')}
            title={
              running
                ? tConnector('interruptDatabaseQuery')
                : tConnector('runSqlCtrlEnterSelectionFirst')
            }
            loading={cancelling}
            disabled={disabled}
            onClick={() => (running ? onCancel() : onRun(mode))}
          >
            {running ? <Stop /> : <Play />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className={styles.runNew}
            aria-label={tConnector('runAndKeepPreviousResults')}
            title={tConnector('runAndKeepPreviousResults')}
            disabled={disabled || running}
            onClick={onRunNewResult}
          >
            <PlaySquare aria-hidden />
          </Button>
          {children}
          <Button
            variant="ghost"
            size="icon-sm"
            className={styles.runAll}
            aria-label={tConnector('runAllStatements')}
            title={tConnector('runAllStatementsCtrlShiftEnter')}
            disabled={disabled || running}
            onClick={() => onRun('all')}
          >
            <PlayCircle />
          </Button>
        </div>
      </>
      <div className={styles.target}>
        <span className={styles.database} title={database}>
          {database}
        </span>
        {target}
        <div className={styles.status}>{status}</div>
      </div>
    </div>
  );
}
