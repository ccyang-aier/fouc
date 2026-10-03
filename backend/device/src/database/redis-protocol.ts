/** RESP integers must never pass through an unsafe JavaScript Number. */
export function redisUnsigned(raw: unknown): string {
  if (typeof raw === 'number' && (!Number.isSafeInteger(raw) || raw < 0)) throw new Error('Redis 数值已丢失精度');
  const value = Buffer.isBuffer(raw) ? raw.toString() : String(raw);
  if (!/^\d+$/.test(value) || BigInt(value) > 18446744073709551615n) throw new Error('Redis 64 位非负数值格式无效');
  return BigInt(value).toString();
}
export function redisProtocolBytes(raw: unknown): Buffer {
  if (Buffer.isBuffer(raw)) return raw;
  if (typeof raw === 'string') return Buffer.from(raw);
  throw new Error('Redis 字节参数格式无效');
}
