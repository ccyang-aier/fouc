'use client';
import { translateFixed } from '../i18n/display';

import { formatNumber, useTranslation } from '@/lib/i18n';
import { fixtureArrayField, fixtureField } from '../i18n/display';
import { messages } from './i18n/dashboard-document-preview';

import { useState } from 'react';
import common from './dashboard-actions.module.css';
import styles from './dashboard-document-dialog.module.css';
import { documentDate, documentTypes, invoiceTotal, money } from './dashboard-document-export';
import type { DashboardDocument, DashboardForm } from './dashboard-model';
import { DashboardButton, ReferenceIcon } from './dashboard-ui';
export function DocumentPreview({ value }: { value: DashboardDocument }) {
  const { t, locale } = useTranslation(messages);

  return (
    <div className={styles.preview}>
      <div className={styles.previewHeading}>
        <ReferenceIcon name={value.kind} size={30} />
        <span>{translateFixed(documentTypes[value.kind], locale)}</span>
      </div>
      <h3>{fixtureField(value, 'title', locale)}</h3>
      {value.kind === 'invoice' ? (
        <>
          <div className={styles.previewMeta}>
            <span>
              {t('Bill to')}
              <strong>
                {fixtureField(value, 'client', locale) || translateFixed('Client name', locale)}
              </strong>
              {value.email}
            </span>
            <span>
              {t('Due date')}
              <strong>{documentDate(value.dueDate, locale)}</strong>
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>{t('Description')}</th>
                <th>{t('Qty')}</th>
                <th>{t('Amount')}</th>
              </tr>
            </thead>
            <tbody>
              {value.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {fixtureField(item, 'description', locale) ||
                      translateFixed('Line item', locale)}
                  </td>
                  <td>{formatNumber(item.quantity, undefined, locale)}</td>
                  <td>{money(item.quantity * item.rate, value.currency, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.total}>
            {t('Total')}
            <strong>{money(invoiceTotal(value.items), value.currency, locale)}</strong>
          </div>
          {value.notes ? <p>{fixtureField(value, 'notes', locale)}</p> : null}
        </>
      ) : null}
      {value.kind === 'proposal' ? (
        <>
          <div className={styles.previewMeta}>
            <span>
              {t('Prepared for')}
              <strong>
                {fixtureField(value, 'client', locale) || translateFixed('Client name', locale)}
              </strong>
            </span>
            <span>
              {t('Valid until')}
              <strong>{documentDate(value.validUntil, locale)}</strong>
            </span>
          </div>
          <h4>{t('Scope')}</h4>
          <p>
            {fixtureField(value, 'scope', locale) ||
              translateFixed('Add your proposal scope.', locale)}
          </p>
          <div className={styles.total}>
            {t('Budget')}
            <strong>{money(value.budget, 'USD', locale)}</strong>
          </div>
        </>
      ) : null}
      {value.kind === 'contract' ? (
        <>
          <div className={styles.previewMeta}>
            <span>
              {t('Client')}
              <strong>
                {fixtureField(value, 'client', locale) || translateFixed('Client name', locale)}
              </strong>
            </span>
            <span>
              {t('Provider')}
              <strong>{value.provider}</strong>
            </span>
          </div>
          <h4>
            {documentDate(value.startDate, locale)} — {documentDate(value.endDate, locale)}
          </h4>
          <p>
            {fixtureField(value, 'terms', locale) ||
              translateFixed('Add the contract terms.', locale)}
          </p>
        </>
      ) : null}
    </div>
  );
}

export function FormPreview({
  value,
  onSubmit,
}: {
  value: DashboardForm;
  onSubmit: (answers: string[]) => void;
}) {
  const { t, locale } = useTranslation(messages);

  const [answers, setAnswers] = useState<string[]>([]);
  const [error, setError] = useState('');
  const active = value.status === 'Ready';
  return (
    <div className={styles.preview}>
      <div className={styles.previewHeading}>
        <ReferenceIcon name="form" size={30} />
        <span>{t('Form')}</span>
      </div>
      <h3>{fixtureField(value, 'title', locale)}</h3>
      <p>{fixtureField(value, 'description', locale)}</p>
      <div className={`${common.fields} ${styles.responseFields}`}>
        {value.questions.map((question, index) => (
          <label key={index}>
            {fixtureArrayField(value, 'questions', index, locale) || 'Question' + ' ' + (index + 1)}
            <textarea
              rows={2}
              disabled={!active}
              value={answers[index] ?? ''}
              onChange={(event) => {
                setAnswers((current) => {
                  const next = [...current];
                  next[index] = event.target.value;
                  return next;
                });
                setError('');
              }}
            />
          </label>
        ))}
        {error ? (
          <p role="alert" className={common.error}>
            {translateFixed(error, locale)}
          </p>
        ) : null}
        <DashboardButton
          type="button"
          disabled={!active}
          onClick={() => {
            if (value.questions.some((_, index) => !answers[index]?.trim())) {
              setError('Complete every question before submitting.');
              return;
            }
            onSubmit(value.questions.map((_, index) => answers[index].trim()));
            setAnswers([]);
          }}
        >
          {t('Submit response')}
        </DashboardButton>
        {!active ? (
          <p className={styles.hint}>
            {value.status === 'Draft'
              ? t('Mark this form ready to collect responses.')
              : t('This form is completed.')}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function FormResponses({ value }: { value: DashboardForm }) {
  const { t, locale } = useTranslation(messages);

  return (
    <div className={styles.responses}>
      {value.responses.length ? (
        value.responses.map((response, index) => (
          <article key={response.id}>
            <h3>
              {t('Response')}
              {index + 1}
              <time>{new Date(response.submittedAt).toLocaleString(locale)}</time>
            </h3>
            {value.questions.map((question, position) => (
              <div key={position}>
                <strong>{fixtureArrayField(value, 'questions', position, locale)}</strong>
                <p>{fixtureArrayField(response, 'answers', position, locale)}</p>
              </div>
            ))}
          </article>
        ))
      ) : (
        <p className={styles.hint}>{t('No responses yet.')}</p>
      )}
    </div>
  );
}
