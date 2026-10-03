import { inferTableImportColumns } from './inference';
import { TABLE_IMPORT_LIMITS, type TableImportCell, type TableImportIssue, type TableImportParsed, type TableImportParseOptions } from './types';

class ParseFailure extends Error { constructor(message: string, readonly offset: number, readonly record?: number) { super(message); } }
type JsonNode = { kind: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'; start: number; end: number; value?: string; members?: Array<[string, JsonNode]>; items?: JsonNode[] };

/** Token-based JSON parsing never materializes a numeric token as a JavaScript Number. */
class ImportJsonScanner {
  position = 0;
  private tokens = 0;
  constructor(readonly text: string) {}
  whitespace() { while (/[ \t\r\n]/.test(this.text[this.position] ?? '') && this.position < this.text.length) this.position++; }
  fail(message: string): never { throw new ParseFailure(message, this.position); }
  string(): string {
    const start = this.position++;
    while (this.position < this.text.length) {
      const char = this.text[this.position++];
      if (char === '"') {
        try { return JSON.parse(this.text.slice(start, this.position)) as string; }
        catch { throw new ParseFailure('JSON 字符串转义无效。', start); }
      }
      if (char === '\\') this.position++;
      else if (char.charCodeAt(0) < 32) this.fail('JSON 字符串含未转义的控制字符。');
    }
    throw new ParseFailure('JSON 字符串未闭合。', start);
  }
  value(depth = 0): JsonNode {
    this.whitespace();
    const start = this.position, char = this.text[start];
    if (++this.tokens > 250_000) this.fail('JSON 结构超过当前导入的 250000 个值限制。');
    if (depth > 64) this.fail('JSON 嵌套最多 64 层。');
    if (char === '"') return { kind: 'string', start, value: this.string(), end: this.position };
    if (char === '{' || char === '[') {
      const object = char === '{', end = object ? '}' : ']', members: Array<[string, JsonNode]> = [], items: JsonNode[] = [], seen = new Set<string>();
      this.position++; this.whitespace();
      if (this.text[this.position] !== end) {
        while (true) {
          let key = '';
          if (object) {
            if (this.text[this.position] !== '"') this.fail('JSON 对象字段名须使用双引号。');
            key = this.string(); this.whitespace();
            if (depth <= 1 && (key.length > 1024 || key.includes('\0'))) this.fail('源字段名最多 1024 个字符，不能含 NUL。');
            if (this.text[this.position++] !== ':') this.fail('JSON 字段名后缺少冒号。');
            if (seen.has(key)) this.fail(`JSON 对象字段重复：${key}`);
            seen.add(key);
            if (depth <= 1 && seen.size > TABLE_IMPORT_LIMITS.columns) this.fail('导入最多 256 列。');
          }
          const node = this.value(depth + 1);
          // Only the root and row level need a tree; nested JSON remains its exact source span.
          if (depth <= 1) object ? members.push([key, node]) : items.push(node);
          this.whitespace();
          if (this.text[this.position] === end) break;
          if (this.text[this.position++] !== ',') this.fail('JSON 元素之间缺少逗号。');
          this.whitespace();
          if (this.text[this.position] === end) this.fail('JSON 不允许尾随逗号。');
        }
      }
      this.position++;
      return { kind: object ? 'object' : 'array', start, end: this.position, ...(depth <= 1 ? object ? { members } : { items } : {}) };
    }
    const tail = this.text.slice(start), literal = /^(true|false|null)(?![\w])/u.exec(tail), number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(tail);
    if (literal) { this.position += literal[0].length; return { kind: literal[0] === 'null' ? 'null' : 'boolean', start, end: this.position, value: literal[0] }; }
    if (number) { this.position += number[0].length; return { kind: 'number', start, end: this.position, value: number[0] }; }
    this.fail('JSON 值无效。');
  }
  complete() { this.whitespace(); if (this.position !== this.text.length) this.fail('JSON 值后存在额外内容。'); }
}

function sourceIssue(text: string, error: ParseFailure): TableImportIssue {
  const prefix = text.slice(0, error.offset), lastLine = Math.max(prefix.lastIndexOf('\n'), prefix.lastIndexOf('\r'));
  return { message: error.message, offset: error.offset, line: (prefix.match(/\r\n|\r|\n/g)?.length ?? 0) + 1, column: error.offset - lastLine, ...(error.record ? { record: error.record } : {}) };
}
function uniqueHeaders(headers: string[]): string[] {
  const seen = new Set<string>();
  return headers.map((value, index) => {
    const base = value.trim().replace(/^\uFEFF/, '') || `column_${index + 1}`;
    if (base.length > 1024 || base.includes('\0')) throw new ParseFailure('源字段名最多 1024 个字符，不能含 NUL。', 0);
    let name = base, suffix = 1;
    while (seen.has(name)) name = `${base}_${suffix++}`;
    seen.add(name); return name;
  });
}
function scalar(node: JsonNode, text: string): TableImportCell {
  if (node.kind === 'null') return { kind: 'null' };
  if (node.kind === 'object' || node.kind === 'array') return { kind: 'json', value: text.slice(node.start, node.end) };
  return { kind: node.kind === 'string' ? 'text' : node.kind, value: node.value! };
}
function validateOptions(options: TableImportParseOptions): { title: number; start: number; last: number; delimiter: string } {
  if (!options || !['csv', 'tsv', 'delimited', 'json', 'ndjson'].includes(options.format)) throw new ParseFailure('导入格式无效。', 0);
  const delimited = ['csv', 'tsv', 'delimited'].includes(options.format);
  const title = options.titleRow ?? (delimited ? 1 : 0), start = options.dataStartRow ?? (title + 1), last = options.lastDataRow ?? 0;
  if (![title, start, last].every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000) || !start || (title && title >= start) || (last && last < start)) throw new ParseFailure('标题行须在数据起始行之前，结束行须为 0 或不小于起始行。', 0);
  if (!delimited && title) throw new ParseFailure('JSON 数据使用自身字段名，标题行须为 0。', 0);
  for (const flag of ['trimValues', 'emptyStringAsNull'] as const) if (options[flag] !== undefined && typeof options[flag] !== 'boolean') throw new ParseFailure('解析选项无效。', 0);
  if (options.jsonShape !== undefined && !['auto', 'objects', 'arrays'].includes(options.jsonShape)) throw new ParseFailure('JSON 行结构无效。', 0);
  if (options.nullToken !== undefined && (typeof options.nullToken !== 'string' || options.nullToken.length > 64)) throw new ParseFailure('NULL 标记最多 64 个字符。', 0);
  let delimiter = options.format === 'tsv' ? '\t' : options.format === 'csv' ? ',' : options.delimiter ?? ',';
  if (delimiter === '\\t' || /^tab$/i.test(delimiter)) delimiter = '\t';
  if (typeof delimiter !== 'string' || Array.from(delimiter).length !== 1 || /["\r\n\0]/.test(delimiter)) throw new ParseFailure('分隔符须为单个字符，不能为引号或换行。', 0);
  return { title, start, last, delimiter };
}

/** Adapted DBX row ranges, header disambiguation and null options, with an explicit bounded milestone. */
export function parseTableImport(text: string, options: TableImportParseOptions, signal?: AbortSignal): TableImportParsed {
  const parsed: TableImportParsed = { columns: [], rows: [], rowNumbers: [], inferredTypes: [], totalRows: 0, sizeBytes: 0, errors: [], warnings: [] };
  try {
    signal?.throwIfAborted();
    if (typeof text !== 'string' || text.length > TABLE_IMPORT_LIMITS.bytes) throw new ParseFailure('导入内容最多 5 MiB。', 0);
    parsed.sizeBytes = new TextEncoder().encode(text).byteLength;
    if (parsed.sizeBytes > TABLE_IMPORT_LIMITS.bytes) throw new ParseFailure('导入内容最多 5 MiB UTF-8 文本。', 0);
    const range = validateOptions(options);
    let cellCount = 0;
    const add = (cells: TableImportCell[], record: number, offset: number) => {
      if (record < range.start || (range.last && record > range.last)) return;
      signal?.throwIfAborted();
      if (parsed.rows.length >= TABLE_IMPORT_LIMITS.rows) throw new ParseFailure('导入最多 5000 行；请缩小数据范围或拆分文件。', offset, record);
      if (cells.length > TABLE_IMPORT_LIMITS.columns || (cellCount += cells.length) > TABLE_IMPORT_LIMITS.cells) throw new ParseFailure('导入最多 256 列、100000 个单元格。', offset, record);
      parsed.rows.push(cells); parsed.rowNumbers.push(record); parsed.totalRows++;
    };
    if (options.format === 'json' || options.format === 'ndjson') {
      const records: Array<{ node: JsonNode; text: string; offset: number }> = [];
      if (options.format === 'json') {
        const scanner = new ImportJsonScanner(text);
        if (text.startsWith('\uFEFF')) scanner.position = 1;
        const root = scanner.value(); scanner.complete();
        if (root.kind !== 'array') throw new ParseFailure('JSON 导入须为对象行或数组行组成的数组。', root.start);
        for (const node of root.items ?? []) records.push({ node, text: scanner.text, offset: node.start });
      } else {
        let offset = 0;
        for (const line of text.split(/\r\n|\r|\n/)) {
          if (line.trim().replace(/^\uFEFF/, '')) {
            const scanner = new ImportJsonScanner(line);
            if (line.startsWith('\uFEFF')) scanner.position = 1;
            try { const node = scanner.value(1); scanner.complete(); records.push({ node, text: scanner.text, offset: offset + node.start }); }
            catch (error) { if (error instanceof ParseFailure) throw new ParseFailure(error.message, offset + error.offset, records.length + 1); throw error; }
          }
          offset += line.length + (text.startsWith('\r\n', offset + line.length) ? 2 : 1);
        }
      }
      const first = records[0]?.node;
      if (!first || (first.kind !== 'object' && first.kind !== 'array')) throw new ParseFailure('JSON 每行须为对象或数组。', records[0]?.offset ?? 0);
      const shape = first.kind;
      if ((options.jsonShape === 'objects' && shape !== 'object') || (options.jsonShape === 'arrays' && shape !== 'array')) throw new ParseFailure('JSON 行与选定结构不一致。', 0);
      const selected = records.filter((_, index) => index + 1 >= range.start && (!range.last || index + 1 <= range.last));
      if (selected.length > TABLE_IMPORT_LIMITS.rows) throw new ParseFailure('导入最多 5000 行；请缩小数据范围或拆分文件。', selected[TABLE_IMPORT_LIMITS.rows].offset, TABLE_IMPORT_LIMITS.rows + range.start);
      for (const record of records) if (record.node.kind !== shape) throw new ParseFailure('JSON 对象行与数组行不能混用。', record.offset);
      if (shape === 'object') {
        const names = new Set<string>();
        for (const record of selected) for (const [key] of record.node.members ?? []) names.add(key);
        parsed.columns = [...names];
      } else parsed.columns = Array.from({ length: selected.reduce((max, record) => Math.max(max, record.node.items?.length ?? 0), 0) }, (_, index) => `column_${index + 1}`);
      if (parsed.columns.length > TABLE_IMPORT_LIMITS.columns) throw new ParseFailure('导入最多 256 列。', 0);
      records.forEach((record, index) => {
        const lookup = new Map(record.node.members ?? []);
        const cells = parsed.columns.map((name, column) => { const node = shape === 'object' ? lookup.get(name) : record.node.items?.[column]; return node ? scalar(node, record.text) : { kind: 'missing' } as TableImportCell; });
        add(cells, index + 1, record.offset);
      });
    } else {
      let position = text.startsWith('\uFEFF') ? 1 : 0, record = 0;
      while (position < text.length) {
        const recordStart = position, values: Array<{ text: string; quoted: boolean }> = [];
        let complete = false;
        while (!complete) {
          let value = '', quoted = false;
          if (text[position] === '"') {
            quoted = true; position++; let closed = false;
            while (position < text.length) {
              if (text[position] === '"') {
                if (text[position + 1] === '"') { value += '"'; position += 2; }
                else { position++; closed = true; break; }
              } else value += text[position++];
            }
            if (!closed) throw new ParseFailure('带引号字段未闭合。', recordStart, record + 1);
            if (position < text.length && !text.startsWith(range.delimiter, position) && !/[\r\n]/.test(text[position])) throw new ParseFailure('字段结束引号后只能是分隔符或换行。', position, record + 1);
          } else {
            while (position < text.length && !text.startsWith(range.delimiter, position) && !/[\r\n]/.test(text[position])) {
              if (text[position] === '"') throw new ParseFailure('未加引号的字段中出现双引号。', position, record + 1);
              value += text[position++];
            }
          }
          values.push({ text: value, quoted });
          if (values.length > TABLE_IMPORT_LIMITS.columns) throw new ParseFailure('导入最多 256 列。', position, record + 1);
          if (text.startsWith(range.delimiter, position)) position += range.delimiter.length;
          else { if (text[position] === '\r') position++; if (text[position] === '\n') position++; complete = true; }
        }
        if (values.length === 1 && !values[0].quoted && !values[0].text) continue;
        record++;
        if (record === range.title) { parsed.columns = uniqueHeaders(values.map((cell) => cell.text)); continue; }
        if (record < range.start) continue;
        if (range.last && record > range.last) break;
        if (!parsed.columns.length) parsed.columns = values.map((_, index) => `column_${index + 1}`);
        if (values.length > parsed.columns.length) throw new ParseFailure(`此记录有 ${values.length} 列，标题定义了 ${parsed.columns.length} 列。`, recordStart, record);
        const cells = parsed.columns.map((_, index): TableImportCell => {
          const cell = values[index]; if (!cell) return { kind: 'missing' };
          const value = options.trimValues ? cell.text.trim() : cell.text;
          if ((!cell.quoted && options.nullToken !== undefined && value === options.nullToken) || (options.emptyStringAsNull && value === '')) return { kind: 'null' };
          return { kind: 'text', value };
        });
        add(cells, record, recordStart);
      }
    }
    if (!parsed.columns.length) throw new ParseFailure('选定范围中没有字段。', 0);
    if (!parsed.rows.length) throw new ParseFailure('选定范围中没有数据行。', 0);
    if (parsed.rows.some((row) => row.some((cell) => cell.kind === 'missing'))) parsed.warnings.push('部分字段缺失；导入时会省略该字段并使用目标默认值。显式 NULL 会写入 NULL。');
  } catch (error) {
    if (signal?.aborted) throw error;
    parsed.errors.push(sourceIssue(typeof text === 'string' ? text : '', error instanceof ParseFailure ? error : new ParseFailure(error instanceof Error ? error.message : String(error), 0)));
  }
  parsed.inferredTypes = inferTableImportColumns(parsed.rows, parsed.columns.length);
  return parsed;
}
