import { createHash, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { z } from 'zod';
import { assetHashSchema, entityIdSchema } from '@fouc/shared/knowledge/contracts';
import { KnowledgeAssetError } from './errors';

/** Matches the runtime `config.storage` shape so composition passes it through unchanged. */
export interface KnowledgeAssetStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const configSchema = z.strictObject({
  endpoint: z.url().refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.hash && url.pathname === '/';
  }, 'S3 endpoint must be a bare HTTP origin'),
  region: z.string().min(1).max(64),
  bucket: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, 'Invalid S3 bucket name'),
  accessKeyId: z.string().min(1).max(128),
  secretAccessKey: z.string().min(1).max(128),
});

/**
 * Environment first; local development falls back to the generated credentials
 * file, mirroring readFoucDatabaseConnections. Never logs these values.
 */
export async function readKnowledgeAssetStorageConfig(environment: NodeJS.ProcessEnv = process.env): Promise<KnowledgeAssetStorageConfig> {
  let local: Record<string, string | undefined> = {};
  if (!environment.S3_ENDPOINT) {
    try {
      local = parseEnv(await readFile(new URL('../../../../../../.env.fouc.local', import.meta.url), 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  const source = { ...local, ...environment };
  const parsed = configSchema.safeParse({
    endpoint: source.S3_ENDPOINT, region: source.S3_REGION, bucket: source.S3_BUCKET,
    accessKeyId: source.S3_ACCESS_KEY_ID, secretAccessKey: source.S3_SECRET_ACCESS_KEY,
  });
  if (!parsed.success) throw new KnowledgeAssetError('INVALID_STORAGE_CONFIG');
  return parsed.data;
}

export interface AssetObjectStat { size: number; mime: string; etag: string }
export interface AssetPresignedUrl { url: string; expiresAt: string }

export interface AssetObjectAddress { workspaceId: string; hash: string }

const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';
const sha256Hex = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const hmac = (key: string | Buffer, value: string) => createHmac('sha256', key).update(value).digest();
const amzDate = (at: Date) => at.toISOString().replace(/[:-]|\.\d{3}/g, '');

/** RFC 3986 strict encoding: SigV4 requires !'()* to be percent-encoded too. */
function uriEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * Path-style, workspace-scoped object addressing: <workspaceId>/<sha256>.
 * Hash addressing never crosses workspaces, so identical content in two
 * workspaces is two independent objects with no shared existence signal.
 */
function address(input: AssetObjectAddress) {
  if (!entityIdSchema.safeParse(input.workspaceId).success || !assetHashSchema.safeParse(input.hash).success) {
    throw new KnowledgeAssetError('INVALID_ASSET_INPUT');
  }
  return input;
}

const requestTimeoutMs = 15_000;

/** Server-side SigV4 transport for HEAD/GET/DELETE and query-presigned client URLs. */
export function createKnowledgeAssetStorage(input: KnowledgeAssetStorageConfig) {
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) throw new KnowledgeAssetError('INVALID_STORAGE_CONFIG');
  const config = parsed.data;
  const origin = new URL(config.endpoint).origin;

  const objectUrl = (target: AssetObjectAddress) => new URL(`${origin}/${[config.bucket, target.workspaceId, target.hash].map(uriEncode).join('/')}`);

  function signingMaterial(at = new Date()) {
    const date = amzDate(at);
    return { date, scope: `${date.slice(0, 8)}/${config.region}/s3/aws4_request`, signingKey: hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, date.slice(0, 8)), config.region), 's3'), 'aws4_request') };
  }

  async function request(method: 'HEAD' | 'GET' | 'DELETE', target: AssetObjectAddress, signal?: AbortSignal) {
    const url = objectUrl(address(target));
    const { date, scope, signingKey } = signingMaterial();
    const payloadHash = sha256Hex('');
    const headers = { host: url.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': date };
    const signedHeaders = Object.keys(headers).join(';');
    const canonicalHeaders = Object.entries(headers).map(([key, value]) => `${key}:${value}\n`).join('');
    const canonical = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const signature = createHmac('sha256', signingKey).update(`AWS4-HMAC-SHA256\n${date}\n${scope}\n${sha256Hex(canonical)}`).digest('hex');
    const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    try {
      return await fetch(url, { method, headers: { ...headers, authorization }, signal: signal ?? AbortSignal.timeout(requestTimeoutMs) });
    } catch {
      throw new KnowledgeAssetError('ASSET_STORAGE_UNAVAILABLE');
    }
  }

  /** Presigned client URLs: the method is part of the signature and the grant expires. */
  function presign(method: 'PUT' | 'GET', target: AssetObjectAddress, expiresInSeconds: number): AssetPresignedUrl {
    address(target);
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 3600) {
      throw new KnowledgeAssetError('INVALID_ASSET_INPUT');
    }
    const url = objectUrl(target);
    const issuedAt = new Date();
    const { date, scope, signingKey } = signingMaterial(issuedAt);
    const query = new Map([
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', `${config.accessKeyId}/${scope}`],
      ['X-Amz-Date', date],
      ['X-Amz-Expires', String(expiresInSeconds)],
      ['X-Amz-SignedHeaders', 'host'],
    ]);
    const canonicalQuery = [...query.entries()].sort(([left], [right]) => (left < right ? -1 : 1)).map(([key, value]) => `${uriEncode(key)}=${uriEncode(value)}`).join('&');
    const canonical = [method, url.pathname, canonicalQuery, `host:${url.host}\n`, 'host', UNSIGNED_PAYLOAD].join('\n');
    const signature = createHmac('sha256', signingKey).update(`AWS4-HMAC-SHA256\n${date}\n${scope}\n${sha256Hex(canonical)}`).digest('hex');
    url.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;
    return { url: url.toString(), expiresAt: new Date(issuedAt.getTime() + expiresInSeconds * 1000).toISOString() };
  }

  return {
    objectKey: (target: AssetObjectAddress) => { const safe = address(target); return `${safe.workspaceId}/${safe.hash}`; },
    presignUpload: (target: AssetObjectAddress, expiresInSeconds = 600) => presign('PUT', target, expiresInSeconds),
    presignDownload: (target: AssetObjectAddress, expiresInSeconds = 300) => presign('GET', target, expiresInSeconds),
    async statObject(target: AssetObjectAddress, signal?: AbortSignal): Promise<AssetObjectStat | undefined> {
      const response = await request('HEAD', target, signal);
      if (response.status === 404) return undefined;
      if (!response.ok) throw new KnowledgeAssetError('ASSET_STORAGE_UNAVAILABLE');
      const length = response.headers.get('content-length');
      const mime = response.headers.get('content-type');
      const etag = response.headers.get('etag');
      if (length === null || mime === null || etag === null || !/^\d+$/.test(length)) throw new KnowledgeAssetError('ASSET_STORAGE_UNAVAILABLE');
      return { size: Number(length), mime, etag: etag.replaceAll('"', '') };
    },
    async openObject(target: AssetObjectAddress, signal?: AbortSignal): Promise<Response> {
      const response = await request('GET', target, signal);
      if (response.status === 404) throw new KnowledgeAssetError('ASSET_OBJECT_MISSING');
      if (!response.ok || !response.body) throw new KnowledgeAssetError('ASSET_STORAGE_UNAVAILABLE');
      return response;
    },
    async deleteObject(target: AssetObjectAddress, signal?: AbortSignal): Promise<boolean> {
      const response = await request('DELETE', target, signal);
      if (response.status === 404) return false;
      if (!response.ok) throw new KnowledgeAssetError('ASSET_STORAGE_UNAVAILABLE');
      return true;
    },
  };
}

export type KnowledgeAssetStorage = ReturnType<typeof createKnowledgeAssetStorage>;
