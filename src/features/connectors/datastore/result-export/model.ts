import { createUiMessages } from '../../i18n/ui-message';
import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './model.messages';
import type { DatabaseQueryResult, RelationalProvider } from '@fouc/shared';
const connectorUiMessages = createUiMessages(connectorMessages);
export type ResultExportFormat = 'csv' | 'tsv' | 'json' | 'markdown' | 'sql';
export interface ResultExportTarget {
  schema?: string | null;
  table: string;
}
export interface ResultExportOptions {
  format: ResultExportFormat;
  includeHeader?: boolean;
  quoteMode?: 'all' | 'necessary';
  newline?: 'lf' | 'crlf';
  bom?: boolean;
  nullMode?: 'empty' | 'literal' | 'custom';
  nullText?: string;
  binaryFormat?: 'hex' | 'base64';
  jsonShape?: 'matrix' | 'records';
  sqlInsertMode?: 'batch' | 'single';
  sqlBatchSize?: number;
  target?: ResultExportTarget;
}
export interface ResultExportSelection {
  selectedRows?: readonly number[];
  selectedColumns?: readonly number[];
}
export interface ResultExportProgress {
  completedRows: number;
  totalRows: number;
  byteLength: number;
}
export interface ResultExportControl extends ResultExportSelection {
  signal?: AbortSignal;
  onProgress?: (progress: ResultExportProgress) => void;
}
export interface ResultExportArtifact {
  chunks: string[];
  mimeType: string;
  extension: string;
  rowCount: number;
  columnCount: number;
  byteLength: number;
}
export interface ResultExportPreview {
  text: string;
  rowCount: number;
  totalRows: number;
  truncated: boolean;
}
export const RESULT_EXPORT_FORMATS = (
  locale?: Locale,
): readonly {
  value: ResultExportFormat;
  label: string;
  detail: string;
  extension: string;
  mimeType: string;
}[] => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    {
      value: 'csv',
      label: 'CSV',
      detail: tConnector('commaSeparated'),
      extension: 'csv',
      mimeType: 'text/csv;charset=utf-8',
    },
    {
      value: 'tsv',
      label: 'TSV',
      detail: tConnector('tabSeparated'),
      extension: 'tsv',
      mimeType: 'text/tab-separated-values;charset=utf-8',
    },
    {
      value: 'json',
      label: 'JSON',
      detail: tConnector('structuredData'),
      extension: 'json',
      mimeType: 'application/json;charset=utf-8',
    },
    {
      value: 'markdown',
      label: 'Markdown',
      detail: tConnector('documentTable'),
      extension: 'md',
      mimeType: 'text/markdown;charset=utf-8',
    },
    {
      value: 'sql',
      label: 'SQL',
      detail: tConnector('nativeInsert'),
      extension: 'sql',
      mimeType: 'application/sql;charset=utf-8',
    },
  ];
};
export const DEFAULT_RESULT_EXPORT_OPTIONS: ResultExportOptions = {
  format: 'csv',
  includeHeader: true,
  quoteMode: 'all',
  newline: 'lf',
  bom: false,
  nullMode: 'empty',
  nullText: '',
  binaryFormat: 'hex',
  jsonShape: 'matrix',
  sqlInsertMode: 'batch',
  sqlBatchSize: 500,
};
export interface ExportPlan {
  provider: RelationalProvider;
  result: DatabaseQueryResult;
  options: Required<Omit<ResultExportOptions, 'target'>> & {
    target?: ResultExportTarget;
  };
  columns: number[];
  rows: readonly number[] | null;
  rowCount: number;
  newline: string;
  nullText: string;
}
function indices(
  input: readonly number[] | undefined,
  length: number,
  label: string,
): number[] | null {
  if (input === undefined) return null;
  const selected = new Set<number>();
  for (const index of input) {
    if (!Number.isInteger(index) || index < 0 || index >= length)
      throw connectorUiMessages.error('theScopeChangedSelectAgain', { p0: String(label) });
    selected.add(index);
  }
  return [...selected];
}
export function createExportPlan(
  result: DatabaseQueryResult,
  provider: RelationalProvider,
  input: ResultExportOptions,
  selection: ResultExportSelection = {},
  locale?: Locale,
): ExportPlan {
  const tConnector = createTranslator(connectorMessages, locale);
  if (!['mysql', 'postgres', 'sqlite'].includes(provider))
    throw connectorUiMessages.error('resultExportIsUnavailableForTheCurrentDatabase');
  if (!RESULT_EXPORT_FORMATS(locale).some((entry) => entry.value === input.format))
    throw connectorUiMessages.error('chooseASupportedExportFormat');
  const options = { ...DEFAULT_RESULT_EXPORT_OPTIONS, ...input } as ExportPlan['options'];
  const columns =
    indices(selection.selectedColumns, result.columns.length, tConnector('columns')) ??
    result.columns.map((_, index) => index);
  const rows = indices(selection.selectedRows, result.rows.length, tConnector('row'));
  if (!columns.length) throw connectorUiMessages.error('selectAtLeastOneColumn');
  if (
    !['all', 'necessary'].includes(options.quoteMode) ||
    !['lf', 'crlf'].includes(options.newline) ||
    !['empty', 'literal', 'custom'].includes(options.nullMode) ||
    !['hex', 'base64'].includes(options.binaryFormat) ||
    !['matrix', 'records'].includes(options.jsonShape) ||
    !['batch', 'single'].includes(options.sqlInsertMode)
  )
    throw connectorUiMessages.error('invalidExportConfiguration');
  if (
    !Number.isInteger(options.sqlBatchSize) ||
    options.sqlBatchSize < 1 ||
    options.sqlBatchSize > 1000
  )
    throw connectorUiMessages.error('sqlBatchSizeMustBeRows');
  const nullText =
    options.nullMode === 'empty' ? '' : options.nullMode === 'literal' ? 'NULL' : options.nullText;
  const textFormat = ['csv', 'tsv', 'markdown'].includes(options.format);
  const nullSpecial = options.format === 'tsv' ? /[\r\n\t"]/ : /[\r\n\t,"]/;
  if (textFormat && (nullText.length > 64 || nullSpecial.test(nullText)))
    throw connectorUiMessages.error('nullMarkersSupportUpToCharactersAndCannotContainDelimiters');
  if (options.format === 'sql') {
    if (!options.target?.table.trim())
      throw connectorUiMessages.error('enterTheInsertTargetTableName');
    if (/\0/.test(options.target.table) || /\0/.test(options.target.schema ?? ''))
      throw connectorUiMessages.error('tableAndSchemaNamesCannotContainNullCharacters');
  }
  if (options.format === 'sql' || (options.format === 'json' && options.jsonShape === 'records')) {
    const labels = columns.map((index) => result.columns[index]);
    if (new Set(labels).size !== labels.length)
      throw new Error(
        options.format === 'sql'
          ? tConnector('insertDoesNotSupportDuplicateColumnNamesAdjustSelectedColumns')
          : tConnector('objectJsonDoesNotSupportDuplicateColumnNamesUseMatrix'),
      );
  }
  return {
    provider,
    result,
    options,
    columns,
    rows,
    rowCount: rows?.length ?? result.rows.length,
    newline: options.newline === 'crlf' ? '\r\n' : '\n',
    nullText,
  };
}
export function exportRow(plan: ExportPlan, index: number) {
  return plan.result.rows[plan.rows?.[index] ?? index];
}
export function resultExportFilename(title: string, extension: string, locale?: Locale): string {
  const tConnector = createTranslator(connectorMessages, locale);
  const basename = title
    .replace(/\.[a-z0-9]{1,8}$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[.\s]+$/, '')
    .trim()
    .slice(0, 160);
  return `${basename || tConnector('queryResults')}.${extension}`;
}
