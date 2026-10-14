'use client';
import { useTranslation } from '@/lib/i18n';
import {
  MONGO_TABULAR_TYPES,
  validateMongoTabularFields,
  type MongoTabularField,
  type MongoTabularOptions,
  type MongoTabularSource,
  type MongoTabularType,
} from '@fouc/shared/mongo-tabular';
import { createUiMessages, uiText } from '../../i18n/ui-message';
import { messages as unitMessages } from './../i18n/document-transfer-tabular-config';
import styles from './transfer.module.css';
const { message: uiMessage } = createUiMessages(unitMessages);

export const TABULAR_TYPE_LABELS = {
  string: 'String · 原文',
  objectId: 'ObjectId',
  int32: 'Int32',
  int64: 'Int64 · 精确整数',
  decimal128: 'Decimal128 · 精确小数',
  double: 'Double · 浮点',
  date: 'Date · 明确时区',
  boolean: 'Boolean',
  ejson: 'Canonical EJSON',
} as const satisfies Record<MongoTabularType, keyof typeof unitMessages>;

export function MongoTabularConfiguration({
  options,
  parsed,
  fields,
  disabled,
  idPolicy,
  onOptions,
  onFields,
}: {
  options: MongoTabularOptions;
  parsed: MongoTabularSource | null;
  fields: MongoTabularField[];
  disabled: boolean;
  idPolicy: 'generate' | 'preserve';
  onOptions: (options: MongoTabularOptions) => void;
  onFields: (fields: MongoTabularField[]) => void;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  let mappingError = '';
  if (parsed && !parsed.errors.length) {
    try {
      validateMongoTabularFields(fields, parsed.columns.length);
    } catch (error) {
      mappingError = uiText(error, locale);
    }
  }
  function change(index: number, patch: Partial<MongoTabularField>) {
    onFields(fields.map((field) => (field.sourceIndex === index ? { ...field, ...patch } : field)));
  }
  return (
    <section className={styles.tabularConfig} aria-label={tu('CSV 与 TSV 字段配置')}>
      <div className={styles.options}>
        <label>
          <span>{tu('分隔符')}</span>
          <select
            aria-label={tu('表格分隔符')}
            disabled={disabled}
            value={options.delimiter}
            onChange={(event) => onOptions({ ...options, delimiter: event.target.value })}
          >
            <option value=",">{tu('逗号 ,')}</option>
            <option value={'\t'}>{tu('Tab 制表符')}</option>
            <option value=";">{tu('分号 ;')}</option>
            <option value="|">{tu('竖线 |')}</option>
          </select>
        </label>
        <label>
          <span>{tu('NULL 标记 · 可留空')}</span>
          <input
            aria-label={tu('表格 NULL 标记')}
            disabled={disabled}
            value={options.nullToken}
            maxLength={64}
            placeholder={tu('例如 \\N')}
            onChange={(event) => onOptions({ ...options, nullToken: event.target.value })}
          />
          <small>{tu('只匹配未加引号的原文；加引号的标记仍为字符串。')}</small>
        </label>
      </div>
      <div className={styles.parseFlags}>
        <label>
          <input
            type="checkbox"
            aria-label={tu('首行包含字段名')}
            disabled={disabled}
            checked={options.header}
            onChange={(event) => onOptions({ ...options, header: event.target.checked })}
          />
          {tu('首行包含字段名')}
        </label>
        <label>
          <input
            type="checkbox"
            disabled={disabled}
            checked={options.trimValues}
            onChange={(event) => onOptions({ ...options, trimValues: event.target.checked })}
          />
          {tu('去除值两端空白')}
        </label>
        <label>
          <input
            type="checkbox"
            disabled={disabled}
            checked={options.emptyAsNull}
            onChange={(event) => onOptions({ ...options, emptyAsNull: event.target.checked })}
          />
          {tu('空字符串转 NULL')}
        </label>
        <label>
          <input
            type="checkbox"
            aria-label={tu('建议识别 24 位十六进制 ObjectId')}
            disabled={disabled}
            checked={options.recognizeObjectIdHex}
            onChange={(event) =>
              onOptions({ ...options, recognizeObjectIdHex: event.target.checked })
            }
          />
          {tu('建议识别 24 位 ObjectId')}
        </label>
      </div>
      {parsed?.errors.map((error, index) => (
        <p className={styles.error} role="alert" key={index}>
          {tu('源物理行')} {error.line}
          {tu('，列')} {uiText(error.column, locale)}：{uiText(error, locale)}
        </p>
      ))}
      {parsed && !parsed.errors.length && (
        <>
          <div className={styles.mappingHeading}>
            <div>
              <strong>
                {parsed.rows.length} {tu('行 ·')} {parsed.columns.length} {tu('列')}
              </strong>
              <small>
                {tu('前')} {parsed.sampledRows} {tu('行给出建议，预览会验证全部数据。')}
              </small>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onFields(
                  fields.map((field) => ({
                    ...field,
                    type: parsed.suggestions[field.sourceIndex].type,
                  })),
                )
              }
            >
              {tu('应用采样类型建议')}
            </button>
          </div>
          <div className={styles.mappingGrid} aria-label={tu('源字段到 BSON 映射')}>
            <div className={styles.mappingGridHeader}>
              <span>{tu('源字段 / 原文样本')}</span>
              <span>{tu('JSON Pointer 目标')}</span>
              <span>{tu('写入 BSON 类型')}</span>
              <span>{tu('映射')}</span>
            </div>
            {fields.map((field) => {
              const suggestion = parsed.suggestions[field.sourceIndex];
              return (
                <div key={field.sourceIndex} className={styles.mappingRow}>
                  <div className={styles.sourceColumn}>
                    <strong>
                      {field.sourceIndex + 1}. {parsed.columns[field.sourceIndex]}
                    </strong>
                    <small title={suggestion.samples.join('\n')}>
                      {suggestion.samples
                        .map((value) => (value.length > 80 ? value.slice(0, 80) + '…' : value))
                        .join(' · ') || tu('NULL / 缺失')}
                    </small>
                    <small>
                      {tu('建议')} {uiText(uiMessage(TABULAR_TYPE_LABELS[suggestion.type]), locale)}
                      {suggestion.objectIdCandidate && !options.recognizeObjectIdHex
                        ? tu(' · ObjectId 候选')
                        : ''}
                    </small>
                  </div>
                  <label>
                    <span className={styles.mobileLabel}>{tu('目标路径')}</span>
                    <input
                      aria-label={tu('列 {v0} 目标路径', { v0: String(field.sourceIndex + 1) })}
                      disabled={disabled || field.target === null}
                      value={field.target ?? ''}
                      placeholder="/items/0/name"
                      spellCheck={false}
                      onChange={(event) =>
                        change(field.sourceIndex, { target: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span className={styles.mobileLabel}>{tu('BSON 类型')}</span>
                    <select
                      aria-label={tu('列 {v0} BSON 类型', { v0: String(field.sourceIndex + 1) })}
                      disabled={disabled || field.target === null}
                      value={field.type}
                      onChange={(event) =>
                        change(field.sourceIndex, { type: event.target.value as MongoTabularType })
                      }
                    >
                      {MONGO_TABULAR_TYPES.map((type) => (
                        <option value={type} key={type}>
                          {uiText(uiMessage(TABULAR_TYPE_LABELS[type]), locale)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.mapToggle}>
                    <input
                      type="checkbox"
                      aria-label={tu('映射列 {v0}', { v0: String(field.sourceIndex + 1) })}
                      disabled={
                        disabled ||
                        (idPolicy === 'generate' && parsed.columns[field.sourceIndex] === '_id')
                      }
                      checked={field.target !== null}
                      onChange={(event) =>
                        change(field.sourceIndex, {
                          target: event.target.checked
                            ? '/' +
                              parsed.columns[field.sourceIndex]
                                .replace(/~/g, '~0')
                                .replace(/\//g, '~1')
                            : null,
                        })
                      }
                    />
                    {field.target === null ? tu('跳过') : tu('映射')}
                  </label>
                </div>
              );
            })}
          </div>
          {mappingError && (
            <p className={styles.error} role="alert">
              {tu('映射无效：')}
              {uiText(mappingError, locale)}
            </p>
          )}
          <p className={styles.notice}>
            {tu(
              '标题按列序号识别，空名或重名会生成唯一列名。目标字段默认使用完整标题字面值；嵌套请明确填写 /address/city 或 /items/0/name。数组索引须从 0 连续开始，最大 255。短行缺失字段省略，显式 NULL 写入 null。',
            )}
          </p>
          {fields.some((field) => field.target !== null && field.type === 'double') && (
            <p className={styles.notice}>
              {tu(
                'Double 使用 IEEE 754 浮点，可能丢失精度。大整数请选 Int64；精确小数请选 Decimal128，二者保留源数字原文。',
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function MongoTabularMappingReview({
  fields,
  parsed,
}: {
  fields: MongoTabularField[];
  parsed: MongoTabularSource;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  return (
    <details className={styles.mappingReview} open>
      <summary>
        {tu('已冻结字段映射 ·')} {fields.filter((field) => field.target !== null).length}{' '}
        {tu('列 · 采样建议已明确确认')}
      </summary>
      <div>
        {fields
          .filter((field) => field.target !== null)
          .map((field) => (
            <p key={field.sourceIndex}>
              <span>{parsed.columns[field.sourceIndex]}</span>
              <code>→ {field.target}</code>
              <small>{uiText(uiMessage(TABULAR_TYPE_LABELS[field.type]), locale)}</small>
            </p>
          ))}
      </div>
    </details>
  );
}
