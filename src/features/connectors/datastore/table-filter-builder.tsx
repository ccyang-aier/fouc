'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './table-filter-builder.messages';
import { Eye, EyeSlash, Plus, X } from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RELATIONAL_FILTER_OPERATORS, type DatabaseColumnInfo } from '@fouc/shared';
import {
  filterLabels,
  needsFilterValue,
  newCondition,
  newGroup,
  type FilterDraft,
} from './table-filter-model';
import { QueryRuleActions, QueryRuleHandle } from './table-query-row-actions';
import { TableQuerySelect } from './table-query-select';
import { useQueryRuleReorder } from './use-query-rule-reorder';
import styles from './table-query.module.css';
function JoinToggle({
  join,
  disabled,
  label,
  onChange,
}: {
  join: 'and' | 'or';
  disabled: boolean;
  label: string;
  onChange: (join: 'and' | 'or') => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const next = join === 'and' ? 'or' : 'and';
  return (
    <button
      type="button"
      className={`fouc-action ${styles.joinToggle}`}
      aria-label={label}
      title={tConnector('switchTo', { p0: String(next.toUpperCase()) })}
      disabled={disabled}
      onClick={() => onChange(next)}
    >
      {join.toUpperCase()}
    </button>
  );
}
type FilterBuilderProps = {
  node: FilterDraft;
  columns: DatabaseColumnInfo[];
  disabled: boolean;
  onChange: (node: FilterDraft) => void;
  onRemove?: () => void;
  onOnly: (id: string) => void;
  depth?: number;
};
function FilterGroupBuilder({
  node,
  columns,
  disabled,
  onChange,
  onRemove,
  onOnly,
  depth = 0,
}: FilterBuilderProps & {
  node: Extract<
    FilterDraft,
    {
      kind: 'group';
    }
  >;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const {
    list: listRef,
    row: rowProps,
    handle: dragHandle,
  } = useQueryRuleReorder(node.children.length, disabled || !node.enabled, move);
  function move(index: number, target: number) {
    if (target < 0 || target >= node.children.length) return;
    const children = [...node.children];
    const [item] = children.splice(index, 1);
    children.splice(target, 0, item!);
    onChange({ ...node, children });
  }
  return (
    <section
      ref={listRef}
      data-query-rule-list
      className={depth ? styles.nestedGroup : styles.group}
      aria-label={depth ? tConnector('conditionGroup') : tConnector('filterCondition')}
    >
      {depth > 0 && (
        <header className={styles.groupHeader}>
          <span>{tConnector('groupBy')}</span>
          <JoinToggle
            join={node.join}
            label={tConnector('groupConditionRelationship')}
            disabled={disabled || !node.enabled}
            onChange={(join) => onChange({ ...node, join })}
          />
          <span className={styles.spacer} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="fouc-action"
                type="button"
                title={tConnector('addConditionToGroup')}
                aria-label={tConnector('addConditionToGroup')}
                disabled={disabled || !node.enabled}
              >
                <Plus size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className={styles.popoverMenu}
              data-table-query-menu=""
              density="compact"
              align="end"
            >
              <DropdownMenuItem
                disabled={disabled || !node.enabled}
                onSelect={() =>
                  onChange({ ...node, children: [...node.children, newCondition('')] })
                }
              >
                <Plus />
                {tConnector('addCondition')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={disabled || !node.enabled || depth >= 5}
                onSelect={() =>
                  onChange({ ...node, children: [...node.children, newGroup([newCondition('')])] })
                }
              >
                <Plus />
                {tConnector('addConditionGroup')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            className="fouc-action"
            type="button"
            title={node.enabled ? tConnector('disableGroup') : tConnector('enableGroup')}
            aria-label={node.enabled ? tConnector('disableGroup') : tConnector('enableGroup')}
            aria-pressed={!node.enabled}
            disabled={disabled}
            onClick={() => onChange({ ...node, enabled: !node.enabled })}
          >
            {node.enabled ? <Eye size={16} weight="bold" /> : <EyeSlash size={16} weight="bold" />}
          </button>
          <button
            className="fouc-action"
            data-variant="destructive"
            type="button"
            title={tConnector('deleteGroup')}
            aria-label={tConnector('deleteGroup')}
            disabled={disabled}
            onClick={onRemove}
          >
            <X size={16} />
          </button>
        </header>
      )}
      {node.children.map((child, index) => (
        <div key={child.id}>
          {index > 0 && (
            <div className={styles.join}>
              <JoinToggle
                join={node.join}
                label={tConnector('conditionRelationship', { p0: String(index) })}
                disabled={disabled || !node.enabled}
                onChange={(join) => onChange({ ...node, join })}
              />
            </div>
          )}
          <div {...rowProps(index)} className={styles.ruleWrap}>
            <QueryRuleHandle
              kind="filter"
              index={index}
              count={node.children.length}
              disabled={disabled || !node.enabled}
              onMove={(target) => move(index, target)}
              drag={dragHandle(index)}
            />
            <TableFilterBuilder
              node={child}
              columns={columns}
              disabled={disabled || !node.enabled}
              depth={depth + 1}
              onOnly={onOnly}
              onChange={(updated) =>
                onChange({
                  ...node,
                  children: node.children.map((item) => (item.id === child.id ? updated : item)),
                })
              }
              onRemove={() =>
                onChange({
                  ...node,
                  children: node.children.filter((item) => item.id !== child.id),
                })
              }
            />
          </div>
        </div>
      ))}
    </section>
  );
}
export function TableFilterBuilder(props: FilterBuilderProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const { node, columns, disabled, onChange, onRemove, onOnly } = props;
  if (node.kind === 'group') return <FilterGroupBuilder {...props} node={node} />;
  const list = node.operator === 'in' || node.operator === 'not-in';
  const range = node.operator === 'between' || node.operator === 'not-between';
  const fieldsDisabled = disabled || !node.enabled;
  return (
    <div className={styles.rule} data-enabled={node.enabled}>
      <div className={styles.ruleFields}>
        <TableQuerySelect
          label={tConnector('filterColumns')}
          placeholder={tConnector('field')}
          autoFocus
          disabled={fieldsDisabled}
          value={node.column}
          options={columns.map((column) => ({ value: column.name, label: column.name }))}
          onChange={(column) => onChange({ ...node, column })}
        />
        <TableQuerySelect
          label={tConnector('filterOperator')}
          disabled={fieldsDisabled}
          value={node.operator}
          options={RELATIONAL_FILTER_OPERATORS.map((operator) => ({
            value: operator,
            label: filterLabels(locale)[operator],
          }))}
          onChange={(operator) => onChange({ ...node, operator })}
        />
        {needsFilterValue(node.operator) ? (
          list ? (
            <input
              aria-label={tConnector('filterValueList')}
              disabled={fieldsDisabled}
              value={node.values}
              placeholder={tConnector('jsonArrayABNull')}
              onChange={(event) => onChange({ ...node, values: event.target.value })}
            />
          ) : (
            <input
              aria-label={tConnector('filterValue')}
              disabled={fieldsDisabled}
              value={node.value}
              placeholder={tConnector('value')}
              onChange={(event) => onChange({ ...node, value: event.target.value })}
            />
          )
        ) : (
          <span className={styles.noValue}>{tConnector('noValueRequired')}</span>
        )}
        {range && (
          <input
            aria-label={tConnector('rangeEndValue')}
            disabled={fieldsDisabled}
            value={node.endValue}
            placeholder={tConnector('rangeEnd')}
            onChange={(event) => onChange({ ...node, endValue: event.target.value })}
          />
        )}
      </div>
      <QueryRuleActions
        kind="filter"
        disabled={disabled}
        enabled={node.enabled}
        onOnly={() => onOnly(node.id)}
        onToggle={() => onChange({ ...node, enabled: !node.enabled })}
        onRemove={onRemove}
      />
    </div>
  );
}
