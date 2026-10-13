import type { DashboardDocument, DashboardInvoiceItem } from './dashboard-model';
import { csvCell } from './dashboard-download';
export const documentTypes = {
  invoice: 'Invoice',
  proposal: 'Proposal',
  contract: 'Contract',
  form: 'Form',
};
function numeric(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
export function money(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(numeric(value));
}
export function invoiceTotal(items: DashboardInvoiceItem[]) {
  return items.reduce((sum, item) => sum + numeric(item.quantity) * numeric(item.rate), 0);
}
function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}
export function documentHtml(value: DashboardDocument) {
  const text = (label: string, content: string) =>
    `<h2>${escapeHtml(label)}</h2><p>${escapeHtml(content)}</p>`;
  let body = '';
  switch (value.kind) {
    case 'invoice': {
      const rows = value.items
        .map(
          (item) => `
        <tr>
          <td>${escapeHtml(item.description)}</td>
          <td>${numeric(item.quantity)}</td>
          <td>${money(item.rate, value.currency)}</td>
          <td>${money(numeric(item.quantity) * numeric(item.rate), value.currency)}</td>
        </tr>`,
        )
        .join('\n');
      body =
        text('Client', value.client) +
        text('Email', value.email) +
        text('Due date', value.dueDate) +
        `<table>
          <thead><tr><th>Description</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>` +
        text('Total', money(invoiceTotal(value.items), value.currency)) +
        text('Notes', value.notes);
      break;
    }
    case 'proposal':
      body =
        text('Client', value.client) +
        text('Scope', value.scope) +
        text('Budget', money(value.budget)) +
        text('Valid until', value.validUntil);
      break;
    case 'contract':
      body =
        text('Client', value.client) +
        text('Provider', value.provider) +
        text('Term', `${value.startDate} to ${value.endDate}`) +
        text('Terms', value.terms);
      break;
    case 'form':
      body =
        text('Description', value.description) +
        `<ol>${value.questions.map((question) => `<li>${escapeHtml(question)}</li>`).join('')}</ol>` +
        text('Responses', String(value.responses.length));
      break;
  }
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(value.title)}</title>
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
    <h1>${escapeHtml(value.title)}</h1>
    <p class="status">${documentTypes[value.kind]} · ${value.status}</p>
    ${body}
  </body>
</html>`;
}
export function documentCsv(value: DashboardDocument) {
  let rows: (string | number)[][];
  switch (value.kind) {
    case 'invoice':
      rows = [
        ['Invoice', value.title],
        ['Client', value.client],
        ['Email', value.email],
        ['Due date', value.dueDate],
        ['Currency', value.currency],
        [],
        ['Description', 'Quantity', 'Rate', 'Amount'],
        ...value.items.map((item) => [
          item.description,
          numeric(item.quantity),
          numeric(item.rate),
          numeric(item.quantity) * numeric(item.rate),
        ]),
        ['Total', '', '', invoiceTotal(value.items)],
        ['Notes', value.notes],
      ];
      break;
    case 'proposal':
      rows = [
        ['Proposal', value.title],
        ['Client', value.client],
        ['Scope', value.scope],
        ['Budget (USD)', numeric(value.budget)],
        ['Valid until', value.validUntil],
      ];
      break;
    case 'contract':
      rows = [
        ['Contract', value.title],
        ['Client', value.client],
        ['Provider', value.provider],
        ['Start date', value.startDate],
        ['End date', value.endDate],
        ['Terms', value.terms],
      ];
      break;
    case 'form':
      rows = [
        ['Submitted at', ...value.questions],
        ...value.responses.map((response) => [response.submittedAt, ...response.answers]),
      ];
      break;
  }
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
