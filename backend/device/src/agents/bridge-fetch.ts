/**
 * npm 原生桥下载器：catalog 声明 npm-download 的桥（如 codex-acp）在打包态
 * 首次使用时从 registry 下载平台包、校验完整性并解出二进制，
 * 缓存于 userData/runtime/bridges/<name>-<version>/。
 */

import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createLogger } from '../platform/logger';
import { getDataDir } from '../platform/paths';

const log = createLogger('bridge-fetch');

/** 可用 FOUC_NPM_REGISTRY 覆盖；官方源失败时自动经 npmmirror 重试一次（国内网络常态） */
const REGISTRY = (process.env.FOUC_NPM_REGISTRY ?? 'https://registry.npmjs.org').replace(/\/+$/, '');
const FALLBACK_REGISTRY = 'https://registry.npmmirror.com';

export interface NpmBridgeSpec {
  npmPackage: string;
  version: string;
  /** 包内二进制路径（含目录段，如 bin/codex-acp.exe） */
  bin: string;
}

/** 确保桥二进制就位并返回其绝对路径；失败抛带清晰原因的 Error */
export async function ensureNpmBridge(spec: NpmBridgeSpec): Promise<string> {
  const shortName = spec.npmPackage.split('/')[1] ?? spec.npmPackage;
  const dir = path.join(getDataDir(), 'runtime', 'bridges', `${shortName}-${spec.version}`);
  const exe = path.join(dir, path.basename(spec.bin));
  if (existsSync(exe)) return exe;
  mkdirSync(dir, { recursive: true });

  const registries = REGISTRY === FALLBACK_REGISTRY ? [REGISTRY] : [REGISTRY, FALLBACK_REGISTRY];
  let lastError: unknown = null;
  for (const registry of registries) {
    try {
      await downloadBridge(registry, spec, dir, exe);
      log.info(`bridge ready: ${exe}`);
      return exe;
    } catch (error) {
      lastError = error;
      log.warn(`bridge download via ${registry} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function downloadBridge(registry: string, spec: NpmBridgeSpec, dir: string, exe: string): Promise<void> {
  const metaUrl = `${registry}/${spec.npmPackage.replace('/', '%2F')}/${spec.version}`;
  const metaRes = await fetch(metaUrl, { signal: AbortSignal.timeout(30_000) });
  if (!metaRes.ok) throw new Error(`registry metadata ${metaRes.status}: ${metaUrl}`);
  const meta = (await metaRes.json()) as { dist?: { tarball?: string; integrity?: string } };
  const { tarball, integrity } = meta.dist ?? {};
  if (!tarball) throw new Error(`tarball URL missing for ${spec.npmPackage}@${spec.version}`);

  log.info(`downloading bridge ${spec.npmPackage}@${spec.version} via ${registry}`);
  const tgzRes = await fetch(tarball, { signal: AbortSignal.timeout(300_000) });
  if (!tgzRes.ok) throw new Error(`tarball download ${tgzRes.status}: ${tarball}`);
  const tgz = Buffer.from(await tgzRes.arrayBuffer());
  if (integrity) verifyIntegrity(tgz, integrity);

  const exeData = extractTarEntry(Buffer.from(Bun.gunzipSync(tgz)), `package/${spec.bin}`);
  if (!exeData) throw new Error(`${spec.bin} not found in ${spec.npmPackage}@${spec.version}`);

  const tmp = `${exe}.tmp`;
  writeFileSync(tmp, exeData);
  chmodSync(tmp, 0o755);
  renameSync(tmp, exe);
}

function verifyIntegrity(data: Buffer, integrity: string): void {
  const sep = integrity.indexOf('-');
  const algo = integrity.slice(0, sep);
  const expected = integrity.slice(sep + 1);
  const actual = createHash(algo).update(data).digest('base64');
  if (actual !== expected) throw new Error(`integrity mismatch (${algo})`);
}

/** 在 ustar 流中取出指定路径的文件内容（npm 包内均为短路径，无 pax 扩展头） */
function extractTarEntry(tar: Buffer, wanted: string): Buffer | null {
  let off = 0;
  while (off + 512 <= tar.length) {
    const name = tar.toString('utf8', off, off + 100).replace(/\0.+$/, '');
    if (!name) return null;
    const size = parseInt(tar.toString('utf8', off + 124, off + 136).replace(/\0/g, '').trim(), 8) || 0;
    const type = String.fromCharCode(tar[off + 156]);
    const dataStart = off + 512;
    if (name === wanted && (type === '0' || type === '\0')) {
      return tar.subarray(dataStart, dataStart + size);
    }
    off = dataStart + Math.ceil(size / 512) * 512;
  }
  return null;
}
