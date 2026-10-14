import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './column-form.messages';
import {
  structureTypeOptions,
  type StructureColumn,
  type StructureDefault,
} from '@fouc/shared/relational-structure-edit';
import type { RelationalProvider } from '@fouc/shared';
import styles from './structure-edit.module.css';
export function StructureColumnForm({
  value,
  provider,
  onChange,
}: {
  value: StructureColumn;
  provider: RelationalProvider;
  onChange: (value: StructureColumn) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const patch = (values: Partial<StructureColumn>) => onChange({ ...value, ...values });
  const changeDefault = (kind: StructureDefault['kind']) =>
    patch({
      default:
        kind === 'none' || kind === 'null'
          ? { kind }
          : kind === 'boolean'
            ? { kind, value: false }
            : { kind, value: 'value' in value.default ? String(value.default.value) : '' },
    });
  return (
    <div className={styles.form}>
      <label>
        {tConnector('columnName')}
        <input
          aria-label={tConnector('editColumnName')}
          value={value.name}
          maxLength={256}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder={tConnector('forExampleDisplayName')}
        />
      </label>
      <label>
        {tConnector('nativeType')}
        <input
          aria-label={tConnector('editColumnType')}
          list={`structure-types-${provider}`}
          value={value.dataType}
          maxLength={2048}
          onChange={(event) => patch({ dataType: event.target.value })}
          placeholder="VARCHAR(255)"
        />
        <datalist id={`structure-types-${provider}`}>
          {structureTypeOptions[provider].map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={value.nullable}
          aria-label={tConnector('columnAllowsNull')}
          onChange={(event) => patch({ nullable: event.target.checked })}
        />
        {tConnector('allowsNull')}
        <span>{tConnector('nonNullColumnsRequireValidationOfExistingData')}</span>
      </label>
      <label>
        {tConnector('defaultValueType')}
        <select
          aria-label={tConnector('columnDefaultValueType')}
          value={value.default.kind}
          disabled={Boolean(value.generated || value.identity)}
          onChange={(event) => changeDefault(event.target.value as StructureDefault['kind'])}
        >
          <option value="none">{tConnector('noDefault')}</option>
          <option value="text">{tConnector('textLiteral')}</option>
          <option value="number">{tConnector('numericLiteral')}</option>
          <option value="boolean">{tConnector('boolean')}</option>
          <option value="null">NULL</option>
          <option value="expression">{tConnector('nativeScalarExpression')}</option>
        </select>
      </label>
      {value.default.kind === 'boolean' && (
        <label>
          {tConnector('defaultBooleanValue')}
          <select
            value={String(value.default.value)}
            onChange={(event) =>
              patch({ default: { kind: 'boolean', value: event.target.value === 'true' } })
            }
          >
            <option value="false">FALSE</option>
            <option value="true">TRUE</option>
          </select>
        </label>
      )}
      {['text', 'number', 'expression'].includes(value.default.kind) &&
        'value' in value.default && (
          <label className={styles.wide}>
            {tConnector('defaultValue')}
            <input
              aria-label={tConnector('columnDefaultValue')}
              value={String(value.default.value)}
              onChange={(event) =>
                patch({
                  default: {
                    kind: value.default.kind as 'text' | 'number' | 'expression',
                    value: event.target.value,
                  },
                })
              }
              placeholder={
                value.default.kind === 'text'
                  ? tConnector('enterTextDirectlyWithoutQuotes')
                  : value.default.kind === 'number'
                    ? tConnector('preserveOriginalNumericPrecision')
                    : tConnector('forExampleCurrentTimestamp')
              }
            />
          </label>
        )}
      <label>
        {tConnector('generatedAutoIncrement')}
        <select
          aria-label={tConnector('columnGenerationMode')}
          value={value.generated ? 'generated' : (value.identity?.kind ?? 'none')}
          onChange={(event) => {
            const kind = event.target.value;
            patch(
              kind === 'none'
                ? { generated: null, identity: null }
                : kind === 'generated'
                  ? {
                      generated: { expression: '', storage: 'stored' },
                      identity: null,
                      default: { kind: 'none' },
                    }
                  : {
                      generated: null,
                      identity: { kind: kind as 'auto-increment' | 'always' | 'by-default' },
                      nullable: false,
                      default: { kind: 'none' },
                    },
            );
          }}
        >
          <option value="none">{tConnector('regularColumn')}</option>
          <option value="generated">{tConnector('generatedColumn')}</option>
          {provider === 'mysql' && <option value="auto-increment">AUTO_INCREMENT</option>}
          {provider === 'postgres' && (
            <>
              <option value="always">IDENTITY ALWAYS</option>
              <option value="by-default">IDENTITY BY DEFAULT</option>
            </>
          )}
        </select>
      </label>
      {value.generated && (
        <>
          <label>
            {tConnector('generatedColumnStorage')}
            <select
              value={value.generated.storage}
              onChange={(event) =>
                patch({
                  generated: {
                    ...value.generated!,
                    storage: event.target.value as 'stored' | 'virtual',
                  },
                })
              }
            >
              <option value="stored">STORED</option>
              {provider !== 'postgres' && <option value="virtual">VIRTUAL</option>}
            </select>
          </label>
          <label className={styles.wide}>
            {tConnector('generatedExpression')}
            <textarea
              aria-label={tConnector('columnGenerationExpression')}
              value={value.generated.expression}
              rows={3}
              maxLength={8192}
              onChange={(event) =>
                patch({ generated: { ...value.generated!, expression: event.target.value } })
              }
              placeholder={tConnector('forExampleUpperDisplayName')}
            />
          </label>
        </>
      )}
      {value.identity && value.identity.kind !== 'auto-increment' && (
        <>
          <label>
            {tConnector('identityStartValue')}
            <input
              value={value.identity.start ?? ''}
              inputMode="numeric"
              placeholder={tConnector('databaseDefault')}
              onChange={(event) =>
                patch({
                  identity: {
                    ...(value.identity as Exclude<
                      NonNullable<StructureColumn['identity']>,
                      {
                        kind: 'auto-increment';
                      }
                    >),
                    start: event.target.value || undefined,
                  },
                })
              }
            />
          </label>
          <label>
            {tConnector('identityIncrement')}
            <input
              value={value.identity.increment ?? ''}
              inputMode="numeric"
              placeholder={tConnector('databaseDefault')}
              onChange={(event) =>
                patch({
                  identity: {
                    ...(value.identity as Exclude<
                      NonNullable<StructureColumn['identity']>,
                      {
                        kind: 'auto-increment';
                      }
                    >),
                    increment: event.target.value || undefined,
                  },
                })
              }
            />
          </label>
        </>
      )}
      <label className={styles.wide}>
        {tConnector('columnComment')}
        <textarea
          aria-label={tConnector('columnComment')}
          value={value.comment}
          rows={2}
          maxLength={65536}
          disabled={provider === 'sqlite'}
          onChange={(event) => patch({ comment: event.target.value })}
          placeholder={
            provider === 'sqlite'
              ? tConnector('sqliteHasNoNativeColumnComments')
              : tConnector('describeTheColumnOptional')
          }
        />
      </label>
      <p className={styles.hint}>
        {tConnector('typesAreValidatedAgainstTheNativeAllowlistExpressionsAcceptOnly')}
      </p>
    </div>
  );
}
