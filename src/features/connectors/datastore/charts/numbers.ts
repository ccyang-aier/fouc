/** Decimal arithmetic keeps database precision until the final plotting boundary. */
export type ChartDecimal = { coefficient: bigint; scale: number };
export type ChartNumeric = {
  value: number;
  exact: string;
  decimal: ChartDecimal;
  approximate?: boolean;
};
export type ChartNumberResult =
  { numeric: ChartNumeric } | { reason: 'null' | 'missing' | 'invalid' | 'precision' };
const pattern = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/;
const MAX_DIGITS = 2048;

function normalized(coefficient: bigint, scale: number): ChartDecimal {
  if (!coefficient) return { coefficient: 0n, scale: 0 };
  while (coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale--;
  }
  return { coefficient, scale };
}
export function chartDecimal(text: string): ChartDecimal | null {
  const match = pattern.exec(text.trim());
  if (!match) return null;
  const fraction = match[3] ?? match[4] ?? '',
    exponent = Number(match[5] ?? 0),
    digits = (match[2] ?? '') + fraction;
  if (!Number.isInteger(exponent) || Math.abs(exponent) > MAX_DIGITS || digits.length > MAX_DIGITS)
    return null;
  return normalized(BigInt(`${match[1] === '-' ? '-' : ''}${digits}`), fraction.length - exponent);
}
export function chartDecimalText(decimal: ChartDecimal): string {
  const negative = decimal.coefficient < 0n,
    digits = (negative ? -decimal.coefficient : decimal.coefficient).toString(),
    scale = decimal.scale;
  const value =
    scale <= 0
      ? digits + '0'.repeat(-scale)
      : scale >= digits.length
        ? `0.${'0'.repeat(scale - digits.length)}${digits}`
        : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return `${negative ? '-' : ''}${value}`;
}
function equal(a: ChartDecimal, b: ChartDecimal) {
  return a.coefficient === b.coefficient && a.scale === b.scale;
}
export function plotDecimal(
  decimal: ChartDecimal,
  exact = chartDecimalText(decimal),
): ChartNumeric | null {
  const value = Number(chartDecimalText(decimal)),
    plotted = chartDecimal(String(value));
  if (
    !Number.isFinite(value) ||
    (Number.isInteger(value) && !Number.isSafeInteger(value)) ||
    !plotted ||
    !equal(decimal, plotted)
  )
    return null;
  return { value, exact, decimal };
}
export function chartNumeric(value: unknown): ChartNumberResult {
  if (value === undefined) return { reason: 'missing' };
  if (value === null) return { reason: 'null' };
  if (typeof value !== 'number' && typeof value !== 'string') return { reason: 'invalid' };
  if (
    typeof value === 'number' &&
    (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
  )
    return { reason: 'precision' };
  const text = String(value).trim();
  if (!text || !pattern.test(text)) return { reason: 'invalid' };
  const decimal = chartDecimal(text),
    numeric = decimal && plotDecimal(decimal, text);
  return numeric ? { numeric } : { reason: 'precision' };
}
export function addChartDecimals(a: ChartDecimal, b: ChartDecimal): ChartDecimal {
  const scale = Math.max(a.scale, b.scale);
  return normalized(
    a.coefficient * 10n ** BigInt(scale - a.scale) + b.coefficient * 10n ** BigInt(scale - b.scale),
    scale,
  );
}
export function compareChartDecimals(a: ChartDecimal, b: ChartDecimal): number {
  const scale = Math.max(a.scale, b.scale),
    left = a.coefficient * 10n ** BigInt(scale - a.scale),
    right = b.coefficient * 10n ** BigInt(scale - b.scale);
  return left < right ? -1 : left > right ? 1 : 0;
}
/** Non-terminating means are deliberately labelled approximate; sums are never silently rounded. */
export function meanChartDecimal(sum: ChartDecimal, count: number): ChartNumeric | null {
  if (!count) return null;
  let numerator = sum.coefficient,
    denominator = BigInt(count);
  if (sum.scale >= 0) denominator *= 10n ** BigInt(sum.scale);
  else numerator *= 10n ** BigInt(-sum.scale);
  const negative = numerator < 0n;
  numerator = negative ? -numerator : numerator;
  const integer = numerator / denominator;
  let remainder = numerator % denominator,
    fraction = '',
    significant = integer ? 1 : 0;
  for (let i = 0; remainder && significant < 32 && i < MAX_DIGITS * 2 + 64; i++) {
    remainder *= 10n;
    const digit = remainder / denominator;
    fraction += digit.toString();
    remainder %= denominator;
    if (digit || significant) significant++;
  }
  const text = `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`,
    decimal = chartDecimal(text);
  if (!decimal) return null;
  if (!remainder) return plotDecimal(decimal);
  const value = Number(text);
  if (
    !Number.isFinite(value) ||
    (numerator !== 0n && value === 0) ||
    (Number.isInteger(value) && !Number.isSafeInteger(value))
  )
    return null;
  const plotted = chartDecimal(String(value));
  return plotted
    ? {
        value,
        decimal: plotted,
        exact: `≈ ${value}（${chartDecimalText(sum)} / ${count}）`,
        approximate: true,
      }
    : null;
}
