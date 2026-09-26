/**
 * 上传界面的视图模型(U08):相位 → 文案/进度语义、错误码 → 用户可读副本、
 * 字节数格式化。纯函数,UI 与测试共用同一份映射。
 */

import type { AssetUploadErrorCode, AssetUploadItem } from './upload-machine';

export interface UploadPhaseView {
  label: string;
  /** 按字节计量的相位,进度条显示 progress;否则不确定(indeterminate)。 */
  byteProgress: boolean;
  indeterminate: boolean;
  active: boolean;
}

export function uploadPhaseView(item: Pick<AssetUploadItem, 'phase' | 'progress'>): UploadPhaseView {
  switch (item.phase) {
    case 'hashing':
      return { label: '计算 SHA-256', byteProgress: true, indeterminate: false, active: true };
    case 'preparing':
      return { label: '获取上传授权', byteProgress: false, indeterminate: true, active: true };
    case 'uploading':
      return { label: '上传', byteProgress: true, indeterminate: false, active: true };
    case 'confirming':
      return { label: '确认完整性', byteProgress: false, indeterminate: true, active: true };
    case 'done':
      return { label: '已就绪', byteProgress: false, indeterminate: false, active: false };
    case 'canceled':
      return { label: '已取消', byteProgress: false, indeterminate: false, active: false };
    case 'error':
      return { label: '失败', byteProgress: false, indeterminate: false, active: false };
  }
}

const errorCopy: Record<AssetUploadErrorCode, string> = {
  FILE_INVALID: '文件不符合上传要求',
  HASH_FAILED: '读取文件失败',
  PREPARE_FAILED: '获取上传授权失败',
  TRANSFER_NETWORK: '网络中断,直传未完成',
  TRANSFER_REJECTED: '对象存储拒绝了上传',
  CONFIRM_FAILED: '完整性确认未通过',
};

export function uploadErrorCopy(item: Pick<AssetUploadItem, 'error'>): string | null {
  if (!item.error) return null;
  const base = errorCopy[item.error.code];
  return item.error.detail ? `${base}(${item.error.detail})` : base;
}

export function uploadRetryHint(item: Pick<AssetUploadItem, 'error'>): string | null {
  if (!item.error) return null;
  switch (item.error.code) {
    case 'CONFIRM_FAILED': return '服务端已删除不匹配的对象,重试将重新上传并确认。';
    case 'TRANSFER_REJECTED': return '预签名授权可能已过期,重试会重新获取。';
    case 'TRANSFER_NETWORK': return '检查网络后重试;已算出的指纹不会重算。';
    default: return null;
  }
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = size;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
}
