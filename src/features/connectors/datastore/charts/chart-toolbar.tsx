'use client';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './chart-toolbar.messages';
import {
  ArrowCounterClockwise,
  CaretDown,
  FloppyDisk,
  GearSix,
  Table,
} from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ChartField, QueryChartConfig, QueryChartType } from './model';
import styles from './query-chart.module.css';
const types = (
  locale?: Locale,
): {
  id: QueryChartType;
  label: string;
}[] => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    { id: 'bar', label: tConnector('barChart') },
    { id: 'line', label: tConnector('lineChart') },
    { id: 'pie', label: tConnector('pieChart') },
  ];
};
export function ChartToolbar({
  config,
  fields,
  onChange,
  onSettings,
  onReset,
  onSave,
  onPreview,
  preview,
  canPreview,
  canSave,
  persistent,
}: {
  config: QueryChartConfig;
  fields: readonly ChartField[];
  onChange: (change: Partial<QueryChartConfig>) => void;
  onSettings: () => void;
  onReset: () => void;
  onSave: () => void;
  onPreview: () => void;
  preview: boolean;
  canPreview: boolean;
  canSave: boolean;
  persistent: boolean;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const xLabel =
    fields.find((field) => field.key === config.x)?.label ??
    (config.x ? tConnector('fieldNoLongerExists') : tConnector('resultRowNumber'));
  const yLabel =
    config.aggregation === 'count'
      ? tConnector('rowCount')
      : config.ys
          .map(
            (key) =>
              fields.find((field) => field.key === key)?.label ?? tConnector('fieldNoLongerExists'),
          )
          .join('、') || tConnector('selectField');
  return (
    <header className={styles.toolbar}>
      <span className={styles.caption}>{tConnector('type')}</span>
      <div className={styles.types} role="group" aria-label={tConnector('chartType')}>
        {types(locale).map((item) => (
          <button
            type="button"
            key={item.id}
            className="fouc-action"
            data-active={config.type === item.id}
            aria-pressed={config.type === item.id}
            onClick={() => onChange({ type: item.id })}
          >
            {item.label}
          </button>
        ))}
        {(config.type === 'area' || config.type === 'scatter') && (
          <button
            type="button"
            className="fouc-action"
            data-active="true"
            aria-pressed
            onClick={onSettings}
          >
            {config.type === 'area' ? tConnector('areaChart') : tConnector('scatterPlot')}
          </button>
        )}
      </div>
      <span className={styles.divider} />
      <DropdownMenu>
        <DropdownMenuTrigger
          className={'fouc-action ' + styles.axis}
          aria-label={tConnector('chartXAxis')}
        >
          <span className={styles.caption}>X</span>
          <span className={styles.fieldName}>{xLabel}</span>
          <CaretDown size={13} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" density="compact">
          <DropdownMenuRadioGroup
            value={config.x ?? ''}
            onValueChange={(x) => onChange({ x: x || null })}
          >
            <DropdownMenuRadioItem value="">{tConnector('resultRowNumber')}</DropdownMenuRadioItem>
            {fields.map((field) => (
              <DropdownMenuRadioItem key={field.key} value={field.key}>
                {field.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className={styles.divider} />
      <DropdownMenu>
        <DropdownMenuTrigger
          className={'fouc-action ' + styles.axis}
          aria-label={tConnector('chartYAxis')}
          disabled={config.aggregation === 'count'}
        >
          <span className={styles.caption}>Y</span>
          <span className={styles.fieldName}>{yLabel}</span>
          <CaretDown size={13} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" density="compact">
          <DropdownMenuGroup>
            {fields.map((field) => (
              <DropdownMenuCheckboxItem
                key={field.key}
                checked={config.ys.includes(field.key)}
                disabled={
                  !field.numeric || (!config.ys.includes(field.key) && config.ys.length >= 6)
                }
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) =>
                  onChange({
                    ys: checked
                      ? [...config.ys, field.key]
                      : config.ys.filter((key) => key !== field.key),
                  })
                }
              >
                {field.label}
                {!field.numeric && (
                  <span className={styles.menuHint}>{tConnector('nonNumeric')}</span>
                )}
              </DropdownMenuCheckboxItem>
            ))}
            {config.ys
              .filter((key) => !fields.some((field) => field.key === key))
              .map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked
                  onCheckedChange={() =>
                    onChange({ ys: config.ys.filter((value) => value !== key) })
                  }
                >
                  {tConnector('fieldNoLongerExists329')}
                  {key.split('\u0000')[0]}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className={styles.divider} />
      <button
        type="button"
        className="fouc-action"
        aria-label={tConnector('showValues')}
        aria-pressed={config.showValues}
        onClick={() => onChange({ showValues: !config.showValues })}
      >
        {tConnector('showValues')}
      </button>
      <div className={styles.tools}>
        <DropdownMenu>
          <DropdownMenuTrigger className="fouc-action" aria-label={tConnector('moreChartSettings')}>
            <GearSix size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" density="compact">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={onSettings}>
                <GearSix size={16} />
                {tConnector('advancedSettings')}
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem
                checked={preview}
                disabled={!canPreview}
                onCheckedChange={onPreview}
              >
                <Table size={16} />
                {tConnector('chartData')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuItem disabled={!persistent || !canSave} onSelect={onSave}>
                <FloppyDisk size={16} />
                {tConnector('saveChartSettings')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onReset}>
                <ArrowCounterClockwise size={16} />
                {tConnector('restoreDefaults')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
