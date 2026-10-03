/** GridFS metadata uses canonical EJSON identities and decimal integer text. */
export interface MongoGridFsNamespace {
  database: string;
  bucket: string;
}

export interface MongoGridFsBucket extends MongoGridFsNamespace {
  filesCollection: string;
  chunksCollection: string;
  state: 'complete' | 'files-only' | 'chunks-only';
}

export interface MongoGridFsBuckets {
  database: string;
  buckets: MongoGridFsBucket[];
  truncated: boolean;
}

export interface MongoGridFsFile {
  idEjson: string;
  filename: string;
  length: string | null;
  chunkSize: string | null;
  uploadedAt: string | null;
  contentType: string | null;
  metadataEjson: string;
  rawEjson: string;
  warnings: string[];
}

export interface MongoGridFsPage extends MongoGridFsNamespace {
  files: MongoGridFsFile[];
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
  elapsedMs: number;
  warnings: string[];
}

export interface MongoGridFsSummary extends MongoGridFsNamespace {
  fileCount: string;
  totalBytes: string | null;
  warnings: string[];
}

export interface MongoGridFsListInput extends MongoGridFsNamespace {
  filter?: string;
  sort?: string;
  offset?: number;
  limit?: number;
}

export interface MongoGridFsFileInput extends MongoGridFsNamespace {
  idEjson: string;
}

export const MONGO_GRIDFS_LIMITS = {
  downloadBytes: 1024 * 1024 * 1024,
  browserBufferBytes: 64 * 1024 * 1024,
  bucketNameBytes: 200,
  defaultPage: 50,
  maxPage: 500,
} as const;

/** DBX GridFS file labels, adapted without Number coercion of large lengths. */
export function mongoGridFsSize(value: string | null): string {
  if (value === null || !/^\d+$/.test(value)) return '未知';
  const bytes = BigInt(value);
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  let unit = 0;
  let divisor = 1n;
  while (unit < units.length - 1 && bytes >= divisor * 1024n) {
    divisor *= 1024n;
    unit++;
  }
  if (!unit) return `${bytes} B`;
  const hundredths = bytes * 100n / divisor;
  return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, '0')} ${units[unit]}`;
}

export function mongoGridFsDownloadName(filename: string): string {
  const normalized = filename.replace(/[\\/\p{Cc}<>:"|?*]+/gu, '-').trim();
  const encoder = new TextEncoder();
  let safe = '', bytes = 0;
  for (const character of normalized.replace(/^[.\s]+|[.\s]+$/g, '')) {
    bytes += encoder.encode(character).length;
    if (bytes > 180) break;
    safe += character;
  }
  return !safe || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(safe) ? 'gridfs-file.bin' : safe;
}
