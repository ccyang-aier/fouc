import { createUiMessages } from '../../i18n/ui-message';
import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './column-filter-model.messages';
import type { DatabaseCell, RelationalFilter } from '@fouc/shared';
import { rawGridCellText } from './clipboard';
const connectorUiMessages = createUiMessages(connectorMessages);
export type GridColumnValueOption = {
  key: string;
  value: DatabaseCell;
  text: string;
  count: number;
};
export type GridColumnFilters = Readonly<Record<number, readonly string[]>>;
type GridRows = readonly (readonly DatabaseCell[])[];
/** Match raw typed values, with object property order irrelevant and array order intact. */
export function gridColumnValueKey(value: DatabaseCell): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `string:${JSON.stringify(value)}`;
  if (typeof value === 'number') return `number:${Object.is(value, -0) ? '-0' : String(value)}`;
  if (typeof value === 'boolean') return `boolean:${value}`;
  if (Array.isArray(value)) return `array:[${value.map(gridColumnValueKey).join(',')}]`;
  return `object:{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${gridColumnValueKey(value[key])}`)
    .join(',')}}`;
}
/** Counts only the loaded source rows, retaining the original value for database predicates. */
export function gridColumnValueOptions(
  rows: GridRows,
  columnIndex: number,
  locale?: Locale,
): GridColumnValueOption[] {
  const tConnector = createTranslator(connectorMessages, locale);
  const options = new Map<string, GridColumnValueOption>();
  for (const row of rows) {
    const value = row[columnIndex] ?? null;
    const key = gridColumnValueKey(value);
    const option = options.get(key);
    if (option) option.count++;
    else
      options.set(key, {
        key,
        value,
        text: value === '' ? tConnector('emptyString') : rawGridCellText(value),
        count: 1,
      });
  }
  return [...options.values()];
}
/** Keep source indexes so selections and edits still address their original loaded rows. */
export function filterGridSourceRows(rows: GridRows, filters: GridColumnFilters): number[] {
  const allowed = Object.entries(filters).map(
    ([column, keys]) => [Number(column), new Set(keys)] as const,
  );
  const indexes: number[] = [];
  for (let index = 0; index < rows.length; index++) {
    if (
      allowed.every(([column, keys]) => keys.has(gridColumnValueKey(rows[index][column] ?? null)))
    )
      indexes.push(index);
  }
  return indexes;
}
export function hasDatabaseColumnFilter(filter: RelationalFilter | null, column: string): boolean {
  if (!filter) return false;
  return filter.kind === 'condition'
    ? filter.column === column
    : filter.children.some((child) => hasDatabaseColumnFilter(child, column));
}
/** Removing a column removes its rules, without flattening the remaining AND/OR structure. */
export function removeDatabaseColumnFilter(
  filter: RelationalFilter | null,
  column: string,
): RelationalFilter | null {
  if (!filter) return null;
  if (filter.kind === 'condition') return filter.column === column ? null : filter;
  const children = filter.children
    .map((child) => removeDatabaseColumnFilter(child, column))
    .filter((child): child is RelationalFilter => child !== null);
  if (!children.length) return null;
  if (children.length === 1) return children[0];
  return children.every((child, index) => child === filter.children[index]) &&
    children.length === filter.children.length
    ? filter
    : { ...filter, children };
}
/** SQL NULL is a separate predicate; it must not be mistaken for text or an IN parameter. */
export function databaseColumnValueFilter(
  column: string,
  values: readonly DatabaseCell[],
): RelationalFilter {
  if (!values.length) throw connectorUiMessages.error('selectAtLeastOneValue');
  const distinct = [...new Map(values.map((value) => [gridColumnValueKey(value), value])).values()];
  const nonNull = distinct.filter((value): value is Exclude<DatabaseCell, null> => value !== null);
  if (nonNull.length > 200)
    throw connectorUiMessages.error('databaseValueFiltersSupportUpToNonNullValues');
  const nullFilter: RelationalFilter = { kind: 'condition', column, operator: 'is-null' };
  if (!nonNull.length) return nullFilter;
  const membership: RelationalFilter = {
    kind: 'condition',
    column,
    operator: 'in',
    values: nonNull,
  };
  return distinct.includes(null)
    ? { kind: 'group', join: 'or', children: [nullFilter, membership] }
    : membership;
}
