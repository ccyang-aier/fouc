'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './chart-data-preview.messages';
import { useState } from 'react';
import type { QueryChartData } from './transform';
import styles from './query-chart.module.css';
export function ChartDataPreview({ data }: { data: QueryChartData }) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [page, setPage] = useState(0),
    pages = Math.max(1, Math.ceil(data.categories.length / 40)),
    current = Math.min(page, pages - 1),
    start = current * 40;
  return (
    <div className={styles.dataPreview}>
      <div className={styles.previewHead}>
        <span>{tConnector('chartDataNumericTextRetainsPrecision')}</span>
        <div>
          <button
            type="button"
            className="fouc-action"
            disabled={!current}
            onClick={() => setPage(current - 1)}
          >
            {tConnector('previousPage')}
          </button>
          <small>
            {current + 1} / {pages}
          </small>
          <button
            type="button"
            className="fouc-action"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            {tConnector('nextPage')}
          </button>
        </div>
      </div>
      <div className={styles.previewScroll}>
        <table>
          <thead>
            <tr>
              <th>{tConnector('category')}</th>
              {data.series.map((series) => (
                <th key={series.key}>{series.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.categories.slice(start, start + 40).map((category, offset) => (
              <tr key={category.key}>
                <th>{category.label}</th>
                {data.series.map((series) => {
                  const point = series.data[start + offset];
                  return (
                    <td
                      key={series.key}
                      title={
                        point
                          ? tConnector('sourceRows', { p0: String(point.sourceRows) })
                          : tConnector('notPlottedNullMissingValuesOrPrecisionLimits')
                      }
                    >
                      <code>{point?.exact ?? '—'}</code>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
