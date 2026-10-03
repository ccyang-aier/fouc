import type { DatabaseCell } from '@fouc/shared';
import { tableTransferInputSchema, type TableTransferPlan, type TableTransferProgress, type TableTransferResult } from '@fouc/shared/table-transfer';
import type { RelationalDriver, RelationalTransaction, SqlParameter } from './drivers/relational-driver';
import { transferQuote, transferReadSql } from './transfer-prepare';
import { transferCellValue } from './transfer-values';

export interface TableTransferControl { signal?: AbortSignal; onProgress?: (progress: TableTransferProgress) => void }
const WRITE_BATCH_BYTES = 4 * 1024 * 1024, CELL_BYTES = 2 * 1024 * 1024, EXECUTION_MS = 5 * 60 * 1000;
/** DBX's typed batch transfer adapted to native drivers, a single target transaction and bounded memory. */
export async function executeTableTransfer(sourceDriver: RelationalDriver, targetDriver: RelationalDriver, plan: TableTransferPlan, control: TableTransferControl = {}): Promise<TableTransferResult> {
  tableTransferInputSchema.parse(plan.input);
  if (!plan.executable || plan.issues.some((issue) => issue.severity === 'error') || !plan.columns.length) throw new Error('传输计划未通过元数据校验');
  if (plan.effectiveBatchSize < 1 || plan.effectiveBatchSize > plan.input.batchSize || plan.columns.length !== plan.input.mappings.length) throw new Error('传输计划参数不合法');
  const started = Date.now(); let rowsRead = 0, rowsWritten = 0, batchesWritten = 0, bytesRead = 0;
  let sourceHasMore: boolean | null = null, transactionStarted = false, callbackComplete = false;
  const elapsed = () => Date.now() - started;
  const check = () => { control.signal?.throwIfAborted(); if (elapsed() > EXECUTION_MS) throw new Error('传输超过 5 分钟上限，已停止；请减小范围后重试'); };
  const progress = (phase: TableTransferProgress['phase']) => { try { control.onProgress?.({ phase, rowsRead, rowsWritten, batchesWritten, bytesRead, maxRows: plan.input.maxRows, elapsedMs: elapsed() }); } catch { /* Progress observers cannot affect database atomicity. */ } };
  const result = (status: TableTransferResult['status'], transaction: TableTransferResult['transaction'], error: string | null): TableTransferResult => ({ status, transaction, rowsRead, rowsWritten, rowsCommitted: transaction === 'committed' ? rowsWritten : transaction === 'unknown' ? null : 0, batchesWritten, bytesRead, sourceHasMore, elapsedMs: elapsed(), error });
  try {
    check(); await targetDriver.assertEditable(plan.target.schema, plan.target.table); check();
    await targetDriver.transaction(plan.target.schema, async (transaction) => {
      transactionStarted = true;
      const run = async () => {
        let offset = 0, exhausted = false;
        while (!exhausted) {
          check(); progress('reading');
          const remaining = plan.input.maxRows - rowsRead, take = Math.min(plan.effectiveBatchSize, remaining) + (remaining <= plan.effectiveBatchSize ? 1 : 0);
          const batch = await sourceDriver.read(transferReadSql(plan, offset, take), plan.source.schema, take, [], control.signal);
          if (batch.columns.length !== plan.columns.length || batch.columns.some((name, index) => name !== plan.columns[index].source.name)) throw new Error('源读取列与准备计划不一致，请重新准备');
          if (batch.rows.length > remaining || remaining === 0 && batch.rows.length) {
            sourceHasMore = true;
            if (plan.input.rowLimitMode === 'require-complete') throw new Error(`源行数超过 ${plan.input.maxRows.toLocaleString()} 行安全上限；本次目标事务回滚。可显式选择仅传输最多 N 行`);
          }
          const rows = batch.rows.slice(0, Math.max(0, remaining));
          if (sourceHasMore === true || batch.rows.length < take && !batch.hasMore) { exhausted = true; if (sourceHasMore !== true) sourceHasMore = false; }
          if (!rows.length) break;
          let values: SqlParameter[] = [], valueRows = 0, batchBytes = 0;
          const flush = async () => {
            if (!valueRows) return;
            check(); progress('writing');
            const response = await transaction.query(insertSql(plan, valueRows), values);
            if (response.affectedRows !== valueRows) throw new Error('目标数据库插入行数与批次不一致，停止并回滚');
            rowsWritten += valueRows; batchesWritten++; progress('writing');
            values = []; valueRows = 0; batchBytes = 0;
            check(); await new Promise<void>((resolve) => setTimeout(resolve, 0));
          };
          for (const [rowIndex, row] of rows.entries()) {
            check(); if (row.length !== plan.columns.length) throw new Error('源行字段数量不一致');
            const rowBytes = row.reduce<number>((total, cell) => total + cellBytes(cell), 0);
            if (rowBytes > WRITE_BATCH_BYTES) throw new Error('单行超过 4 MiB 传输上限');
            if (valueRows && batchBytes + rowBytes > WRITE_BATCH_BYTES) await flush();
            const parameters = row.map((cell, index) => {
              try { return transferCellValue(cell, plan.columns[index], plan); }
              catch (reason) { throw new Error(`源第 ${offset + rowIndex + 1} 行 / ${plan.columns[index].source.name} → ${plan.columns[index].target.name}：${reason instanceof Error ? reason.message : String(reason)}`); }
            });
            bytesRead += rowBytes; if (bytesRead > plan.maxBytes) throw new Error('传输超过 256 MiB 安全上限，目标事务回滚');
            rowsRead++; values.push(...parameters); valueRows++; batchBytes += rowBytes;
            if (valueRows >= plan.effectiveBatchSize) await flush();
          }
          await flush(); offset += rows.length;
        }
        check(); progress('committing');
      };
      if (plan.target.provider === 'mysql') await withMysqlStrictMode(transaction, run); else await run();
      check(); callbackComplete = true;
    });
    progress('completed'); return result('committed', 'committed', null);
  } catch (reason) {
    const text = reason instanceof Error ? reason.message : String(reason), unknown = transactionStarted && (callbackComplete || transportFailure(reason));
    progress('rolling-back');
    return result(unknown ? 'unknown' : control.signal?.aborted ? 'cancelled' : 'failed', unknown ? 'unknown' : transactionStarted ? 'rolled-back' : 'not-started', text);
  }
}
function insertSql(plan: TableTransferPlan, rows: number): string {
  const q = (name: string) => transferQuote(name, plan.target.provider), count = plan.columns.length;
  const placeholders = Array.from({ length: rows }, (_, row) => `(${Array.from({ length: count }, (_, column) => plan.target.provider === 'postgres' ? `$${row * count + column + 1}` : '?').join(', ')})`);
  return `INSERT INTO ${q(plan.target.schema)}.${q(plan.target.table)} (${plan.columns.map((column) => q(column.target.name)).join(', ')}) VALUES ${placeholders.join(', ')}`;
}
function cellBytes(cell: DatabaseCell): number {
  let bytes: number;
  if (cell === null) return 0;
  if (typeof cell === 'string') bytes = Buffer.byteLength(cell, 'utf8');
  else if (typeof cell === 'object' && !Array.isArray(cell) && cell.type === 'binary' && typeof cell.base64 === 'string') bytes = Math.ceil(cell.base64.length * 3 / 4);
  else if (typeof cell === 'object') throw new Error('复杂源值未转换为安全的原生标量');
  else bytes = 8;
  if (bytes > CELL_BYTES) throw new Error('单元格超过 2 MiB 传输上限'); return bytes;
}
async function withMysqlStrictMode<T>(transaction: RelationalTransaction, run: () => Promise<T>): Promise<T> {
  const response = await transaction.query('SELECT @@SESSION.sql_mode', []), original = String(response.rows[0]?.[0] ?? '');
  if (!/^[A-Z0-9_,]*$/i.test(original)) throw new Error('无法可靠读取 MySQL SQL_MODE');
  const mode = new Set(original.split(',').filter(Boolean)); mode.add('STRICT_ALL_TABLES'); mode.add('NO_AUTO_VALUE_ON_ZERO');
  const strict = [...mode].join(','); if (strict === original) return run();
  await transaction.query(`SET SESSION sql_mode = '${strict}'`, []);
  try { return await run(); } finally { await transaction.query(`SET SESSION sql_mode = '${original}'`, []); }
}
function transportFailure(reason: unknown): boolean {
  const code = reason && typeof reason === 'object' && 'code' in reason ? String(reason.code) : '';
  return /^(?:ECONNRESET|EPIPE|ETIMEDOUT|PROTOCOL_CONNECTION_LOST|57P01|57P02|57P03|08)/.test(code);
}
