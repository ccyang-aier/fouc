'use client';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './chart-settings-dialog.messages';
import { Info } from '@phosphor-icons/react';
import { SqlDialog } from '../sql-library-dialog';
import type { ChartField, QueryChartConfig } from './model';
import styles from './query-chart.module.css';
const aggregations = (locale?: Locale) => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    { value: 'none', label: tConnector('rawValuesNoAggregation') },
    { value: 'sum', label: tConnector('sumSum') },
    { value: 'avg', label: tConnector('averageAvg') },
    { value: 'min', label: tConnector('minimumMin') },
    { value: 'max', label: tConnector('maximumMax') },
    { value: 'count', label: tConnector('rowCountCount') },
  ] as const;
};
export function ChartSettingsDialog({
  config,
  fields,
  onChange,
  onClose,
}: {
  config: QueryChartConfig;
  fields: readonly ChartField[];
  onChange: (next: Partial<QueryChartConfig>) => void;
  onClose: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  return (
    <SqlDialog
      title={tConnector('advancedChartSettings')}
      className={styles.settingsDialog}
      onClose={onClose}
    >
      <div className={styles.settings}>
        <label>
          {tConnector('chartType')}
          <select
            aria-label={tConnector('advancedChartType')}
            value={config.type}
            onChange={(event) => onChange({ type: event.target.value as QueryChartConfig['type'] })}
          >
            <option value="bar">{tConnector('barChart')}</option>
            <option value="line">{tConnector('lineChart')}</option>
            <option value="pie">{tConnector('pieChart')}</option>
            <option value="area">{tConnector('areaChart')}</option>
            <option value="scatter">{tConnector('scatterPlot')}</option>
          </select>
        </label>
        <label>
          {tConnector('numericProcessing')}
          <select
            aria-label={tConnector('chartAggregation')}
            value={config.aggregation}
            onChange={(event) =>
              onChange({ aggregation: event.target.value as QueryChartConfig['aggregation'] })
            }
          >
            {aggregations(locale).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {tConnector('groupBy')}
          <select
            aria-label={tConnector('chartGroupingField')}
            value={config.group ?? ''}
            onChange={(event) => onChange({ group: event.target.value || null })}
          >
            <option value="">{tConnector('noGrouping')}</option>
            {config.group && !fields.some((field) => field.key === config.group) && (
              <option value={config.group}>{tConnector('fieldNoLongerExists')}</option>
            )}
            {fields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {tConnector('sort')}
          <select
            aria-label={tConnector('chartSortOrder')}
            value={config.sort}
            onChange={(event) => onChange({ sort: event.target.value as QueryChartConfig['sort'] })}
          >
            <option value="source">{tConnector('sourceOrder')}</option>
            <option value="x-asc">{tConnector('xAxisAscending')}</option>
            <option value="x-desc">{tConnector('xAxisDescending')}</option>
            <option value="value-desc">{tConnector('firstSeriesValuesDescending')}</option>
            <option value="value-asc">{tConnector('firstSeriesValuesAscending')}</option>
          </select>
        </label>
        <div className={styles.controlPair}>
          <label>
            {tConnector('categoryLimit')}
            <input
              aria-label={tConnector('chartCategoryLimit')}
              type="number"
              min={1}
              max={1000}
              value={Number.isNaN(config.limit) ? '' : config.limit}
              onChange={(event) =>
                onChange({
                  limit: event.target.value === '' ? Number.NaN : Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            {tConnector('nullMetrics')}
            <select
              aria-label={tConnector('chartNullHandling')}
              value={config.nulls}
              onChange={(event) =>
                onChange({ nulls: event.target.value as QueryChartConfig['nulls'] })
              }
            >
              <option value="gap">{tConnector('keepGaps')}</option>
              <option value="skip">{tConnector('skipTheEntireRow')}</option>
              <option value="zero">{tConnector('explicitlyUseZero')}</option>
            </select>
          </label>
        </div>
        <p className={styles.settingsNote}>
          <Info size={14} />
          {tConnector('aggregationProcessesAllLoadedRowsTheseSettingsDoNotChange')}
        </p>
      </div>
      <footer className={styles.settingsFooter}>
        <button type="button" className="fouc-action" onClick={onClose}>
          {tConnector('done')}
        </button>
      </footer>
    </SqlDialog>
  );
}
