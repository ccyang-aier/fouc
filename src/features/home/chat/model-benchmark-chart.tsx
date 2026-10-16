import type { ModelCatalogEntry } from '@fouc/shared/model-catalog';
import styles from './model-benchmark-chart.module.css';

export function ModelBenchmarkChart({ benchmarks }: { benchmarks: ModelCatalogEntry['benchmarks'] }) {
  const angle = (index: number) => -Math.PI / 2 + index * Math.PI * 2 / benchmarks.length;
  const point = (index: number, radius: number) => [184 + Math.cos(angle(index)) * radius, 110 + Math.sin(angle(index)) * radius];
  const polygon = (radius: number) => benchmarks.map((_, index) => point(index, radius).join(',')).join(' ');

  return <svg viewBox="0 0 368 220" className={styles.chart} role="img"
    aria-label={benchmarks.map(benchmark => `${benchmark.name} ${benchmark.score}%`).join(' · ')}>
    {[17, 34, 51, 68].map(radius => <polygon key={radius} points={polygon(radius)} className={styles.grid} />)}
    {benchmarks.map((benchmark, index) => <line key={benchmark.name} x1="184" y1="110"
      x2={point(index, 68)[0]} y2={point(index, 68)[1]} className={styles.grid} />)}
    <polygon points={benchmarks.map((benchmark, index) => point(index, benchmark.score * .68).join(',')).join(' ')} className={styles.result} />
    {benchmarks.map((benchmark, index) => {
      const x = 184 + Math.cos(angle(index)) * 138;
      const y = 110 + Math.sin(angle(index)) * 90;
      return <a key={benchmark.name} href={benchmark.sourceUrl} target="_blank" rel="noreferrer" className={styles.label}>
        <title>{benchmark.name}: {benchmark.score}%</title>
        <text x={x} y={y - 3} textAnchor="middle">
          <tspan x={x}>{benchmark.name}</tspan>
          <tspan x={x} dy="17" className={styles.score}>{benchmark.score}%</tspan>
        </text>
      </a>;
    })}
  </svg>;
}
