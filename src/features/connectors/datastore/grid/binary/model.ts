import type { DatabaseCell } from '@fouc/shared';

export const BINARY_PREVIEW_BYTES = 256 * 1024;
export const BINARY_DOWNLOAD_BYTES = 16 * 1024 * 1024;
export const HEX_BYTES_PER_ROW = 16;
export const HEX_PAGE_ROWS = 64;

export interface BinaryValue {
  base64: string;
  bytes: number;
}
export interface BinaryHexRow {
  offset: string;
  hex: string;
  ascii: string;
}

/** Inspect the native binary envelope without converting its original payload. */
export function nativeBinaryValue(value: DatabaseCell): BinaryValue | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.type !== 'binary') return null;
  if (typeof value.base64 !== 'string') throw new Error('原生二进制缺少 Base64 内容');
  const text = value.base64;
  if (text.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text))
    throw new Error('原生二进制的 Base64 格式无效');
  const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  const bytes = text.length / 4 * 3 - padding;
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('原生二进制长度无效');
  // Non-zero unused bits are ambiguous encodings; the native protocol is canonical.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  if (padding && alphabet.indexOf(text[text.length - padding - 1]) & (padding === 2 ? 15 : 3))
    throw new Error('原生 Base64 的填充位无效');
  return { base64: text, bytes };
}

export function decodeBinaryPrefix(value: BinaryValue, maximum = BINARY_PREVIEW_BYTES): Uint8Array {
  if (!Number.isSafeInteger(maximum) || maximum < 0 || maximum > BINARY_DOWNLOAD_BYTES)
    throw new Error('二进制预览范围无效');
  const size = Math.min(maximum, value.bytes);
  const encodedLength = Math.ceil(size / 3) * 4;
  const decoded = atob(value.base64.slice(0, encodedLength));
  const bytes = new Uint8Array(size);
  for (let index = 0; index < size; index++) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

export function decodeCompleteBinary(value: BinaryValue): Uint8Array {
  if (value.bytes > BINARY_DOWNLOAD_BYTES) throw new Error('单元格原始文件下载最多 16 MiB，请使用全表导出');
  return decodeBinaryPrefix(value, value.bytes);
}

export function binaryHexRows(bytes: Uint8Array, startRow: number, rows = HEX_PAGE_ROWS): BinaryHexRow[] {
  if (!Number.isSafeInteger(startRow) || startRow < 0 || !Number.isSafeInteger(rows) || rows < 1 || rows > 256)
    throw new Error('十六进制查看范围无效');
  const result: BinaryHexRow[] = [];
  const start = Math.min(bytes.length, startRow * HEX_BYTES_PER_ROW);
  const end = Math.min(bytes.length, start + rows * HEX_BYTES_PER_ROW);
  for (let offset = start; offset < end; offset += HEX_BYTES_PER_ROW) {
    const slice = bytes.subarray(offset, Math.min(end, offset + HEX_BYTES_PER_ROW));
    const hex: string[] = [];
    let ascii = '';
    for (const byte of slice) {
      hex.push(byte.toString(16).toUpperCase().padStart(2, '0'));
      ascii += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
    }
    result.push({ offset: offset.toString(16).toUpperCase().padStart(8, '0'), hex: hex.join(' '), ascii });
  }
  return result;
}

export function parseBinaryHexSearch(text: string): Uint8Array {
  const clean = text.replace(/\s/g, '');
  if (!clean || clean.length > 256 || clean.length % 2 || !/^[\da-f]+$/i.test(clean))
    throw new Error('输入 1–128 个字节的十六进制，可使用空格分隔');
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < bytes.length; index++) bytes[index] = parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

export function findBinaryBytes(bytes: Uint8Array, needle: Uint8Array, start: number): number | null {
  if (!needle.length || needle.length > 128 || bytes.length > BINARY_PREVIEW_BYTES || !Number.isSafeInteger(start) || start < 0)
    throw new Error('二进制搜索范围无效');
  const maximum = bytes.length - needle.length;
  function find(from: number, to: number): number | null {
    for (let offset = from; offset <= to; offset++) {
      let matching = true;
      for (let index = 0; index < needle.length; index++) {
        if (bytes[offset + index] !== needle[index]) { matching = false; break; }
      }
      if (matching) return offset;
    }
    return null;
  }
  const next = Math.min(start, Math.max(0, maximum + 1));
  return find(next, maximum) ?? find(0, Math.min(maximum, next - 1));
}

export function binaryUtf8Preview(bytes: Uint8Array, truncated: boolean): string | null {
  try {
    // A bounded prefix may end within a Unicode character; leave that suffix unread.
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: truncated });
  } catch { return null; }
}

export function binaryDownloadName(column: string, extension = 'bin'): string {
  const name = column.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').replace(/[. ]+$/g, '').slice(0, 100);
  return `${name && !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(name) ? name : 'cell'}.${extension}`;
}

export function binaryByteLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes.toLocaleString()} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
