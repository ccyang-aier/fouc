import { expect, test } from 'bun:test';
import { getMockModelUsage } from './model-usage-data';
import { createUsagePaths } from './model-usage-path';

test('empty and zero usage rest on the baseline without an area; constant usage has no artificial oscillation', () => {
  expect(createUsagePaths([])).toEqual({ line: 'M1,19 L51,19', area: '' });
  expect(createUsagePaths([0])).toEqual(createUsagePaths([0, 0, 0]));
  expect(createUsagePaths([7]).line).toBe('M1,10 L51,10');
  expect(createUsagePaths([7, 7, 7])).toEqual(createUsagePaths([7]));
});

test('the weekly trend interpolates every bucket, including small turns previously removed by averaging', () => {
  const usage = getMockModelUsage('openai/gpt-6.1-sol');
  const { line, area } = createUsagePaths(usage.points);
  const endpoints = line.split(' C').map((segment, index) => (index ? segment.split(' ').at(-1)! : segment.slice(1)).split(',').map(Number));
  const min = Math.min(...usage.points);
  const range = Math.max(...usage.points) - min;
  expect(endpoints).toHaveLength(28);
  endpoints.forEach(([x, y], index) => {
    expect(x).toBeCloseTo(1 + index / 27 * 50, 2);
    expect(y).toBeCloseTo(17 - (usage.points[index] - min) / range * 15, 2);
  });
  expect(area).toBe(`${line} L51,19 L1,19 Z`);
});

test('sharp peaks, plateaus and zero buckets never produce overshoot or invented extrema', () => {
  const { line } = createUsagePaths([0, 9, 9, 1, 7, 0, 1, 20, 1]);
  const [start, ...segments] = line.split(' C');
  let before = Number(start.split(',')[1]);
  for (const segment of segments) {
    const [, control1, , control2, , after] = segment.split(/[ ,]/).map(Number);
    let previous = before;
    for (let sample = 1; sample <= 40; sample++) {
      const t = sample / 40;
      const y = (1 - t) ** 3 * before + 3 * (1 - t) ** 2 * t * control1 + 3 * (1 - t) * t ** 2 * control2 + t ** 3 * after;
      expect(y).toBeGreaterThanOrEqual(Math.min(before, after) - .01);
      expect(y).toBeLessThanOrEqual(Math.max(before, after) + .01);
      expect((y - previous) * Math.sign(after - before)).toBeGreaterThanOrEqual(-.01);
      previous = y;
    }
    before = after;
  }
});
