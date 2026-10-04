'use client';

import { useState, type ReactNode } from 'react';
import {
  ArrowsLeftRight,
  ClockCounterClockwise,
  PushPin,
  Trash,
  X,
} from '@phosphor-icons/react';
import type { DatabaseQueryResult, RelationalProvider } from '@fouc/shared';
import { SqlQueryResult } from '../query-result';
import { SqlDialog } from '../sql-library-dialog';
import { DataComparePanel } from '../data-compare/panel';
import { scopedResultPins, type ResultPin, type ResultPinScope } from './model';
import styles from './result-pins.module.css';

type Props = {
  scope: ResultPinScope;
  pins: readonly ResultPin[];
  current: { result: DatabaseQueryResult; id: string; label: string } | null;
  provider: RelationalProvider;
  children: ReactNode;
  layoutScopeKey?: string;
  onRemove: (id: string) => void;
  onClear: () => void;
  onNotice: (message: string) => void;
  onSqlPreview: (sql: string) => void;
};
export function ResultPins({
  scope,
  pins,
  current,
  provider,
  children,
  layoutScopeKey,
  onRemove,
  onClear,
  onNotice,
  onSqlPreview,
}: Props) {
  const entries = scopedResultPins(pins, scope);
  const [active, setActive] = useState<string | null>(null),
    [comparison, setComparison] = useState<{
      pin: ResultPin;
      right: DatabaseQueryResult;
      label: string;
    } | null>(null);
  const selected = entries.find((pin) => pin.id === active);
  if (!entries.length) return <>{children}</>;
  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <div className={styles.tabs} role="tablist" aria-label="固定结果快照">
          <button
            type="button"
            role="tab"
            aria-selected={!selected}
            onClick={() => setActive(null)}
          >
            <ClockCounterClockwise size={13} />
            当前执行
          </button>
          {entries.map((pin) => (
            <button
              key={pin.id}
              type="button"
              role="tab"
              aria-selected={pin.id === selected?.id}
              title={`${pin.label}\n固定于 ${new Date(pin.capturedAt).toLocaleTimeString()} · ${Math.max(1, Math.round(pin.bytes / 1024))} KiB\n再次运行不会覆盖，快照仅保留在当前工作台\n${pin.sql}`}
              onClick={() => setActive(pin.id)}
            >
              <PushPin size={12} weight="fill" />
              <span>{pin.label}</span>
              <small>{pin.result.rows.length} 行</small>
            </button>
          ))}
        </div>
        <div className={styles.barActions}>
          {selected && (
            <>
              <button
                type="button"
                aria-label="与当前比较"
                disabled={
                  !current ||
                  current.id === selected.sourceId ||
                  !current.result.columns.length
                }
                title="比较固定参考与当前已加载结果"
                onClick={() =>
                  current &&
                  setComparison({
                    pin: selected,
                    right: current.result,
                    label: current.label,
                  })
                }
              >
                <ArrowsLeftRight size={13} />
                <span>比较</span>
              </button>
              <button
                type="button"
                aria-label="取消固定当前结果"
                title="取消固定当前结果"
                onClick={() => {
                  onRemove(selected.id);
                  setActive(null);
                }}
              >
                <X size={13} />
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="清除当前标签固定结果"
            title="取消当前标签的全部固定结果"
            onClick={() => {
              onClear();
              setActive(null);
            }}
          >
            <Trash size={13} />
          </button>
        </div>
      </div>
      {selected ? (
        <>
          <div className={styles.body}>
            <SqlQueryResult
              result={selected.result}
              provider={provider}
              scopeKey={`pin:${selected.id}`}
              layoutScopeKey={layoutScopeKey}
            />
          </div>
        </>
      ) : (
        <div className={styles.body}>{children}</div>
      )}
      {comparison && (
        <SqlDialog
          title="固定结果与当前结果比较"
          className={styles.compareDialog}
          onClose={() => setComparison(null)}
        >
          <div className={styles.compareBody}>
            <DataComparePanel
              left={comparison.pin.result}
              right={comparison.right}
              leftLabel={`${comparison.pin.label} · 固定快照`}
              rightLabel={`${comparison.label} · 当前执行`}
              provider={provider}
              scopeKey={comparison.pin.id}
              onNotice={onNotice}
              onSqlPreview={(sql) => {
                setComparison(null);
                onSqlPreview(sql);
              }}
            />
          </div>
          <footer className={styles.compareFooter}>
            <span>仅比较打开时两份已加载快照</span>
            <button type="button" onClick={() => setComparison(null)}>
              关闭比较
            </button>
          </footer>
        </SqlDialog>
      )}
    </div>
  );
}
