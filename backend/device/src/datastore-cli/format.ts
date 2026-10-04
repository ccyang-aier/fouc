import { DatastoreCliError, type CliFormat, type CliGrid, type CliResult } from './types';

function raw(value: unknown): string {
  if (value === null) return 'NULL';
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  return JSON.stringify(value);
}

function terminal(value: unknown): string {
  return raw(value).replace(/[\x00-\x1f\x7f]/g, char => char === '\n' ? '\\n' : char === '\r' ? '\\r' : char === '\t' ? '\\t' : '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
}

function characterWidth(char: string): number {
  const code = char.codePointAt(0)!;
  if (/\p{Mark}/u.test(char) || code === 0x200d || (code >= 0xfe00 && code <= 0xfe0f)) return 0;
  return code >= 0x1100 && (code <= 0x115f || code >= 0x2e80 && code <= 0xa4cf || code >= 0xac00 && code <= 0xd7a3 || code >= 0xf900 && code <= 0xfaff || code >= 0xfe10 && code <= 0xfe6f || code >= 0xff01 && code <= 0xff60 || code >= 0x1f300 && code <= 0x1faff || code >= 0x20000) ? 2 : 1;
}

function width(text: string): number {
  return Array.from(text).reduce((sum, char) => sum + characterWidth(char), 0);
}

function padded(text: string, maximum: number): string {
  let result = '';
  let current = 0;
  const clipped = width(text) > maximum;
  for (const char of text) {
    const next = characterWidth(char);
    if (current + next > maximum - (clipped ? 1 : 0)) break;
    result += char;
    current += next;
  }
  if (clipped) { result += '…'; current++; }
  return result + ' '.repeat(Math.max(0, maximum - current));
}

export function formatCliTable(grid: CliGrid): string {
  if (!grid.columns.length) return '(no columns)\n';
  const columns = grid.columns.map(terminal);
  const rows = grid.rows.map(row => columns.map((_, index) => terminal(row[index])));
  const widths = columns.map((column, index) => Math.min(48, Math.max(3, width(column), ...rows.map(row => width(row[index])))));
  const line = (row: string[]) => row.map((cell, index) => padded(cell, widths[index])).join(' | ');
  return (grid.label ? terminal(grid.label) + '\n' : '') + line(columns) + '\n' + widths.map(value => '-'.repeat(value)).join('-+-') + '\n' + rows.map(line).join('\n') + (rows.length ? '\n' : '') + `${rows.length} row(s)\n`;
}

function csv(value: unknown): string {
  // Raw values stay exact; NULL uses an empty unquoted field, empty strings a quoted field.
  if (value === null || value === undefined) return '';
  const text = raw(value);
  return text === '' || /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

export function formatCliCsv(grid: CliGrid): string {
  return [grid.columns.map(csv).join(','), ...grid.rows.map(row => grid.columns.map((_, index) => csv(row[index])).join(','))].join('\r\n') + '\r\n';
}

export function objectCliGrid(value: unknown): CliGrid {
  const objects = Array.isArray(value) ? value : [value];
  if (objects.every(item => item !== null && typeof item === 'object' && !Array.isArray(item))) {
    const names = [...new Set(objects.flatMap(item => Object.keys(item)))];
    return { columns: names, rows: objects.map(item => names.map(name => (item as Record<string, unknown>)[name])) };
  }
  return { columns: ['value'], rows: objects.map(item => [item]) };
}

export function formatCliResult(result: CliResult, format: CliFormat): string {
  if (format === 'json') return JSON.stringify({ ok: true, command: result.command, data: result.data, ...(result.warnings?.length ? { warnings: result.warnings } : {}) }, null, 2) + '\n';
  if (result.text !== undefined) {
    if (format === 'csv') throw new DatastoreCliError('Text document commands support table/raw text or JSON; CSV is unavailable', 2, 'invalid_format');
    return result.text.endsWith('\n') ? result.text : result.text + '\n';
  }
  const grids = result.grids ?? [objectCliGrid(result.data)];
  if (format === 'csv') {
    if (grids.length !== 1) throw new DatastoreCliError('CSV requires exactly one result set; select one SQL statement or JSON output', 2, 'ambiguous_csv');
    return formatCliCsv(grids[0]);
  }
  return grids.map(formatCliTable).join('\n');
}
