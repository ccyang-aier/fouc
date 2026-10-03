import { open, type FileHandle } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import { DATABASE_EXPORT_MAX_BYTES } from '@fouc/shared/database-export';

const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});

function crc32(crc: number, bytes: Uint8Array): number {
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return crc >>> 0;
}

interface ZipEntry {
  name: Uint8Array;
  offset: number;
  bytes: number;
  crc: number;
}

/** Standard ZIP32 STORE with data descriptors: data is never buffered as an archive. */
export class DatabaseExportWriter {
  bytes = 0;
  entryBytes = 0;
  private active: ZipEntry | null = null;
  private entries: ZipEntry[] = [];
  private yieldedAt = performance.now();
  private closed = false;

  private constructor(
    private readonly file: FileHandle,
    readonly zip: boolean,
    private readonly signal: AbortSignal,
    private readonly onBytes: (bytes: number) => void,
  ) { }

  static async create(path: string, zip: boolean, signal: AbortSignal, onBytes: (bytes: number) => void) {
    return new DatabaseExportWriter(await open(path, 'wx', 0o600), zip, signal, onBytes);
  }

  private async raw(bytes: Uint8Array): Promise<void> {
    this.signal.throwIfAborted();
    if (this.bytes + bytes.byteLength > DATABASE_EXPORT_MAX_BYTES) throw new Error('导出超过当前 1 GiB 文件上限，请缩小范围或设置每表行数上限。');
    let offset = 0;
    while (offset < bytes.byteLength) {
      const result = await this.file.write(bytes, offset, bytes.byteLength - offset, null);
      if (!result.bytesWritten) throw new Error('导出文件写入未取得进展。');
      offset += result.bytesWritten;
      this.bytes += result.bytesWritten;
    }
    this.onBytes(this.bytes);
    if (performance.now() - this.yieldedAt > 8) {
      await setImmediate();
      this.yieldedAt = performance.now();
      this.signal.throwIfAborted();
    }
  }

  async begin(name: string): Promise<void> {
    if (this.active) await this.end();
    this.entryBytes = 0;
    if (!this.zip) return;
    if (this.entries.length >= 65_534) throw new Error('ZIP 分包条目达到上限，请增大分包大小或缩小范围。');
    const encoded = encoder.encode(name);
    if (!encoded.length || encoded.length > 65_535 || /[\\\0]/.test(name) || name.startsWith('/') || name.split('/').some(part => part === '..')) throw new Error('导出 ZIP 条目名无效。');
    const entry: ZipEntry = { name: encoded, offset: this.bytes, bytes: 0, crc: 0xffffffff };
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0808, 6); // UTF-8 + trailing data descriptor
    header.writeUInt16LE(0x0021, 12); // 1980-01-01; actual timestamp lives in manifest
    header.writeUInt16LE(encoded.length, 26);
    await this.raw(header);
    await this.raw(encoded);
    this.active = entry;
  }

  async write(pieces: Iterable<string>): Promise<void> {
    if (this.zip && !this.active) throw new Error('ZIP 条目未打开。');
    for (const piece of pieces) {
      this.signal.throwIfAborted();
      const bytes = encoder.encode(piece);
      if (this.active) {
        this.active.crc = crc32(this.active.crc, bytes);
        this.active.bytes += bytes.byteLength;
      }
      this.entryBytes += bytes.byteLength;
      await this.raw(bytes);
    }
  }

  async end(): Promise<void> {
    if (!this.active) return;
    const entry = this.active;
    entry.crc = (entry.crc ^ 0xffffffff) >>> 0;
    const descriptor = Buffer.alloc(16);
    descriptor.writeUInt32LE(0x08074b50, 0);
    descriptor.writeUInt32LE(entry.crc, 4);
    descriptor.writeUInt32LE(entry.bytes, 8);
    descriptor.writeUInt32LE(entry.bytes, 12);
    await this.raw(descriptor);
    this.entries.push(entry);
    this.active = null;
  }

  async finish(): Promise<number> {
    await this.end();
    if (this.zip) {
      const offset = this.bytes;
      for (const entry of this.entries) {
        const header = Buffer.alloc(46);
        header.writeUInt32LE(0x02014b50, 0);
        header.writeUInt16LE(20, 4);
        header.writeUInt16LE(20, 6);
        header.writeUInt16LE(0x0808, 8);
        header.writeUInt16LE(0x0021, 14);
        header.writeUInt32LE(entry.crc, 16);
        header.writeUInt32LE(entry.bytes, 20);
        header.writeUInt32LE(entry.bytes, 24);
        header.writeUInt16LE(entry.name.length, 28);
        header.writeUInt32LE(entry.offset, 42);
        await this.raw(header);
        await this.raw(entry.name);
      }
      const footer = Buffer.alloc(22);
      footer.writeUInt32LE(0x06054b50, 0);
      footer.writeUInt16LE(this.entries.length, 8);
      footer.writeUInt16LE(this.entries.length, 10);
      footer.writeUInt32LE(this.bytes - offset, 12);
      footer.writeUInt32LE(offset, 16);
      await this.raw(footer);
    }
    await this.file.sync();
    await this.close();
    return this.bytes;
  }

  async close(): Promise<void> {
    if (!this.closed) {
      this.closed = true;
      await this.file.close();
    }
  }
}
