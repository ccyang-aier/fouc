'use client';
import { useTranslation, createTranslator } from '@/lib/i18n';
import { messages as connectorMessages } from './query-chart-builder.messages';
const translateConnector = createTranslator(connectorMessages);
import { useMemo, useState } from 'react';
import { ChartBar, ChartLine, WarningCircle } from '@phosphor-icons/react';
import { useAppAlert } from '@/components/app-alert-provider';
import type { DatabaseQueryResult } from '@fouc/shared';
import { QueryChartCanvas } from './chart-canvas';
import { ChartToolbar } from './chart-toolbar';
import { ChartSettingsDialog } from './chart-settings-dialog';
import { ChartDataPreview } from './chart-data-preview';
import { useStoredChartConfig } from './config-storage';
import {
  defaultQueryChartConfig,
  queryChartFields,
  type ChartField,
  type QueryChartConfig,
} from './model';
import { transformQueryChart } from './transform';
import styles from './query-chart.module.css';
export type QueryChartBuilderProps = {
  result: DatabaseQueryResult; /** Stable connection / document identity, supplied by the resource owner. */
  scopeKey?: string;
};
function ChartBuilderContent({
  result,
  fields,
  initial,
  initialSaved,
  save,
  persistent,
}: {
  result: DatabaseQueryResult;
  fields: ChartField[];
  initial: QueryChartConfig;
  initialSaved: boolean;
  save: (config: QueryChartConfig) => boolean;
  persistent: boolean;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [config, setConfig] = useState(initial),
    [savedSignature, setSavedSignature] = useState<string | null>(
      initialSaved ? JSON.stringify(initial) : null,
    ),
    [settings, setSettings] = useState(false),
    [preview, setPreview] = useState(false);
  const { notify } = useAppAlert();
  const data = useMemo(
      () => transformQueryChart(result, config, fields, locale),
      [result, config, fields, locale],
    ),
    dirty = JSON.stringify(config) !== savedSignature,
    xLabel = fields.find((field) => field.key === config.x)?.label ?? tConnector('resultRowNumber');
  const drawable = data.series.some((series) =>
    series.data.some((point) => point && (config.type !== 'pie' || point.value > 0)),
  );
  function change(next: Partial<QueryChartConfig>) {
    setConfig((current) => ({ ...current, ...next }));
  }
  function saveSettings() {
    if (save(config)) {
      setSavedSignature(JSON.stringify(config));
      notify('success', tConnector('chartSettingsSaved'));
    } else notify('error', tConnector('chartSettingsCouldNotBeSavedTheCurrentSettingsRemain'));
  }
  return (
    <section className={styles.builder} aria-label={tConnector('queryChartBuilder')}>
      <ChartToolbar
        config={config}
        fields={fields}
        onChange={change}
        onSettings={() => setSettings(true)}
        onReset={() => {
          setConfig(defaultQueryChartConfig(fields));
          notify('info', translateConnector('defaultChartSettingsRestored'));
        }}
        onSave={saveSettings}
        onPreview={() => setPreview((value) => !value)}
        preview={preview}
        canPreview={!data.error && data.categories.length > 0}
        canSave={!data.error && dirty}
        persistent={persistent}
      />
      <div className={styles.visual}>
        {data.error ? (
          <div className={styles.empty} role="alert">
            <WarningCircle size={26} />
            <strong>{tConnector('adjustChartSettings')}</strong>
            <p>{data.error}</p>
            <button type="button" className="fouc-action" onClick={() => setSettings(true)}>
              {tConnector('viewSettings')}
            </button>
          </div>
        ) : !result.rows.length ? (
          <div className={styles.empty}>
            <ChartBar size={28} />
            <strong>{tConnector('noRecordsToPlot')}</strong>
            <p>{tConnector('theCurrentlyLoadedResultsAreEmpty')}</p>
          </div>
        ) : !drawable ? (
          <div className={styles.empty}>
            <ChartLine size={28} />
            <strong>{tConnector('noValuesCanBePlottedSafely')}</strong>
            <p>{tConnector('selectAnotherMetricOrUseCount')}</p>
            <button type="button" className="fouc-action" onClick={() => setSettings(true)}>
              {tConnector('adjustMetrics')}
            </button>
          </div>
        ) : (
          <QueryChartCanvas data={data} config={config} xLabel={xLabel} />
        )}
        {preview && !data.error && data.categories.length > 0 && <ChartDataPreview data={data} />}
      </div>
      {(data.partial || data.diagnostics.length > 0 || data.approximate > 0 || data.limited) && (
        <details className={styles.diagnostics}>
          <summary>
            <WarningCircle size={13} />
            <span>
              {data.partial ? tConnector('plotLoadedRowsOnly') : tConnector('chartDataInformation')}
            </span>
          </summary>
          <div>
            {data.partial && (
              <p>
                {tConnector('reflectsOnlyTheLoaded')}
                {result.rows.length.toLocaleString(locale)}
                {tConnector('rows')}
              </p>
            )}
            {data.limited && (
              <p>
                {tConnector('showing')}
                {data.categories.length.toLocaleString(locale)} /{' '}
                {data.totalCategories.toLocaleString(locale)}
                {tConnector('categoriesTheCategoryLimitHasBeenApplied')}
              </p>
            )}
            {data.diagnostics.map((diagnostic) => (
              <p key={diagnostic.code}>
                <strong>
                  {diagnostic.count.toLocaleString(locale)}
                  {tConnector('items')}
                </strong>{' '}
                · {diagnostic.message}
                {diagnostic.examples.length > 0 && <small>{diagnostic.examples.join('；')}</small>}
              </p>
            ))}
            {!!data.approximate && (
              <p>{tConnector('nonTerminatingAveragesAreMarkedHoverDetailsAndChartData')}</p>
            )}
          </div>
        </details>
      )}
      {settings && (
        <ChartSettingsDialog
          config={config}
          fields={fields}
          onChange={change}
          onClose={() => setSettings(false)}
        />
      )}
    </section>
  );
}
export function QueryChartBuilder({ result, scopeKey }: QueryChartBuilderProps) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const fields = useMemo(() => queryChartFields(result), [result]),
    store = useStoredChartConfig(scopeKey);
  if (store.saved === undefined)
    return (
      <div className={styles.loading} role="status">
        {tConnector('readingChartSettings')}
      </div>
    );
  return (
    <ChartBuilderContent
      key={scopeKey ?? '$local'}
      result={result}
      fields={fields}
      initial={store.saved ?? defaultQueryChartConfig(fields)}
      initialSaved={store.saved !== null}
      save={store.save}
      persistent={!!scopeKey}
    />
  );
}
