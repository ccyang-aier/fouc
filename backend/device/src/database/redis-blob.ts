import type { RedisBlob } from '@fouc/shared';

/** DBX lossless blob semantics; binary data is never edited through its hex label. */
export function redisBlob(bytes: Buffer): RedisBlob {
  const text = bytes.toString('utf8');
  const utf8 = Buffer.from(text, 'utf8').equals(bytes) &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text);
  return { rawBase64: bytes.toString('base64'), encoding: utf8 ? 'utf8' : 'binary',
    display: utf8 ? text : `0x${bytes.toString('hex')}` };
}
