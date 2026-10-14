'use client';
import { translateFixed } from '../i18n/display';

import { useTranslation } from '@/lib/i18n';
import { messages } from './i18n/dashboard-document-fields';

import { Plus, X } from '@phosphor-icons/react';
import common from './dashboard-actions.module.css';
import styles from './dashboard-document-dialog.module.css';
import { invoiceTotal, money } from './dashboard-document-export';
import type {
  DashboardContract,
  DashboardForm,
  DashboardInvoice,
  DashboardProposal,
} from './dashboard-model';
type FieldProps<T> = { value: T; onChange: (value: T) => void };
export function InvoiceFields({ value, onChange }: FieldProps<DashboardInvoice>) {
  const { t, locale } = useTranslation(messages);
  const uiLabel = (value: string) => translateFixed(value, locale);

  const total = invoiceTotal(value.items);
  return (
    <>
      <div className={common.fieldGrid}>
        <label>
          {t('Client')}
          <input
            value={value.client}
            onChange={(event) => onChange({ ...value, client: event.target.value })}
            placeholder={t('Client or company')}
          />
        </label>
        <label>
          {t('Client email')}
          <input
            type="email"
            value={value.email}
            onChange={(event) => onChange({ ...value, email: event.target.value })}
            placeholder={t('client@example.com')}
          />
        </label>
      </div>
      <div className={common.fieldGrid}>
        <label>
          {t('Due date')}
          <input
            type="date"
            value={value.dueDate}
            onInput={(event) => onChange({ ...value, dueDate: event.currentTarget.value })}
          />
        </label>
        <label>
          {t('Currency')}
          <select
            value={value.currency}
            onChange={(event) =>
              onChange({
                ...value,
                currency: event.target.value as DashboardInvoice['currency'],
              })
            }
          >
            {['USD', 'EUR', 'CNY'].map((currency) => (
              <option value={currency} key={currency}>
                {uiLabel(currency)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className={styles.itemField}>
        <legend>{t('Line items')}</legend>
        <div className={styles.itemHeader}>
          <span>{t('Description')}</span>
          <span>{t('Qty')}</span>
          <span>{t('Rate')}</span>
          <span />
        </div>
        {value.items.map((item, index) => (
          <div key={item.id} className={styles.itemRow}>
            <input
              aria-label={t('Line {v0} description', { v0: index + 1 })}
              value={item.description}
              placeholder={t('Design services')}
              onChange={(event) =>
                onChange({
                  ...value,
                  items: value.items.map((current) =>
                    current.id === item.id
                      ? { ...current, description: event.target.value }
                      : current,
                  ),
                })
              }
            />
            <input
              aria-label={t('Line {v0} quantity', { v0: index + 1 })}
              type="number"
              min="0.01"
              step="0.01"
              value={item.quantity}
              onChange={(event) =>
                onChange({
                  ...value,
                  items: value.items.map((current) =>
                    current.id === item.id
                      ? { ...current, quantity: Number(event.target.value) }
                      : current,
                  ),
                })
              }
            />
            <input
              aria-label={t('Line {v0} rate', { v0: index + 1 })}
              type="number"
              min="0"
              step="0.01"
              value={item.rate}
              onChange={(event) =>
                onChange({
                  ...value,
                  items: value.items.map((current) =>
                    current.id === item.id
                      ? { ...current, rate: Number(event.target.value) }
                      : current,
                  ),
                })
              }
            />
            <button
              type="button"
              className={`${styles.removeButton} fouc-action`}
              data-variant="destructive"
              aria-label={t('Remove line {v0}', { v0: index + 1 })}
              disabled={value.items.length === 1}
              onClick={() =>
                onChange({
                  ...value,
                  items: value.items.filter((current) => current.id !== item.id),
                })
              }
            >
              <X size={13} />
            </button>
          </div>
        ))}
        <div className={styles.itemFooter}>
          <button
            type="button"
            className={`${styles.addButton} fouc-action`}
            onClick={() =>
              onChange({
                ...value,
                items: [
                  ...value.items,
                  {
                    id: crypto.randomUUID(),
                    description: '',
                    quantity: 1,
                    rate: 0,
                  },
                ],
              })
            }
          >
            <Plus size={13} />
            {t('Add item')}
          </button>
          <span>
            {t('Total')}
            <strong>{money(total, value.currency, locale)}</strong>
          </span>
        </div>
      </fieldset>
      <label>
        {t('Notes')}
        <textarea
          rows={3}
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
          placeholder={t('Payment instructions or additional notes')}
        />
      </label>
    </>
  );
}
export function ProposalFields({ value, onChange }: FieldProps<DashboardProposal>) {
  const { t } = useTranslation(messages);

  return (
    <>
      <label>
        {t('Client')}
        <input
          value={value.client}
          onChange={(event) => onChange({ ...value, client: event.target.value })}
          placeholder={t('Client or company')}
        />
      </label>
      <label>
        {t('Scope')}
        <textarea
          rows={5}
          value={value.scope}
          onChange={(event) => onChange({ ...value, scope: event.target.value })}
          placeholder={t('Deliverables, approach and timeline')}
        />
      </label>
      <div className={common.fieldGrid}>
        <label>
          {t('Budget (USD)')}
          <input
            type="number"
            min="0"
            step="0.01"
            value={value.budget}
            onChange={(event) => onChange({ ...value, budget: Number(event.target.value) })}
          />
        </label>
        <label>
          {t('Valid until')}
          <input
            type="date"
            value={value.validUntil}
            onInput={(event) => onChange({ ...value, validUntil: event.currentTarget.value })}
          />
        </label>
      </div>
    </>
  );
}
export function ContractFields({ value, onChange }: FieldProps<DashboardContract>) {
  const { t } = useTranslation(messages);

  return (
    <>
      <div className={common.fieldGrid}>
        <label>
          {t('Client')}
          <input
            value={value.client}
            onChange={(event) => onChange({ ...value, client: event.target.value })}
          />
        </label>
        <label>
          {t('Provider')}
          <input
            value={value.provider}
            onChange={(event) => onChange({ ...value, provider: event.target.value })}
          />
        </label>
      </div>
      <div className={common.fieldGrid}>
        <label>
          {t('Start date')}
          <input
            type="date"
            value={value.startDate}
            onInput={(event) => onChange({ ...value, startDate: event.currentTarget.value })}
          />
        </label>
        <label>
          {t('End date')}
          <input
            type="date"
            value={value.endDate}
            onInput={(event) => onChange({ ...value, endDate: event.currentTarget.value })}
          />
        </label>
      </div>
      <label>
        {t('Terms')}
        <textarea
          rows={7}
          value={value.terms}
          onChange={(event) => onChange({ ...value, terms: event.target.value })}
          placeholder={t('Scope, responsibilities, payment and cancellation terms')}
        />
      </label>
    </>
  );
}
export function FormFields({ value, onChange }: FieldProps<DashboardForm>) {
  const { t } = useTranslation(messages);

  const locked = value.responses.length > 0;
  return (
    <>
      <label>
        {t('Description')}
        <textarea
          rows={3}
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
          placeholder={t('Tell people what this form is for')}
        />
      </label>
      <fieldset className={styles.itemField}>
        <legend>{t('Questions')}</legend>
        {value.questions.map((question, index) => (
          <div key={index} className={styles.questionRow}>
            <label>
              {t('Question')}
              {index + 1}
              <input
                value={question}
                disabled={locked}
                onChange={(event) =>
                  onChange({
                    ...value,
                    questions: value.questions.map((current, position) =>
                      position === index ? event.target.value : current,
                    ),
                  })
                }
                placeholder={t('What would you like to know?')}
              />
            </label>
            <button
              type="button"
              className={`${styles.removeButton} fouc-action`}
              data-variant="destructive"
              aria-label={t('Remove question {v0}', { v0: index + 1 })}
              disabled={locked || value.questions.length === 1}
              onClick={() =>
                onChange({
                  ...value,
                  questions: value.questions.filter((_, position) => position !== index),
                })
              }
            >
              <X size={13} />
            </button>
          </div>
        ))}
        {locked ? (
          <p className={styles.hint}>{t('Questions are locked after the first response.')}</p>
        ) : (
          <button
            type="button"
            className={`${styles.addButton} fouc-action`}
            onClick={() => onChange({ ...value, questions: [...value.questions, ''] })}
          >
            <Plus size={13} />
            {t('Add question')}
          </button>
        )}
      </fieldset>
    </>
  );
}
