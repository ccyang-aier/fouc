import { createUiMessages } from '../i18n/ui-message';
import { messages as connectorMessages } from './table-sort-model.messages';
import type { DatabaseColumnInfo, RelationalSort } from '@fouc/shared';
const connectorUiMessages = createUiMessages(connectorMessages);
export type SortDraft = RelationalSort & {
  id: string;
  enabled: boolean;
};
export const newSort = (column = ''): SortDraft => ({
  id: crypto.randomUUID(),
  enabled: true,
  column,
  direction: 'asc',
  nulls: 'last',
});
export const draftSort = (sort: RelationalSort[]): SortDraft[] =>
  sort.map((item) => ({ ...item, id: crypto.randomUUID(), enabled: true }));
export function buildSort(sort: SortDraft[], columns: DatabaseColumnInfo[]): RelationalSort[] {
  const enabled = sort.filter((item) => item.enabled);
  if (enabled.length > 8) throw connectorUiMessages.error('addAtMostSortColumns');
  const selected = new Set<string>();
  return enabled.map(({ column, direction, nulls }) => {
    if (!columns.some((item) => item.name === column))
      throw connectorUiMessages.error('selectAValidSortColumn');
    if (selected.has(column))
      throw connectorUiMessages.error('isAlreadyUsedForSorting', { p0: String(column) });
    selected.add(column);
    return { column, direction, nulls };
  });
}
