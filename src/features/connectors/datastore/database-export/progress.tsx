'use client';

import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { StopCircle } from '@phosphor-icons/react/dist/csr/StopCircle';
import type { DatabaseExportProgress } from '@fouc/shared/database-export';
import styles from './database-export.module.css';

export function exportBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

export function ExportProgress({ value }: { value: DatabaseExportProgress; }) {
  const complete = value.status === 'completed';
  const failed = value.status === 'failed';
  const cancelled = value.status === 'cancelled';
  const active = !complete && !failed && !cancelled;
  const ratio = complete ? 100 : value.totalTables ? Math.min(99, value.completedTables / value.totalTables * 100) : 0;
  const warnings = value.summary?.warnings ?? [...(value.review?.warnings ?? []), ...(value.review?.tables.flatMap(table => table.warnings.map(warning => `${table.schema}.${table.table}: ${warning}`)) ?? [])];
  const title = { preparing: '正在确认原生结构与读取范围', running: '正在读取并写入原生数据', finalizing: '正在封装清单与完成文件', completed: '原生数据库导出已完成', cancelled: '导出已取消，临时文件已清理', failed: '导出未完成，文件未开放下载' }[value.status];
  return <div className={styles.progress} aria-live="polite">
    <div className={styles.statusIcon} data-status={value.status}>{active ? <span className={styles.spinner} /> : complete ? <CheckCircle size={28} weight="duotone" /> : cancelled ? <StopCircle size={28} weight="duotone" /> : <WarningCircle size={28} weight="duotone" />}
    </div>
    <h2>{title}
    </h2>
    <p className={styles.current}>{value.table ? `${value.table.schema}.${value.table.table}` : complete ? value.artifact?.filename : active ? '只读源连接 · 设备本地流式写入' : '源数据未被修改'}
    </p>
    <div className={styles.progressTrack} role="progressbar" aria-label="完成的导出对象" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value.totalTables ? Math.round(ratio) : undefined} data-indeterminate={value.totalTables === null && active}>
      <span style={{ width: `${ratio}%` }} />
    </div>
    <div className={styles.statistics}>
      <div>
        <strong>{value.rows.toLocaleString()}
        </strong>
        <span>实际导出行</span>
      </div>
      <div>
        <strong>{exportBytes(value.bytes)}
        </strong>
        <span>已写入设备</span>
      </div>
      <div>
        <strong>{value.completedTables}
          <small> / {value.totalTables ?? '—'}
          </small>
        </strong>
        <span>已完成对象</span>
      </div>
    </div>
    <p className={styles.helper}>对象进度不代表全表行数百分比；原生目录不预先扫描 COUNT(*)，实际行数以已读取数据为准。</p>
    {value.error && <p className={styles.error} role="alert">{value.error}
    </p>}
    {value.summary && <div className={styles.results}>
      <div className={styles.resultsHeader}>
        <strong>实际导出范围</strong>
        <span>{value.summary.rowLimit === null ? '每表全部可见行' : `每表最多 ${value.summary.rowLimit.toLocaleString()} 行`}
        </span>
      </div>
      <div className={styles.resultRows}>{value.summary.tables.map(table => <div key={JSON.stringify([table.schema, table.table])}>
        <span>{table.table}
          <small>{table.schema} · {table.pagination === 'keyset' ? '唯一键游标' : 'OFFSET'}
          </small>
        </span>
        <strong>{table.rows.toLocaleString()} 行</strong>
        <small data-limited={table.limited}>{table.limited ? '仍有更多行 · 显式限量' : '已读至范围末尾'}
        </small>
      </div>)}
      </div>
    </div>}
    {warnings.length > 0 && <details className={styles.warnings} open={!active}>
      <summary>原生一致性与格式说明 · {warnings.length}
      </summary>{warnings.map((warning, index) => <p key={index}>{warning}
      </p>)}
    </details>}
  </div>;
}
