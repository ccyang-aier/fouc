/** A small, relative trend chart: every time bucket remains an interpolation point. */
export function createUsagePaths(values: readonly number[]) {
  const baseline = 19;
  const max = values.length ? Math.max(...values) : 0;
  if (!max) return { line: `M1,${baseline} L51,${baseline}`, area: '' };

  const min = Math.min(...values);
  const range = max - min;
  if (!range) return { line: 'M1,10 L51,10', area: `M1,10 L51,10 L51,${baseline} L1,${baseline} Z` };

  const step = 50 / (values.length - 1);
  const points = values.map((value, index) => ({ x: 1 + index * step, y: 17 - (value - min) / range * 15 }));
  const deltas = points.slice(1).map((point, index) => point.y - points[index].y);
  const tangents = points.map((_, index) => {
    if (!index) return deltas[0];
    if (index === points.length - 1) return deltas[index - 1];
    const before = deltas[index - 1];
    const after = deltas[index];
    // Zero at each turning point; the harmonic mean keeps each segment bounded.
    return before * after > 0 ? 2 * before * after / (before + after) : 0;
  });
  const coordinate = (value: number) => value.toFixed(2);
  let line = `M${coordinate(points[0].x)},${coordinate(points[0].y)}`;
  for (let index = 1; index < points.length; index++) {
    const before = points[index - 1];
    const after = points[index];
    line += ` C${coordinate(before.x + step / 3)},${coordinate(before.y + tangents[index - 1] / 3)}`
      + ` ${coordinate(after.x - step / 3)},${coordinate(after.y - tangents[index] / 3)}`
      + ` ${coordinate(after.x)},${coordinate(after.y)}`;
  }
  return { line, area: `${line} L51,${baseline} L1,${baseline} Z` };
}
