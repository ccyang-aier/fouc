import type { ResultExportControl } from './model';
import { textPieces } from '@fouc/shared/database-export';
export { textPieces } from '@fouc/shared/database-export';

const CHUNK_CHARS = 65_536;
const encoder = new TextEncoder();

export class PreviewComplete extends Error {}

/** DBX's direct writer adapted to browser chunks with cooperative scheduling. */
export class ExportWriter {
  readonly chunks: string[] = [];
  byteLength = 0;
  completedRows = 0;
  private pending: string[] = [];
  private pendingChars = 0;
  private deadline = performance.now() + 8;

  constructor(
    private readonly totalRows: number,
    private readonly control: ResultExportControl,
    private readonly maxBytes = Infinity,
  ) {}

  private flush() {
    if (!this.pending.length) return;
    const chunk = this.pending.join('');
    this.chunks.push(chunk);
    this.byteLength += encoder.encode(chunk).length;
    this.pending = [];
    this.pendingChars = 0;
  }

  private async checkpoint(force = false) {
    this.control.signal?.throwIfAborted();
    if (!force && performance.now() < this.deadline) return;
    this.flush();
    this.control.onProgress?.({
      completedRows: this.completedRows,
      totalRows: this.totalRows,
      byteLength: this.byteLength,
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    this.control.signal?.throwIfAborted();
    this.deadline = performance.now() + 8;
  }

  async write(parts: Iterable<string>) {
    for (const part of parts) {
      if (!part.length) {
        await this.checkpoint();
        continue;
      }
      for (const piece of textPieces(part)) {
        this.control.signal?.throwIfAborted();
        if (this.byteLength + this.pendingChars * 3 + piece.length * 3 > this.maxBytes) {
          this.flush();
          const available = this.maxBytes - this.byteLength;
          const bytes = encoder.encode(piece);
          if (bytes.length > available) {
            // Preview alone is bounded. Full export never truncates a cell.
            const prefix = new TextDecoder('utf-8', { fatal: true });
            let end = Math.max(0, available);
            while (end > 0) {
              try {
                this.chunks.push(prefix.decode(bytes.subarray(0, end)));
                this.byteLength += end;
                break;
              } catch {
                end--;
              }
            }
            throw new PreviewComplete();
          }
        }
        this.pending.push(piece);
        this.pendingChars += piece.length;
        if (this.pendingChars >= CHUNK_CHARS) this.flush();
        await this.checkpoint();
      }
    }
  }

  async finish() {
    this.flush();
    await this.checkpoint(true);
    return this.chunks;
  }
}
