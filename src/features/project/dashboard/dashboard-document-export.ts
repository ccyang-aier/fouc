import { formatDate, formatNumber, getLocale, type Locale } from '@/lib/i18n';
import {
  fixtureArrayField,
  fixtureField,
  registerProjectFixtures,
  translateFixed,
} from '../i18n/display';
import { csvCell } from './dashboard-download';
import type { DashboardDocument, DashboardInvoiceItem } from './dashboard-model';
export const documentTypes = {
  invoice: 'Invoice',
  proposal: 'Proposal',
  contract: 'Contract',
  form: 'Form',
};
function numeric(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
export function money(value: number, currency = 'USD', locale: Locale = getLocale()) {
  return formatNumber(numeric(value), { style: 'currency', currency }, locale);
}
export function invoiceTotal(items: DashboardInvoiceItem[]) {
  return numeric(items.reduce((sum, item) => sum + invoiceAmount(item), 0));
}
function invoiceAmount(item: DashboardInvoiceItem) {
  return numeric(numeric(item.quantity) * numeric(item.rate));
}
function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}
export function documentDate(value: string, locale: Locale = getLocale()) {
  if (!value) return '';
  const date = new Date(value.length === 10 ? value + 'T00:00:00' : value);
  return Number.isFinite(date.valueOf())
    ? formatDate(
        date,
        {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          ...(value.length > 10 ? { hour: 'numeric', minute: '2-digit' as const } : {}),
        },
        locale,
      )
    : value;
}
export function documentHtml(value: DashboardDocument) {
  const locale = getLocale();
  const label = (key: string) => translateFixed(key, locale);
  const content = (field: string) => fixtureField(value, field, locale);

  const text = (label: string, content: string) =>
    `<h2>${escapeHtml(label)}</h2><p>${escapeHtml(content)}</p>`;
  let body = '';
  switch (value.kind) {
    case 'invoice': {
      const rows = value.items
        .map(
          (item) => `
        <tr>
          <td>${escapeHtml(fixtureField(item, 'description', locale))}</td>
          <td>${formatNumber(numeric(item.quantity), undefined, locale)}</td>
          <td>${money(item.rate, value.currency)}</td>
          <td>${money(invoiceAmount(item), value.currency)}</td>
        </tr>`,
        )
        .join('\n');
      body =
        text(label('Client'), content('client')) +
        text(label('Email'), value.email) +
        text(label('Due date'), documentDate(value.dueDate, locale)) +
        `<table>
          <thead><tr><th>${label('Description')}</th><th>${label('Quantity')}</th><th>${label('Rate')}</th><th>${label('Amount')}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>` +
        text(label('Total'), money(invoiceTotal(value.items), value.currency)) +
        text(label('Notes'), content('notes'));
      break;
    }
    case 'proposal':
      body =
        text(label('Client'), content('client')) +
        text(label('Scope'), content('scope')) +
        text(label('Budget'), money(value.budget)) +
        text(label('Valid until'), documentDate(value.validUntil, locale));
      break;
    case 'contract':
      body =
        text(label('Client'), content('client')) +
        text(label('Provider'), value.provider) +
        text(
          label('Term'),
          `${documentDate(value.startDate, locale)} ${label('To')} ${documentDate(value.endDate, locale)}`,
        ) +
        text(label('Terms'), content('terms'));
      break;
    case 'form':
      body =
        text(label('Description'), content('description')) +
        `<ol>${value.questions.map((_, index) => `<li>${escapeHtml(fixtureArrayField(value, 'questions', index, locale))}</li>`).join('')}</ol>` +
        text(label('Responses'), formatNumber(value.responses.length, undefined, locale));
      break;
  }
  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(content('title'))}</title>
    <style>
      body {
        max-width: 820px;
        margin: 60px auto;
        padding: 0 24px;
        font: 15px/1.7 Arial, sans-serif;
        color: #25272b;
      }
      h1 { font-size: 30px; letter-spacing: -1px; }
      h2 { font-size: 13px; color: #737880; margin-top: 28px; }
      p { white-space: pre-wrap; }
      table { width: 100%; border-collapse: collapse; margin-top: 25px; }
      td, th { padding: 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
      li { padding: 8px 0; }
      .status { color: #777; font-size: 13px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(content('title'))}</h1>
    <p class="status">${label(documentTypes[value.kind])} · ${label(value.status)}</p>
    ${body}
  </body>
</html>`;
}
export function documentCsv(value: DashboardDocument) {
  const locale = getLocale();
  const label = (key: string) => translateFixed(key, locale);
  const content = (field: string) => fixtureField(value, field, locale);

  let rows: (string | number)[][];
  switch (value.kind) {
    case 'invoice':
      rows = [
        [label('Invoice'), content('title')],
        [label('Client'), content('client')],
        [label('Email'), value.email],
        [label('Due date'), documentDate(value.dueDate, locale)],
        [label('Currency'), value.currency],
        [],
        [label('Description'), label('Quantity'), label('Rate'), label('Amount')],
        ...value.items.map((item) => [
          fixtureField(item, 'description', locale),
          numeric(item.quantity),
          numeric(item.rate),
          invoiceAmount(item),
        ]),
        [label('Total'), '', '', invoiceTotal(value.items)],
        [label('Notes'), content('notes')],
      ];
      break;
    case 'proposal':
      rows = [
        [label('Proposal'), content('title')],
        [label('Client'), content('client')],
        [label('Scope'), content('scope')],
        [label('Budget (USD)'), numeric(value.budget)],
        [label('Valid until'), documentDate(value.validUntil, locale)],
      ];
      break;
    case 'contract':
      rows = [
        [label('Contract'), content('title')],
        [label('Client'), content('client')],
        [label('Provider'), value.provider],
        [label('Start date'), documentDate(value.startDate, locale)],
        [label('End date'), documentDate(value.endDate, locale)],
        [label('Terms'), content('terms')],
      ];
      break;
    case 'form':
      rows = [
        [
          label('Submitted at'),
          ...value.questions.map((_, index) =>
            fixtureArrayField(value, 'questions', index, locale),
          ),
        ],
        ...value.responses.map((response) => [
          documentDate(response.submittedAt, locale),
          ...response.answers.map((_, index) =>
            fixtureArrayField(response, 'answers', index, locale),
          ),
        ]),
      ];
      break;
  }
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

registerProjectFixtures([documentTypes]);
