import type { RelationalTableStructure } from '@fouc/shared';
import type { StructureEditCommitResult, StructureEditInput, StructureEditStepResult } from '@fouc/shared/relational-structure-edit';
import type { RelationalDriver, RelationalTransaction } from './drivers/relational-driver';
import { previewStructureEdit } from './structure-edit-preview';

export interface StructureEditCommitControl { signal?: AbortSignal; onStep?: (step: StructureEditStepResult) => void }
/** The caller owns permission, one-use plan binding and a fresh metadata fingerprint. */
export async function commitStructureEdit(driver: RelationalDriver, structure: RelationalTableStructure, input: StructureEditInput, control: StructureEditCommitControl = {}): Promise<StructureEditCommitResult> {
  const preview = previewStructureEdit(structure, input);
  if (!preview.executable) throw new Error(preview.issues.filter((issue) => issue.severity !== 'warning').map((issue) => issue.message).join('；'));
  control.signal?.throwIfAborted();
  await driver.assertEditable(structure.schema, structure.table);
  const results: StructureEditStepResult[] = preview.steps.map((step) => ({ id: step.id, status: 'unattempted' }));
  const notify = (index: number) => { try { control.onStep?.({ ...results[index] }); } catch { /* Observers cannot change transaction outcome. */ } };
  let active = -1, callbackComplete = false;
  const errorText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);
  if (preview.transaction === 'implicit-commit') {
    for (const [index, step] of preview.steps.entries()) {
      active = index; let executed = false;
      try {
        control.signal?.throwIfAborted();
        await driver.transaction(structure.schema, async (transaction) => {
          await withMysqlQuoteMode(transaction, async () => { control.signal?.throwIfAborted(); await transaction.query(step.sql, []); executed = true; });
        });
        results[index].status = 'committed'; notify(index);
      } catch (reason) {
        // A successful DDL query is already committed even when restoring SQL_MODE / wrapper COMMIT fails.
        results[index] = { id: step.id, status: executed ? 'committed' : transportFailure(reason) ? 'unknown' : 'failed', error: errorText(reason) }; notify(index);
        const committed = results.some((entry) => entry.status === 'committed');
        return { provider: structure.provider, outcome: results.some((entry) => entry.status === 'unknown') ? 'unknown' : committed ? 'partial' : 'failed', steps: results, error: errorText(reason) };
      }
    }
    return { provider: structure.provider, outcome: 'committed', steps: results, error: null };
  }
  try {
    await driver.transaction(structure.schema, async (transaction) => {
      for (const [index, step] of preview.steps.entries()) {
        active = index; control.signal?.throwIfAborted();
        await transaction.query(step.sql, []);
        // Do not announce a commit before the outer driver COMMIT completes.
        results[index].status = 'rolled-back';
      }
      control.signal?.throwIfAborted(); callbackComplete = true;
    });
    for (const [index, entry] of results.entries()) { entry.status = 'committed'; notify(index); }
    return { provider: structure.provider, outcome: 'committed', steps: results, error: null };
  } catch (reason) {
    const unknown = callbackComplete || transportFailure(reason);
    if (active >= 0) results[active] = { id: results[active].id, status: unknown ? 'unknown' : 'failed', error: errorText(reason) };
    if (unknown) for (const entry of results) if (entry.status === 'rolled-back') entry.status = 'unknown';
    for (const [index, entry] of results.entries()) if (entry.status !== 'unattempted') notify(index);
    return { provider: structure.provider, outcome: unknown ? 'unknown' : active < 0 ? 'failed' : 'rolled-back', steps: results, error: errorText(reason) };
  }
}
async function withMysqlQuoteMode<T>(transaction: RelationalTransaction, run: () => Promise<T>): Promise<T> {
  const result = await transaction.query('SELECT @@SESSION.sql_mode', []), original = String(result.rows[0]?.[0] ?? '');
  // SQL_MODE is a native comma-separated token list, never interpolated database text.
  if (!/^[A-Z0-9_,]*$/i.test(original)) throw new Error('无法可靠读取 MySQL SQL_MODE');
  const normalized = original.split(',').filter((mode) => mode.toUpperCase() !== 'NO_BACKSLASH_ESCAPES').join(',');
  if (normalized === original) return run();
  await transaction.query(`SET SESSION sql_mode = '${normalized}'`, []);
  try { return await run(); }
  finally { await transaction.query(`SET SESSION sql_mode = '${original}'`, []); }
}
function transportFailure(reason: unknown): boolean {
  if (!(reason instanceof Error)) return false;
  const code = 'code' in reason ? String(reason.code) : '';
  return /^(?:ECONNRESET|ECONNREFUSED|EPIPE|ETIMEDOUT|PROTOCOL_CONNECTION_LOST|57P01|57P02|57P03|08)/.test(code) || /connection (?:closed|terminated|lost)|socket hang up/i.test(reason.message);
}
