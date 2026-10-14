import { createUiMessages } from '../i18n/ui-message';
import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './table-filter-model.messages';
import type {
  DatabaseCell,
  DatabaseColumnInfo,
  RelationalFilter,
  RelationalFilterOperator,
} from '@fouc/shared';
const connectorUiMessages = createUiMessages(connectorMessages);
export const filterLabels = (locale?: Locale): Record<RelationalFilterOperator, string> => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    equals: tConnector('equals'),
    'not-equals': tConnector('notEqual'),
    'is-null': tConnector('isNull'),
    'is-not-null': tConnector('isNotNull'),
    'is-blank': tConnector('blankOrNull'),
    'is-not-blank': tConnector('notBlank'),
    like: tConnector('containsLike'),
    'not-like': tConnector('doesNotContainNotLike'),
    'begins-with': tConnector('startsWith'),
    'ends-with': tConnector('endsWith'),
    'less-than': tConnector('lessThan'),
    'less-than-or-equal': tConnector('lessThanOrEqual'),
    'greater-than': tConnector('greaterThan'),
    'greater-than-or-equal': tConnector('greaterThanOrEqual'),
    in: tConnector('inList'),
    'not-in': tConnector('notInList'),
    between: tConnector('withinRange'),
    'not-between': tConnector('outsideRange'),
  };
};
export type FilterDraft =
  | {
      id: string;
      enabled: boolean;
      kind: 'condition';
      column: string;
      operator: RelationalFilterOperator;
      value: string;
      values: string;
      endValue: string;
    }
  | {
      id: string;
      enabled: boolean;
      kind: 'group';
      join: 'and' | 'or';
      children: FilterDraft[];
    };
export const newCondition = (column: string): FilterDraft => ({
  id: crypto.randomUUID(),
  enabled: true,
  kind: 'condition',
  column,
  operator: 'equals',
  value: '',
  values: '[]',
  endValue: '',
});
export const newGroup = (
  children: FilterDraft[] = [],
): Extract<
  FilterDraft,
  {
    kind: 'group';
  }
> => ({
  id: crypto.randomUUID(),
  enabled: true,
  kind: 'group',
  join: 'and',
  children,
});
export const needsFilterValue = (operator: RelationalFilterOperator) =>
  !['is-null', 'is-not-null', 'is-blank', 'is-not-blank'].includes(operator);
const binaryType = /\b(bytea|blob|binary|varbinary)\b/i;
const textOperators = ['like', 'not-like', 'begins-with', 'ends-with'];
function displayValue(
  value: DatabaseCell | undefined,
  column: DatabaseColumnInfo | undefined,
  operator: RelationalFilterOperator,
): string {
  if (value === undefined) return '';
  if (column && /\bjsonb?\b/i.test(column.dataType) && !textOperators.includes(operator))
    return JSON.stringify(value);
  if (value === null) return '';
  if (typeof value === 'object') {
    if (
      column &&
      binaryType.test(column.dataType) &&
      !Array.isArray(value) &&
      value.type === 'binary'
    )
      return String(value.base64 ?? '');
    return JSON.stringify(value);
  }
  return String(value);
}
export function draftFilter(
  filter: RelationalFilter | null,
  columns: DatabaseColumnInfo[],
): Extract<
  FilterDraft,
  {
    kind: 'group';
  }
> {
  function draft(node: RelationalFilter): FilterDraft {
    if (node.kind === 'group') return { ...newGroup(node.children.map(draft)), join: node.join };
    const column = columns.find((column) => column.name === node.column);
    return {
      id: crypto.randomUUID(),
      enabled: true,
      kind: 'condition',
      column: node.column,
      operator:
        node.value === null && (node.operator === 'equals' || node.operator === 'not-equals')
          ? node.operator === 'equals'
            ? 'is-null'
            : 'is-not-null'
          : node.operator,
      value: displayValue(node.value, column, node.operator),
      values: JSON.stringify(node.values ?? []),
      endValue: displayValue(node.endValue, column, node.operator),
    };
  }
  if (!filter) return newGroup();
  const result = draft(filter);
  return result.kind === 'group' ? result : newGroup([result]);
}
function scalarValue(text: string, column: DatabaseColumnInfo): DatabaseCell {
  if (/\bjsonb?\b/i.test(column.dataType)) {
    try {
      return JSON.parse(text) as DatabaseCell;
    } catch {
      throw connectorUiMessages.error('requiresValidJson', { p0: String(column.name) });
    }
  }
  if (binaryType.test(column.dataType)) return { type: 'binary', base64: text };
  if (/\bbool(ean)?\b/i.test(column.dataType)) {
    if (text === 'true') return true;
    if (text === 'false') return false;
    throw connectorUiMessages.error('enterTrueOrFalseFor', { p0: String(column.name) });
  }
  // Preserve integer/decimal text; the driver binds it according to field type.
  return text;
}
export function buildFilter(
  root: FilterDraft,
  columns: DatabaseColumnInfo[],
  locale?: Locale,
): RelationalFilter | null {
  function build(node: FilterDraft, depth: number, locale?: Locale): RelationalFilter | null {
    if (!node.enabled) return null;
    if (depth > 6) throw connectorUiMessages.error('conditionGroupsSupportAtMostLevels');
    if (node.kind === 'group') {
      if (!node.children.length)
        throw connectorUiMessages.error('addAConditionToTheGroupOrRemoveTheEmpty');
      const children = node.children
        .map((child) => build(child, depth + 1, locale))
        .filter((child): child is RelationalFilter => child !== null);
      if (!children.length) return null;
      return {
        kind: 'group',
        join: node.join,
        children,
      };
    }
    const column = columns.find((column) => column.name === node.column);
    if (!column) throw connectorUiMessages.error('selectAValidColumn');
    const result: Extract<
      RelationalFilter,
      {
        kind: 'condition';
      }
    > = {
      kind: 'condition',
      column: node.column,
      operator: node.operator,
    };
    if (node.operator === 'in' || node.operator === 'not-in') {
      let values: unknown;
      try {
        values = JSON.parse(node.values);
      } catch {
        throw connectorUiMessages.error('theListForRequiresAJsonArray', {
          p0: String(column.name),
        });
      }
      if (!Array.isArray(values) || !values.length)
        throw connectorUiMessages.error('aListRequiresAtLeastOneValue');
      result.values = values as DatabaseCell[];
    } else if (needsFilterValue(node.operator)) {
      result.value = textOperators.includes(node.operator)
        ? node.value
        : scalarValue(node.value, column);
      if (node.operator === 'between' || node.operator === 'not-between')
        result.endValue = scalarValue(node.endValue, column);
    }
    return result;
  }
  return root.kind === 'group' && !root.children.length ? null : build(root, 0, locale);
}
export function isolateFilter(root: FilterDraft, id: string): FilterDraft {
  if (root.kind === 'condition') return { ...root, enabled: root.id === id };
  const children = root.children.map((child) => isolateFilter(child, id));
  return {
    ...root,
    enabled: root.id === id || children.some((child) => child.enabled),
    children: root.id === id ? root.children : children,
  };
}
