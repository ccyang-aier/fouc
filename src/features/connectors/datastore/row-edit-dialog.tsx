'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './row-edit-dialog.messages';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X, PencilSimple, Plus } from '@phosphor-icons/react';
import type { DatabaseCell, DatabaseColumnInfo, RelationalRowChange } from '@fouc/shared';
import styles from './table-editing.module.css';
import common from './relational.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
type Field = {
  mode: 'value' | 'null' | 'default';
  text: string;
};
function textValue(value: DatabaseCell): string {
  if (value === null) return '';
  if (typeof value === 'object')
    return !Array.isArray(value) && value.type === 'binary'
      ? String(value.base64)
      : JSON.stringify(value, null, 2);
  return String(value);
}
function fieldValue(
  field: Field,
  column: DatabaseColumnInfo,
  original: DatabaseCell | undefined,
): DatabaseCell {
  if (field.mode === 'null') return null;
  if (/\bjsonb?\b/i.test(column.dataType)) {
    try {
      return JSON.parse(field.text) as DatabaseCell;
    } catch {
      throw connectorUiMessages.error('invalidJsonFor', { p0: String(column.name) });
    }
  }
  if (
    /\b(bytea|blob|binary|varbinary)\b/i.test(column.dataType) ||
    (original &&
      typeof original === 'object' &&
      !Array.isArray(original) &&
      original.type === 'binary')
  )
    return { type: 'binary', base64: field.text };
  if (typeof original === 'boolean' || /\bbool(ean)?\b/i.test(column.dataType)) {
    if (field.text === 'true') return true;
    if (field.text === 'false') return false;
    throw connectorUiMessages.error('enterTrueOrFalseFor', { p0: String(column.name) });
  }
  if (
    typeof original === 'number' &&
    field.text.trim() !== '' &&
    Number.isFinite(Number(field.text))
  ) {
    const value = Number(field.text);
    if (!Number.isInteger(value) || Number.isSafeInteger(value)) return value;
  }
  return field.text;
}
export function RowEditDialog({
  columns,
  original,
  values,
  onClose,
  onStage,
}: {
  columns: DatabaseColumnInfo[];
  original?: DatabaseCell[];
  values?: Record<string, DatabaseCell>;
  onClose: () => void;
  onStage: (change: RelationalRowChange) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const dialog = useRef<HTMLDialogElement>(null);
  const [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const [fields, setFields] = useState<Field[]>(() =>
    columns.map((column, index) => {
      const cell =
        values && Object.hasOwn(values, column.name) ? values[column.name] : original?.[index];
      return {
        mode: cell === undefined ? 'default' : cell === null ? 'null' : 'value',
        text: textValue(cell ?? null),
      };
    }),
  );
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  function changeField(index: number, value: Partial<Field>) {
    setFields((current) =>
      current.map((field, position) => (position === index ? { ...field, ...value } : field)),
    );
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const changes: Record<string, DatabaseCell> = {};
      columns.forEach((column, index) => {
        const field = fields[index]!;
        if (/\b(?:generated|identity)\b/i.test(column.extra ?? '') || field.mode === 'default')
          return;
        if (
          original &&
          field.mode === (original[index] === null ? 'null' : 'value') &&
          field.text === textValue(original[index]!)
        )
          return;
        changes[column.name] = fieldValue(field, column, original?.[index]);
      });
      if (original && !Object.keys(changes).length)
        throw connectorUiMessages.error('noModifiedFields');
      onStage(
        original
          ? { kind: 'update', original, values: changes }
          : { kind: 'insert', values: changes },
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? uiFailure(reason)
          : connectorUiMessages.message('invalidFieldValue'),
      );
    }
  }
  return (
    <dialog
      ref={dialog}
      className={`${common.dialog} ${styles.rowDialog}`}
      aria-labelledby="row-edit-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form onSubmit={submit}>
        <header className={common.dialogHead}>
          <div>
            {original ? <PencilSimple size={18} /> : <Plus size={18} />}
            <h2 id="row-edit-title">
              {original ? tConnector('editRecord') : tConnector('addRecord')}
            </h2>
          </div>
          <button type="button" aria-label={tConnector('closeRecordEditor')} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className={styles.fields}>
          <p className={common.hint}>
            {tConnector('changesEnterThePendingListFirstTheyAreWrittenOnly')}
          </p>
          {columns.map((column, index) => {
            const field = fields[index]!;
            const generated = /\b(?:generated|identity)\b/i.test(column.extra ?? '');
            return (
              <div className={styles.field} key={column.name}>
                <label htmlFor={`row-field-${index}`}>
                  <strong>{column.name}</strong>
                  <span>
                    {column.isPrimaryKey && <b>PK</b>}
                    <small>{column.dataType}</small>
                  </span>
                </label>
                {generated ? (
                  <div className={styles.generated}>
                    {tConnector('generatedByTheDatabase')}
                    {original ? ` · ${textValue(original[index]!)}` : ''}
                  </div>
                ) : (
                  <>
                    <select
                      aria-label={tConnector('valueModeFor', { p0: String(column.name) })}
                      value={field.mode}
                      onChange={(event) =>
                        changeField(index, { mode: event.target.value as Field['mode'] })
                      }
                    >
                      <option value="value">{tConnector('value')}</option>
                      {column.isNullable && <option value="null">NULL</option>}
                      {!original && <option value="default">{tConnector('useDefaultOmit')}</option>}
                    </select>
                    <textarea
                      id={`row-field-${index}`}
                      aria-label={tConnector('fieldValueFor', { p0: String(column.name) })}
                      rows={/\bjsonb?\b/i.test(column.dataType) ? 3 : 1}
                      value={field.text}
                      disabled={field.mode !== 'value'}
                      placeholder={
                        /\b(bytea|blob|binary|varbinary)\b/i.test(column.dataType)
                          ? 'Base64'
                          : tConnector('emptyTextAndNullAreSavedSeparately')
                      }
                      onChange={(event) => changeField(index, { text: event.target.value })}
                    />
                  </>
                )}
              </div>
            );
          })}
          {error && (
            <p className={common.error} role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className={common.dialogFooter}>
          <button type="button" className={common.secondary} onClick={onClose}>
            {tConnector('cancel')}
          </button>
          <span />
          <button type="submit" className={common.primary}>
            {tConnector('addChanges')}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
