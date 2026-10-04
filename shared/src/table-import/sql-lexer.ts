import type { TableImportParseOptions } from './types';

export type ImportSqlDialect = NonNullable<TableImportParseOptions['sqlDialect']>;
export interface ImportSqlToken {
  kind: 'word' | 'identifier' | 'string' | 'number' | 'symbol' | 'end';
  text: string;
  offset: number;
}

export class ImportSqlFailure extends Error {
  constructor(message: string, readonly offset: number, readonly record?: number) {
    super(message);
  }
}

/** A streaming scanner extracts literal data; it never interprets executable SQL. */
export class ImportSqlLexer {
  private position = 0;
  private current: ImportSqlToken | null = null;
  private tokens = 0;

  constructor(readonly source: string, readonly dialect: ImportSqlDialect, private readonly signal?: AbortSignal) {
    if (source.startsWith('\uFEFF')) this.position = 1;
  }

  peek(): ImportSqlToken {
    return this.current ??= this.scan();
  }

  take(): ImportSqlToken {
    const token = this.peek();
    this.current = null;
    return token;
  }

  accept(text: string): boolean {
    const token = this.peek();
    if ((token.kind !== 'word' && token.kind !== 'symbol') || token.text.toUpperCase() !== text) return false;
    this.take();
    return true;
  }

  expect(text: string): void {
    if (!this.accept(text)) this.fail(`此处需要 ${text}；仅支持显式字段列表的 INSERT INTO … VALUES。`);
  }

  fail(message: string, offset = this.peek().offset): never {
    throw new ImportSqlFailure(message, offset);
  }

  private trivia(): void {
    while (this.position < this.source.length) {
      const char = this.source[this.position];
      if (/\s/u.test(char)) {
        this.position++;
        continue;
      }
      const mysqlLineComment = this.dialect !== 'mysql' || /[\s\x00-\x1f]/.test(this.source[this.position + 2] ?? ' ');
      if ((this.source.startsWith('--', this.position) && mysqlLineComment) || (char === '#' && this.dialect === 'mysql')) {
        const end = this.source.indexOf('\n', this.position);
        this.position = end < 0 ? this.source.length : end + 1;
        continue;
      }
      if (!this.source.startsWith('/*', this.position)) return;
      const start = this.position;
      if (this.dialect === 'mysql' && /[!+]/.test(this.source[this.position + 2] ?? '')) {
        throw new ImportSqlFailure('SQL 导入不执行 MySQL 版本条件注释或优化器提示，请移除后导入纯 INSERT 数据。', start);
      }
      this.position += 2;
      let depth = 1;
      while (this.position < this.source.length && depth) {
        this.signal?.throwIfAborted();
        if (this.source.startsWith('*/', this.position)) {
          depth--;
          this.position += 2;
        } else if (this.dialect === 'postgres' && this.source.startsWith('/*', this.position)) {
          if (++depth > 64) throw new ImportSqlFailure('SQL 注释嵌套最多 64 层。', this.position);
          this.position += 2;
        } else this.position++;
      }
      if (depth) throw new ImportSqlFailure('SQL 块注释未闭合。', start);
    }
  }

  private quoted(quote: string, start: number, identifier: boolean, escapes: boolean): ImportSqlToken {
    const close = quote === '[' ? ']' : quote;
    this.position++;
    let text = '';
    while (this.position < this.source.length) {
      const char = this.source[this.position++];
      if (char === close) {
        if (close !== ']' && this.source[this.position] === close) {
          text += close;
          this.position++;
        } else return { kind: identifier ? 'identifier' : 'string', text, offset: start };
      } else if (char === '\\' && escapes) text += this.escape(start);
      else text += char;
    }
    throw new ImportSqlFailure('SQL 引号未闭合。', start);
  }

  private escape(start: number): string {
    const char = this.source[this.position++];
    if (char === undefined) throw new ImportSqlFailure('SQL 字符串转义未完成。', start);
    const simple: Record<string, string> = { '0': '\0', b: '\b', n: '\n', r: '\r', t: '\t', Z: '\x1a', '\\': '\\', "'": "'", '"': '"' };
    if (this.dialect === 'mysql') return char === '%' || char === '_' ? '\\' + char : simple[char] ?? char;
    if (char in simple) return simple[char];
    if (/[0-7]/.test(char)) {
      let digits = char;
      while (digits.length < 3 && /[0-7]/.test(this.source[this.position] ?? '')) digits += this.source[this.position++];
      const code = parseInt(digits, 8);
      if (code > 127) throw new ImportSqlFailure('PostgreSQL 非 ASCII 字节转义须先转换为 UTF-8 字符或 Unicode 转义，不进行有损推断。', this.position);
      return String.fromCharCode(code);
    }
    if (char === 'x' || char === 'u' || char === 'U') {
      const limit = char === 'x' ? 2 : char === 'u' ? 4 : 8;
      let digits = '';
      while (digits.length < limit && /[\da-f]/i.test(this.source[this.position] ?? '')) digits += this.source[this.position++];
      if (!digits || (char !== 'x' && digits.length !== limit)) throw new ImportSqlFailure('SQL 字符串十六进制转义无效。', this.position);
      const code = parseInt(digits, 16);
      if (char === 'x' && code > 127) throw new ImportSqlFailure('PostgreSQL 非 ASCII 字节转义须先转换为 UTF-8 字符或 Unicode 转义，不进行有损推断。', this.position);
      if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) throw new ImportSqlFailure('SQL 字符串 Unicode 转义不是有效码点。', this.position);
      return String.fromCodePoint(code);
    }
    return char;
  }

  private scan(): ImportSqlToken {
    this.signal?.throwIfAborted();
    if (++this.tokens > 250_000) throw new ImportSqlFailure('SQL 导入最多 250000 个词法元素，请拆分文件。', this.position);
    this.trivia();
    const start = this.position;
    const char = this.source[start];
    if (char === undefined) return { kind: 'end', text: '', offset: start };
    if (char === "'") return this.quoted(char, start, false, this.dialect === 'mysql');
    if (char === '"') return this.quoted(char, start, this.dialect !== 'mysql', this.dialect === 'mysql');
    if (char === '`' && this.dialect !== 'postgres') return this.quoted(char, start, true, false);
    if (char === '[' && this.dialect === 'sqlite') return this.quoted(char, start, true, false);
    if (this.dialect === 'postgres' && (char === 'E' || char === 'e') && this.source[start + 1] === "'") {
      this.position++;
      return this.quoted("'", start, false, true);
    }
    if (this.dialect === 'postgres' && char === '$') {
      const marker = /^\$(?:[A-Za-z_][A-Za-z_\d]*)?\$/.exec(this.source.slice(start))?.[0];
      if (marker) {
        const end = this.source.indexOf(marker, start + marker.length);
        if (end < 0) throw new ImportSqlFailure('SQL dollar 字符串未闭合。', start);
        this.position = end + marker.length;
        return { kind: 'string', text: this.source.slice(start + marker.length, end), offset: start };
      }
    }
    if (/\d/.test(char) || (char === '.' && /\d/.test(this.source[start + 1] ?? ''))) {
      const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(this.source.slice(start))![0];
      this.position += number.length;
      return { kind: 'number', text: number, offset: start };
    }
    if (/[$_\p{L}]/u.test(char)) {
      const word = /^[$_\p{L}][$_\p{L}\p{N}]*/u.exec(this.source.slice(start))![0];
      this.position += word.length;
      return { kind: 'word', text: word, offset: start };
    }
    this.position++;
    return { kind: 'symbol', text: char, offset: start };
  }
}
