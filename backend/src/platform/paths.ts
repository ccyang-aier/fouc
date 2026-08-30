/**
 * 数据目录解析。优先级：FOUC_DATA_DIR 环境变量（Tauri 壳注入 userData 路径）
 * → 平台默认目录。
 */

import os from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

export function getDataDir(): string {
  const explicit = process.env.FOUC_DATA_DIR?.trim();
  if (explicit) {
    mkdirSync(explicit, { recursive: true });
    return explicit;
  }
  const dir = path.join(os.homedir(), '.fouc');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDbPath(): string {
  return path.join(getDataDir(), 'fouc.db');
}

/** 桥接包运行时缓存目录（Windows 上同时用于 TMP/TEMP 重定向，规避杀软 EPERM） */
export function getBridgeCacheDir(): string {
  return path.join(getDataDir(), 'runtime', 'bridge-cache');
}
