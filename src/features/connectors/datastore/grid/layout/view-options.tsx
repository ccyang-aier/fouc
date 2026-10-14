'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './view-options.messages';
import { useId, useRef, useState, type ReactNode } from 'react';
import {
  ArrowsHorizontal,
  CheckSquare,
  Columns,
  Copy,
  Hash,
  MagnifyingGlass,
  Minus,
  Palette,
  Plus,
  Rows,
  SlidersHorizontal,
  TextAa,
  TextAlignRight,
  Wrench,
} from '@phosphor-icons/react';
import type { DatabaseQueryResult } from '@fouc/shared';
import { TableQueryPopover } from '../../table-query-popover';
import { TableQuerySelect } from '../../table-query-select';
import { allNullGridColumns, type GridLayout } from './model';
import styles from './workbench-controls.module.css';
function Segments<Value extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: Value;
  choices: readonly {
    value: Value;
    label: string;
  }[];
  onChange: (value: Value) => void;
}) {
  return (
    <div className={styles.segments} role="group" aria-label={label}>
      {choices.map((choice) => (
        <button
          type="button"
          className="fouc-action"
          key={choice.value}
          aria-pressed={choice.value === value}
          onClick={() => onChange(choice.value)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}
function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className={styles.optionRow}>
      <span>
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}
export function GridViewOptions({
  result,
  layout,
  onChange,
}: {
  result: DatabaseQueryResult;
  layout: GridLayout;
  onChange: (layout: GridLayout) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [open, setOpen] = useState(false),
    [copySettings, setCopySettings] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null),
    id = useId();
  function update<Key extends keyof GridLayout>(key: Key, value: GridLayout[Key]) {
    onChange({ ...layout, [key]: value });
  }
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="fouc-action"
        aria-label={tConnector('viewOptions')}
        title={tConnector('viewOptions')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Wrench size={16} />
      </button>
      <TableQueryPopover
        id={id}
        label={tConnector('viewOptions')}
        open={open}
        anchor={anchor}
        onClose={() => setOpen(false)}
        width={336}
        className={styles.popover}
      >
        <header className={styles.head}>
          <strong>{tConnector('viewOptions')}</strong>
        </header>
        <div className={styles.options}>
          <Row icon={<Columns size={16} />} label={tConnector('columnWidth')}>
            <Segments
              label={tConnector('columnWidth')}
              value={layout.density}
              choices={[
                { value: 'compact', label: tConnector('compact') },
                { value: 'standard', label: tConnector('standard') },
                { value: 'comfortable', label: tConnector('comfortable') },
              ]}
              onChange={(value) => onChange({ ...layout, density: value, widths: {} })}
            />
          </Row>
          <Row icon={<ArrowsHorizontal size={16} />} label={tConnector('columnWidthLayout')}>
            <Segments
              label={tConnector('columnWidthLayout')}
              value={layout.widthMode}
              choices={[
                { value: 'fill', label: tConnector('fillAvailableWidth') },
                { value: 'content', label: tConnector('fitToContent') },
              ]}
              onChange={(value) => update('widthMode', value)}
            />
          </Row>
          <Row icon={<TextAa size={16} />} label={tConnector('tableFont')}>
            <TableQuerySelect
              label={tConnector('tableFont')}
              value={layout.font}
              disabled={false}
              options={[
                { value: 'sans', label: tConnector('interfaceFont') },
                { value: 'mono', label: tConnector('monospaceFont') },
              ]}
              onChange={(value) => update('font', value)}
            />
          </Row>
          <Row icon={<TextAa size={16} />} label={tConnector('tableFontSize')}>
            <div className={styles.stepper}>
              <button
                type="button"
                className="fouc-action"
                aria-label={tConnector('decreaseTableFontSize')}
                disabled={layout.fontSize <= 12}
                onClick={() => update('fontSize', layout.fontSize - 1)}
              >
                <Minus size={15} />
              </button>
              <strong>{layout.fontSize}</strong>
              <button
                type="button"
                className="fouc-action"
                aria-label={tConnector('increaseTableFontSize')}
                disabled={layout.fontSize >= 16}
                onClick={() => update('fontSize', layout.fontSize + 1)}
              >
                <Plus size={15} />
              </button>
            </div>
          </Row>
          <Row icon={<MagnifyingGlass size={16} />} label={tConnector('searchMode')}>
            <Segments
              label={tConnector('searchMode')}
              value={layout.searchMode}
              choices={[
                { value: 'filter', label: tConnector('filter') },
                { value: 'highlight', label: tConnector('highlight') },
              ]}
              onChange={(value) => update('searchMode', value)}
            />
          </Row>
          <Row icon={<Hash size={16} />} label={tConnector('rowNumberDisplay')}>
            <Segments
              label={tConnector('rowNumberDisplay')}
              value={layout.rowNumberMode}
              choices={[
                { value: 'view', label: tConnector('viewRowNumber') },
                { value: 'source', label: tConnector('originalRowNumber') },
              ]}
              onChange={(value) => update('rowNumberMode', value)}
            />
          </Row>
          <Row icon={<Rows size={16} />} label={tConnector('multiRowTranspose')}>
            <Segments
              label={tConnector('multiRowTranspose')}
              value={layout.transposeMode}
              choices={[
                { value: 'current', label: tConnector('currentRow') },
                { value: 'multiple', label: tConnector('multipleRows') },
              ]}
              onChange={(value) => update('transposeMode', value)}
            />
          </Row>
          <Row icon={<TextAlignRight size={16} />} label={tConnector('numericColumnAlignment')}>
            <Segments
              label={tConnector('numericColumnAlignment')}
              value={layout.numericAlign}
              choices={[
                { value: 'left', label: tConnector('leftAligned') },
                { value: 'right', label: tConnector('rightAligned') },
              ]}
              onChange={(value) => update('numericAlign', value)}
            />
          </Row>
          <Row icon={<CheckSquare size={16} />} label={tConnector('booleanDisplay')}>
            <Segments
              label={tConnector('booleanDisplay')}
              value={layout.booleanMode}
              choices={[
                { value: 'text', label: tConnector('text') },
                { value: 'checkbox', label: tConnector('checkbox') },
              ]}
              onChange={(value) => update('booleanMode', value)}
            />
          </Row>
          <Row icon={<Palette size={16} />} label={tConnector('colorByDataType')}>
            <button
              type="button"
              className={styles.switch}
              role="switch"
              aria-label={tConnector('colorByDataType')}
              aria-checked={layout.typeColors}
              onClick={() => update('typeColors', !layout.typeColors)}
            />
          </Row>
          <Row icon={<MagnifyingGlass size={16} />} label={tConnector('hideNullColumns')}>
            <button
              type="button"
              className={styles.switch}
              role="switch"
              aria-label={tConnector('hideNullColumns')}
              aria-checked={layout.hideNullColumns}
              disabled={!layout.hideNullColumns && !allNullGridColumns(result).length}
              onClick={() => update('hideNullColumns', !layout.hideNullColumns)}
            />
          </Row>
          <Row icon={<Copy size={16} />} label={tConnector('defaultCopyFormat')}>
            <div className={styles.copyOptions}>
              <TableQuerySelect
                label={tConnector('defaultCopyFormat')}
                value={layout.copyMode}
                disabled={false}
                options={[
                  { value: 'smart', label: tConnector('smartCopy') },
                  { value: 'tsv', label: 'TSV' },
                  { value: 'csv', label: 'CSV' },
                  { value: 'json', label: 'JSON' },
                ]}
                onChange={(value) => update('copyMode', value)}
              />
              <button
                type="button"
                className="fouc-action"
                aria-label={tConnector('copyOptions')}
                aria-expanded={copySettings}
                onClick={() => setCopySettings((value) => !value)}
              >
                <SlidersHorizontal size={16} />
              </button>
            </div>
          </Row>
          {copySettings && (
            <label className={styles.copyHeaders}>
              <input
                type="checkbox"
                checked={layout.copyHeaders}
                disabled={layout.copyMode === 'json'}
                title={
                  layout.copyMode === 'json' ? tConnector('jsonAlwaysRetainsFieldNames') : undefined
                }
                onChange={(event) => update('copyHeaders', event.target.checked)}
              />
              {tConnector('includeColumnNamesWhenCopying')}
            </label>
          )}
        </div>
      </TableQueryPopover>
    </>
  );
}
