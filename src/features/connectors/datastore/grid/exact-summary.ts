import type { DatabaseCell } from '@fouc/shared';

type Decimal = { coefficient: bigint; scale: number };
export type ExactSelectionSummary = {
  numericCount: number;
  sum: string | null;
  average: string | null;
  averageApproximate: boolean;
  unsafeNumericCount: number;
  limitedNumericCount: number;
};
const DECIMAL = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/;
const MAX_DECIMAL_DIGITS = 8192;
const MAX_DECIMAL_SCALE = 8192;

function parseDecimal(value: DatabaseCell): Decimal | 'unsafe' | 'limited' | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value))
    return 'unsafe';
  const text = String(value).trim(),
    match = DECIMAL.exec(text);
  if (!match) return null;
  const fraction = match[3] ?? match[4] ?? '',
    digits = (match[2] ?? '') + fraction,
    exponent = Number(match[5] ?? 0);
  if (
    digits.length > MAX_DECIMAL_DIGITS ||
    !Number.isInteger(exponent) ||
    Math.abs(exponent) > MAX_DECIMAL_SCALE
  )
    return 'limited';
  let coefficient = BigInt((match[1] === '-' ? '-' : '') + digits),
    scale = fraction.length - exponent;
  if (Math.abs(scale) > MAX_DECIMAL_SCALE) return 'limited';
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { coefficient, scale };
}

export function formatExactDecimal(coefficient: bigint, scale: number): string {
  const negative = coefficient < 0,
    text = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, '0');
  const value = scale
    ? `${text.slice(0, -scale)}.${text.slice(-scale)}`.replace(/\.?0+$/, '')
    : text;
  return (negative && coefficient !== 0n ? '-' : '') + (value || '0');
}

export function compareExactGridNumbers(left: DatabaseCell, right: DatabaseCell): number | null {
  const a = parseDecimal(left),
    b = parseDecimal(right);
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return null;
  const scale = Math.max(a.scale, b.scale),
    x = a.coefficient * 10n ** BigInt(scale - a.scale),
    y = b.coefficient * 10n ** BigInt(scale - b.scale);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Aggregate original decimal text with BigInt; unsafe driver numbers are explicitly excluded. */
export function summarizeExactValues(values: Iterable<DatabaseCell>): ExactSelectionSummary {
  let sum = 0n,
    scale = 0,
    numericCount = 0,
    unsafeNumericCount = 0,
    limitedNumericCount = 0;
  for (const value of values) {
    const decimal = parseDecimal(value);
    if (decimal === 'unsafe') {
      unsafeNumericCount++;
      continue;
    }
    if (decimal === 'limited') {
      limitedNumericCount++;
      continue;
    }
    if (!decimal) continue;
    numericCount++;
    if (decimal.scale > scale) {
      sum *= 10n ** BigInt(decimal.scale - scale);
      scale = decimal.scale;
    }
    sum += decimal.coefficient * 10n ** BigInt(scale - decimal.scale);
  }
  if (!numericCount)
    return {
      numericCount,
      sum: null,
      average: null,
      averageApproximate: false,
      unsafeNumericCount,
      limitedNumericCount,
    };
  const count = BigInt(numericCount),
    exact = sum % count === 0n;
  const averageCoefficient = exact ? sum / count : (sum * 10n ** 12n) / count;
  return {
    numericCount,
    sum: formatExactDecimal(sum, scale),
    average: formatExactDecimal(averageCoefficient, exact ? scale : scale + 12),
    averageApproximate: !exact && (sum * 10n ** 12n) % count !== 0n,
    unsafeNumericCount,
    limitedNumericCount,
  };
}
