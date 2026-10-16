import { expect, test } from 'bun:test';
import { aggregateModelUsage, getMockModelUsage, type UsageSeries } from './model-usage-data';

test('weekly aggregation sums candidate buckets and input + output tokens without mutating them', () => {
  const first: UsageSeries = { source: 'live', points: [2, 7, 3], calls: 12, totalTokens: 9000 };
  const second: UsageSeries = { source: 'live', points: [5, 1, 4], calls: 10, totalTokens: 6000 };
  const result = aggregateModelUsage([first, second]);
  expect(result).toEqual({ source: 'live', points: [7, 8, 7], calls: 22, totalTokens: 15000 });
  expect(first.points).toEqual([2, 7, 3]);
  expect(second.points).toEqual([5, 1, 4]);
});

test('mixed and empty candidate pools never present mock statistics as live usage', () => {
  const live: UsageSeries = { source: 'live', points: [3, 2], calls: 5, totalTokens: 4000 };
  const mock: UsageSeries = { source: 'mock', points: [1, 4], calls: 5, totalTokens: 8000 };
  expect(aggregateModelUsage([live, mock])).toEqual({ source: 'mock', points: [4, 6], calls: 10, totalTokens: 12000 });
  expect(aggregateModelUsage([])).toEqual({ source: 'mock', points: [], calls: 0, totalTokens: 0 });
});

test('weekly model fixtures are stable and their bucket totals match displayed calls', () => {
  const series = getMockModelUsage('openai/gpt-6.1-sol');
  expect(getMockModelUsage('openai/gpt-6.1-sol')).toEqual(series);
  expect(getMockModelUsage('anthropic/claude-sonnet-5.5')).not.toEqual(series);
  expect(series.points).toHaveLength(28);
  expect(series.points.reduce((total, value) => total + value, 0)).toBe(series.calls);
  expect(series.totalTokens).toBeGreaterThan(series.calls);
});
