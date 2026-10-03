/** A per-column seeded stream, unlike DBX's global Math.random state. */
export class TestDataRandom {
  private state: number;

  constructor(seed: string) {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index++) {
      hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
    }
    this.state = hash >>> 0;
  }

  uint32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  }

  /** Uniform inclusive integer sampling; no precision loss or modulo bias. */
  integer(min: bigint, max: bigint): bigint {
    if (min > max) throw new Error('随机范围的最小值不能大于最大值。');
    const span = max - min + 1n;
    if (span === 1n) return min;
    const bits = (span - 1n).toString(2).length;
    const words = Math.ceil(bits / 32);
    const mask = (1n << BigInt(bits)) - 1n;
    for (;;) {
      let value = 0n;
      for (let index = 0; index < words; index++) value = (value << 32n) | BigInt(this.uint32());
      value &= mask;
      if (value < span) return min + value;
    }
  }

  pick<T>(values: readonly T[]): T {
    if (!values.length) throw new Error('候选值不能为空。');
    return values[Number(this.integer(0n, BigInt(values.length - 1)))];
  }
}

export function testDataScaledDecimal(value: string, scale: number): bigint {
  if (!Number.isInteger(scale) || scale < 0 || scale > 100) throw new Error('小数位数必须为 0–100。');
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);
  if (!match || value.length > 104) throw new Error('请输入最多 100 位的普通十进制数，不使用指数或千位分隔符。');
  const fraction = match[3] ?? '';
  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale))) throw new Error(`数值 ${value} 超过 ${scale} 位小数，生成器不会自动舍入。`);
  const digits = match[2] + fraction.slice(0, scale).padEnd(scale, '0');
  return BigInt(digits) * (match[1] ? -1n : 1n);
}

export function testDataDecimalText(value: bigint, scale: number): string {
  const sign = value < 0n ? '-' : '';
  const digits = (value < 0n ? -value : value).toString().padStart(scale + 1, '0');
  return scale ? `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}` : sign + digits;
}
