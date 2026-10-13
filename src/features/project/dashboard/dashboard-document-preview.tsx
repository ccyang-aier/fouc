'use client';
import { useState } from 'react';
import { DashboardButton, ReferenceIcon } from './dashboard-ui';
import type { DashboardDocument, DashboardForm } from './dashboard-model';
import { documentTypes, invoiceTotal, money } from './dashboard-document-export';
import common from './dashboard-actions.module.css';
import styles from './dashboard-document-dialog.module.css';
export function DocumentPreview({ value }: { value: DashboardDocument }) {
  return (
    <div className={styles.preview}>
      <div className={styles.previewHeading}>
        <ReferenceIcon name={value.kind} size={30} />
        <span>{documentTypes[value.kind]}</span>
      </div>
      <h3>{value.title}</h3>
      {value.kind === 'invoice' ? (
        <>
          <div className={styles.previewMeta}>
            <span>
              Bill to<strong>{value.client || 'Client name'}</strong>
              {value.email}
            </span>
            <span>
              Due date<strong>{value.dueDate}</strong>
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {value.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.description || 'Line item'}</td>
                  <td>{item.quantity}</td>
                  <td>{money(item.quantity * item.rate, value.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.total}>
            Total <strong>{money(invoiceTotal(value.items), value.currency)}</strong>
          </div>
          {value.notes ? <p>{value.notes}</p> : null}
        </>
      ) : null}
      {value.kind === 'proposal' ? (
        <>
          <div className={styles.previewMeta}>
            <span>
              Prepared for<strong>{value.client || 'Client name'}</strong>
            </span>
            <span>
              Valid until<strong>{value.validUntil}</strong>
            </span>
          </div>
          <h4>Scope</h4>
          <p>{value.scope || 'Add your proposal scope.'}</p>
          <div className={styles.total}>
            Budget <strong>{money(value.budget)}</strong>
          </div>
        </>
      ) : null}
      {value.kind === 'contract' ? (
        <>
          <div className={styles.previewMeta}>
            <span>
              Client<strong>{value.client || 'Client name'}</strong>
            </span>
            <span>
              Provider<strong>{value.provider}</strong>
            </span>
          </div>
          <h4>
            {value.startDate} — {value.endDate}
          </h4>
          <p>{value.terms || 'Add the contract terms.'}</p>
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
  const [answers, setAnswers] = useState<string[]>([]);
  const [error, setError] = useState('');
  const active = value.status === 'Ready';
  return (
    <div className={styles.preview}>
      <div className={styles.previewHeading}>
        <ReferenceIcon name="form" size={30} />
        <span>Form</span>
      </div>
      <h3>{value.title}</h3>
      <p>{value.description}</p>
      <div className={`${common.fields} ${styles.responseFields}`}>
        {value.questions.map((question, index) => (
          <label key={index}>
            {question || `Question ${index + 1}`}
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
            {error}
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
          Submit response
        </DashboardButton>
        {!active ? (
          <p className={styles.hint}>
            {value.status === 'Draft'
              ? 'Mark this form ready to collect responses.'
              : 'This form is completed.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function FormResponses({ value }: { value: DashboardForm }) {
  return (
    <div className={styles.responses}>
      {value.responses.length ? (
        value.responses.map((response, index) => (
          <article key={response.id}>
            <h3>
              Response {index + 1}
              <time>{new Date(response.submittedAt).toLocaleString('en-US')}</time>
            </h3>
            {value.questions.map((question, position) => (
              <div key={position}>
                <strong>{question}</strong>
                <p>{response.answers[position]}</p>
              </div>
            ))}
          </article>
        ))
      ) : (
        <p className={styles.hint}>No responses yet.</p>
      )}
    </div>
  );
}
