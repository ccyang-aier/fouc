import { createUiMessages } from '../i18n/ui-message';
import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-files.messages';
import { SQL_FILE_MAX_BYTES } from '@fouc/shared';
const connectorUiMessages = createUiMessages(connectorMessages);
export type SqlFileEncoding = 'auto' | 'utf-8' | 'utf-16le' | 'utf-16be' | 'gb18030';
export type OpenSqlFile = {
  name: string;
  sql: string;
  encoding: Exclude<SqlFileEncoding, 'auto'>;
  sourceBytes: number;
};
/** DBX's browser SQL-file workflow, with explicit decoding and Fouc document limits. */
export function isSqlFilePath(path: string): boolean {
  return /\.sql$/i.test(path.trim());
}
export function sqlFileTitleFromPath(path: string): string {
  return path.trim().replace(/\\/g, '/').split('/').filter(Boolean).at(-1) || 'script.sql';
}
export class ExternalSqlFileTooLargeError extends Error {
  constructor(
    readonly sizeBytes: number,
    readonly maxSizeBytes: number,
  ) {
    super(
      createTranslator(connectorMessages)('sqlFileExceedsTheLimit', {
        p0: formatSqlFileSize(sizeBytes),
        p1: formatSqlFileSize(maxSizeBytes),
      }),
    );
    this.name = 'ExternalSqlFileTooLargeError';
  }
}
export function formatSqlFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024,
    index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[index]}`;
}
export function decodeSqlFile(
  bytes: Uint8Array,
  requested: SqlFileEncoding = 'auto',
): {
  sql: string;
  encoding: OpenSqlFile['encoding'];
} {
  const encoding =
    requested !== 'auto'
      ? requested
      : bytes[0] === 0xff && bytes[1] === 0xfe
        ? 'utf-16le'
        : bytes[0] === 0xfe && bytes[1] === 0xff
          ? 'utf-16be'
          : 'utf-8';
  let sql: string;
  try {
    sql = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw connectorUiMessages.error('theFileCannotBeDecodedAsSelectItsOriginalEncoding', {
      p0: String(encoding.toUpperCase()),
    });
  }
  if (sql.includes('\0'))
    throw connectorUiMessages.error('theFileContainsNulBytesCheckItsEncodingOrChoose');
  const size = new TextEncoder().encode(sql).byteLength;
  if (size > SQL_FILE_MAX_BYTES) throw new ExternalSqlFileTooLargeError(size, SQL_FILE_MAX_BYTES);
  return { sql, encoding };
}
export async function readBrowserSqlFile(
  file: File,
  encoding: SqlFileEncoding,
  signal: AbortSignal,
  locale?: Locale,
): Promise<OpenSqlFile> {
  const tConnector = createTranslator(connectorMessages, locale);
  if (!isSqlFilePath(file.name))
    throw connectorUiMessages.error('chooseASqlFile', { p0: String(file.name) });
  if (file.size > SQL_FILE_MAX_BYTES)
    throw new ExternalSqlFileTooLargeError(file.size, SQL_FILE_MAX_BYTES);
  if (signal.aborted) throw new DOMException(tConnector('sqlFileReadCancelled'), 'AbortError');
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => reader.abort();
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    reader.onload = () => {
      cleanup();
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(connectorUiMessages.error('sqlFileReadFailed'));
    };
    reader.onerror = () => {
      cleanup();
      reject(reader.error ?? connectorUiMessages.error('sqlFileReadFailed'));
    };
    reader.onabort = () => {
      cleanup();
      reject(new DOMException(tConnector('sqlFileReadCancelled'), 'AbortError'));
    };
    reader.readAsArrayBuffer(file);
  });
  if (signal.aborted) throw new DOMException(tConnector('sqlFileReadCancelled'), 'AbortError');
  return {
    name: sqlFileTitleFromPath(file.name),
    ...decodeSqlFile(new Uint8Array(bytes), encoding),
    sourceBytes: file.size,
  };
}
export function downloadSqlFile(sql: string, title: string): void {
  const name = sqlFileTitleFromPath(title).replace(/[<>:"|?*\u0000-\u001f]/g, '_');
  const url = URL.createObjectURL(new Blob([sql], { type: 'application/sql;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = isSqlFilePath(name) ? name : name + '.sql';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
