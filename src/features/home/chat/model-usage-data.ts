/** Bucketed calls and total input + output tokens over the same preceding seven days. */
export type UsageSeries = {
  source: 'mock' | 'live';
  points: number[];
  calls: number;
  totalTokens: number;
};

/** Stable fixtures until sitewide seven-day usage aggregation is available. */
export function getMockModelUsage(modelId: string): UsageSeries {
  let seed = 2166136261;
  for (const char of modelId) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const phase = seed % 19;
  const volume = 120 + seed % 1400;
  const tokensPerCall = 1000 + seed % 16000;
  // Twenty-eight six-hour buckets cover the complete week.
  const points = Array.from({ length: 28 }, (_, index) => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const variation = (seed >>> 0) / 0xffffffff;
    return Math.round((45 + Math.sin((index + phase) / 4) * 20 + Math.sin(index / 1.9 + phase) * 9 + variation * 7) * volume / 50);
  });
  const calls = points.reduce((sum, count) => sum + count, 0);
  return { source: 'mock', points, calls, totalTokens: calls * tokensPerCall };
}

/** Callers supply the same time buckets; an empty candidate pool has zero usage. */
export function aggregateModelUsage(series: UsageSeries[]): UsageSeries {
  const aggregate: UsageSeries = {
    source: series.length && series.every(item => item.source === 'live') ? 'live' : 'mock',
    points: [], calls: 0, totalTokens: 0,
  };
  for (const item of series) {
    item.points.forEach((value, index) => { aggregate.points[index] = (aggregate.points[index] ?? 0) + value; });
    aggregate.calls += item.calls;
    aggregate.totalTokens += item.totalTokens;
  }
  return aggregate;
}
