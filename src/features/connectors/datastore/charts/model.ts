import type { DatabaseQueryResult } from '@fouc/shared';
import { columnLabel } from '../result-format';
import { chartNumeric } from './numbers';

export type QueryChartType = 'bar' | 'line' | 'area' | 'scatter' | 'pie';
export type QueryChartAggregation = 'none' | 'sum' | 'avg' | 'min' | 'max' | 'count';
export type QueryChartSort = 'source' | 'x-asc' | 'x-desc' | 'value-asc' | 'value-desc';
export type QueryChartConfig = {
  type: QueryChartType;
  x: string | null;
  ys: string[];
  group: string | null;
  aggregation: QueryChartAggregation;
  sort: QueryChartSort;
  limit: number;
  nulls: 'gap' | 'skip' | 'zero';
  showValues: boolean;
};
export type ChartField = {
  key: string;
  index: number;
  label: string;
  numeric: boolean;
  scalar: boolean;
  unsafe: number;
};
export const CHART_MAX_ROWS = 10_000,
  CHART_MAX_CELLS = 1_000_000,
  CHART_MAX_SERIES = 24,
  CHART_MAX_POINTS = 6000;
export const CHART_STORAGE_PREFIX = 'fouc:query-chart:';
export function chartColumnKeys(columns: readonly string[]): string[] {
  const counts = new Map<string, number>();
  return columns.map((name, index) => {
    const base = name || `#${index + 1}`,
      occurrence = counts.get(base) ?? 0;
    counts.set(base, occurrence + 1);
    return `${base}\u0000${occurrence}`;
  });
}
export function queryChartFields(result: DatabaseQueryResult): ChartField[] {
  const keys = chartColumnKeys(result.columns),
    sample = result.rows.slice(
      0,
      Math.min(CHART_MAX_ROWS, Math.floor(CHART_MAX_CELLS / Math.max(1, result.columns.length))),
    );
  return keys.map((key, index) => {
    let numeric = false,
      scalar = false,
      unsafe = 0;
    // Profiling is bounded as well as rendering; oversized sources receive a settings error.
    for (const row of sample) {
      const value = row[index];
      if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) scalar = true;
      const parsed = chartNumeric(value);
      if ('numeric' in parsed) numeric = true;
      else if (parsed.reason === 'precision') {
        numeric = true;
        unsafe++;
      }
    }
    return { key, index, label: columnLabel(result.columns, index), numeric, scalar, unsafe };
  });
}
export function defaultQueryChartConfig(fields: readonly ChartField[]): QueryChartConfig {
  return {
    type: 'bar',
    x: fields.find((field) => field.scalar && !field.numeric)?.key ?? null,
    ys: fields
      .filter((field) => field.numeric)
      .slice(0, 1)
      .map((field) => field.key),
    group: null,
    aggregation: 'none',
    sort: 'source',
    limit: 200,
    nulls: 'gap',
    showValues: false,
  };
}
export function validQueryChartConfig(value: unknown): value is QueryChartConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Record<string, unknown>;
  return (
    ['bar', 'line', 'area', 'scatter', 'pie'].includes(String(config.type)) &&
    (config.x === null || typeof config.x === 'string') &&
    Array.isArray(config.ys) &&
    config.ys.length <= 6 &&
    config.ys.every((item) => typeof item === 'string') &&
    (config.group === null || typeof config.group === 'string') &&
    ['none', 'sum', 'avg', 'min', 'max', 'count'].includes(String(config.aggregation)) &&
    ['source', 'x-asc', 'x-desc', 'value-asc', 'value-desc'].includes(String(config.sort)) &&
    typeof config.limit === 'number' &&
    Number.isInteger(config.limit) &&
    config.limit >= 1 &&
    config.limit <= 1000 &&
    ['gap', 'skip', 'zero'].includes(String(config.nulls)) &&
    typeof config.showValues === 'boolean'
  );
}
export function loadQueryChartConfig(
  storage: Pick<Storage, 'getItem'> | undefined,
  scope: string | undefined,
): QueryChartConfig | null {
  if (!storage || !scope) return null;
  try {
    const saved: unknown = JSON.parse(storage.getItem(CHART_STORAGE_PREFIX + scope) ?? 'null');
    if (
      saved &&
      typeof saved === 'object' &&
      'version' in saved &&
      saved.version === 1 &&
      'config' in saved &&
      validQueryChartConfig(saved.config)
    )
      return saved.config;
  } catch {}
  return null;
}
export function saveQueryChartConfig(
  storage: Pick<Storage, 'setItem'> | undefined,
  scope: string | undefined,
  config: QueryChartConfig,
): boolean {
  if (!storage || !scope || !validQueryChartConfig(config)) return false;
  try {
    storage.setItem(CHART_STORAGE_PREFIX + scope, JSON.stringify({ version: 1, config }));
    return true;
  } catch {
    return false;
  }
}
