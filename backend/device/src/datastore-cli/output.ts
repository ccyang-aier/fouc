import { link, mkdir, open, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { DatastoreCliError } from './types';

/** One complete output is staged beside its target; an existing file needs explicit overwrite. */
export async function writeCliOutput(filename: string, text: string, overwrite: boolean): Promise<void> {
  const target = path.resolve(filename);
  const directory = path.dirname(target);
  await mkdir(directory, { recursive: true });
  const temporary = path.join(directory, '.fouc-cli-' + crypto.randomUUID() + '.tmp');
  try {
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(text, 'utf8'); await file.sync(); }
    finally { await file.close(); }
    if (!overwrite) {
      // Publish the complete staged file exclusively, without exposing a partial destination.
      await link(temporary, target);
    } else {
      try {
        const existing = await stat(target);
        if (!existing.isFile()) throw new DatastoreCliError('Output target is not a regular file', 2, 'invalid_output');
      } catch (reason) {
        if (!(reason instanceof Error && 'code' in reason && reason.code === 'ENOENT')) throw reason;
      }
      await rename(temporary, target);
    }
  } catch (reason) {
    if (reason instanceof Error && 'code' in reason && reason.code === 'EEXIST') throw new DatastoreCliError('Output file exists; use an explicit --overwrite to replace it', 2, 'output_exists');
    throw reason;
  } finally { await rm(temporary, { force: true }); }
}
