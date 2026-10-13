'use client';

import { useState } from 'react';
import { DownloadSimple, LinkSimple, Star, Trash } from '@phosphor-icons/react';
import { useAppAlert } from '@/components/app-alert-provider';
import { DashboardButton, IconButton, SegmentedControl } from './dashboard-ui';
import { DashboardModal } from './dashboard-modal';
import { DashboardDeleteDialog } from './dashboard-actions';
import { downloadFile } from './dashboard-download';
import { dashboardLink } from './dashboard-links';
import { documentTypes, documentHtml, documentCsv } from './dashboard-document-export';
import {
  InvoiceFields,
  ProposalFields,
  ContractFields,
  FormFields,
} from './dashboard-document-fields';
import { DocumentPreview, FormPreview, FormResponses } from './dashboard-document-preview';
import type { DashboardDocument, DashboardDocumentKind } from './dashboard-model';
import common from './dashboard-actions.module.css';
import styles from './dashboard-document-dialog.module.css';

const documentLabels = {
  invoice: 'Send a invoice',
  proposal: 'Draft a Proposal',
  contract: 'Create a contract',
  form: 'Add a form',
};
type DocumentTab = 'Edit' | 'Preview' | 'Responses';

function newDocument(kind: DashboardDocumentKind): DashboardDocument {
  const base = {
    id: crypto.randomUUID(),
    title: `Untitled ${kind}`,
    status: 'Draft' as const,
    starred: false,
  };
  switch (kind) {
    case 'invoice':
      return {
        ...base,
        kind,
        client: '',
        email: '',
        currency: 'USD',
        dueDate: '2027-02-09',
        items: [{ id: crypto.randomUUID(), description: '', quantity: 1, rate: 0 }],
        notes: '',
      };
    case 'proposal':
      return {
        ...base,
        kind,
        client: '',
        scope: '',
        budget: 0,
        validUntil: '2027-02-28',
      };
    case 'contract':
      return {
        ...base,
        kind,
        client: '',
        provider: 'Sarah Smither',
        terms: '',
        startDate: '2027-02-08',
        endDate: '2027-03-08',
      };
    case 'form':
      return { ...base, kind, description: '', questions: [''], responses: [] };
  }
}

function validateDocument(value: DashboardDocument, status: DashboardDocument['status']): string {
  if (!value.title.trim()) return 'Enter a document title.';
  if (status === 'Draft') return '';
  if (value.kind === 'invoice') {
    if (!value.client.trim()) return 'Enter a client name.';
    if (!value.dueDate) return 'Choose a due date.';
    if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))
      return 'Enter a valid client email.';
    if (
      !value.items.length ||
      value.items.some(
        (item) =>
          !item.description.trim() ||
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          !Number.isFinite(item.rate) ||
          item.rate < 0 ||
          !Number.isFinite(item.quantity * item.rate),
      )
    )
      return 'Complete every line item with a description, quantity and rate.';
    if (!Number.isFinite(value.items.reduce((sum, item) => sum + item.quantity * item.rate, 0)))
      return 'The invoice total is too large.';
  }
  if (
    value.kind === 'proposal' &&
    (!value.client.trim() ||
      !value.scope.trim() ||
      !value.validUntil ||
      !Number.isFinite(value.budget) ||
      value.budget <= 0)
  )
    return 'Add a client, scope, budget and validity date.';
  if (value.kind === 'contract') {
    if (
      !value.client.trim() ||
      !value.provider.trim() ||
      !value.terms.trim() ||
      !value.startDate ||
      !value.endDate
    )
      return 'Complete both parties, the terms and the contract dates.';
    if (value.endDate < value.startDate) return 'The end date must be on or after the start date.';
  }
  if (
    value.kind === 'form' &&
    (!value.questions.length || value.questions.some((question) => !question.trim()))
  )
    return 'Add at least one question and complete every question.';
  return '';
}

export function DashboardDocumentDialog({
  kind,
  scopeKey,
  document: savedDocument,
  onClose,
  onSave,
  onDelete,
}: {
  kind: DashboardDocumentKind;
  scopeKey: string;
  document?: DashboardDocument;
  onClose: () => void;
  onSave: (document: DashboardDocument) => void;
  onDelete?: (id: string) => void;
}) {
  const [draft, setDraft] = useState<DashboardDocument>(() => savedDocument ?? newDocument(kind));
  const [tab, setTab] = useState<DocumentTab>('Edit');
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { notify } = useAppAlert();

  function save(status = draft.status, close = true) {
    const validation = validateDocument(draft, status);
    if (validation) {
      setError(validation);
      setTab('Edit');
      return;
    }
    const next = { ...draft, title: draft.title.trim(), status };
    onSave(next);
    setDraft(next);
    setError('');
    notify(
      'success',
      status === 'Draft'
        ? 'Draft saved'
        : status === 'Ready'
          ? 'Document marked ready'
          : 'Document completed',
    );
    if (close) onClose();
  }
  function download(format: 'html' | 'csv') {
    downloadFile(
      `${draft.title || documentTypes[draft.kind]}.${format}`,
      format === 'html' ? documentHtml(draft) : documentCsv(draft),
      format === 'html' ? 'text/html;charset=utf-8' : 'text/csv;charset=utf-8',
    );
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        dashboardLink(window.location.href, scopeKey, { kind: 'document', id: draft.id }),
      );
      notify('success', 'Document link copied');
    } catch {
      notify('error', 'Could not copy the document link');
    }
  }
  return (
    <>
      <DashboardModal
        title={savedDocument ? documentTypes[draft.kind] : documentLabels[draft.kind]}
        onClose={onClose}
        wide
      >
        <div className={styles.toolbar}>
          <SegmentedControl
            items={
              draft.kind === 'form'
                ? (['Edit', 'Preview', 'Responses'] as const)
                : (['Edit', 'Preview'] as const)
            }
            value={tab}
            onChange={setTab}
            label="Document view"
          />
          <span className={styles.status} data-status={draft.status.toLowerCase()}>
            {draft.status}
          </span>
          <IconButton
            label={draft.starred ? 'Remove document from favorites' : 'Add document to favorites'}
            aria-pressed={draft.starred}
            onClick={() => setDraft((current) => ({ ...current, starred: !current.starred }))}
          >
            <Star size={16} weight={draft.starred ? 'fill' : 'regular'} />
          </IconButton>
          {savedDocument ? (
            <IconButton label="Copy document link" onClick={() => void copyLink()}>
              <LinkSimple size={16} />
            </IconButton>
          ) : null}
          {savedDocument && onDelete ? (
            <IconButton
              label="Delete document"
              className={styles.dangerIcon}
              data-variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash size={16} />
            </IconButton>
          ) : null}
        </div>
        <form
          noValidate
          className={common.form}
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className={common.scrollBody}>
            {tab === 'Edit' ? (
              <div className={common.fields}>
                <label>
                  Document title
                  <input
                    autoFocus
                    value={draft.title}
                    onChange={(event) => {
                      setDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }));
                      setError('');
                    }}
                  />
                </label>
                {draft.kind === 'invoice' ? (
                  <InvoiceFields value={draft} onChange={setDraft} />
                ) : null}
                {draft.kind === 'proposal' ? (
                  <ProposalFields value={draft} onChange={setDraft} />
                ) : null}
                {draft.kind === 'contract' ? (
                  <ContractFields value={draft} onChange={setDraft} />
                ) : null}
                {draft.kind === 'form' ? <FormFields value={draft} onChange={setDraft} /> : null}
                {error ? (
                  <p role="alert" className={common.error}>
                    {error}
                  </p>
                ) : null}
              </div>
            ) : null}
            {tab === 'Preview' ? (
              draft.kind === 'form' ? (
                <FormPreview
                  value={draft}
                  onSubmit={(answers) => {
                    const response = {
                      id: crypto.randomUUID(),
                      answers,
                      submittedAt: new Date().toISOString(),
                    };
                    const next = {
                      ...draft,
                      responses: [...draft.responses, response],
                    };
                    onSave(next);
                    setDraft(next);
                    notify('success', 'Response saved on this device');
                  }}
                />
              ) : (
                <DocumentPreview value={draft} />
              )
            ) : null}
            {tab === 'Responses' && draft.kind === 'form' ? <FormResponses value={draft} /> : null}
          </div>
          <footer>
            <div className={styles.downloads}>
              <DashboardButton type="button" tone="neutral" onClick={() => download('html')}>
                <DownloadSimple size={13} />
                HTML
              </DashboardButton>
              <DashboardButton type="button" tone="neutral" onClick={() => download('csv')}>
                CSV
              </DashboardButton>
            </div>
            <DashboardButton type="button" tone="neutral" onClick={onClose}>
              Cancel
            </DashboardButton>
            <DashboardButton
              type="button"
              tone="neutral"
              onClick={() =>
                save(
                  draft.status === 'Draft'
                    ? 'Ready'
                    : draft.status === 'Ready'
                      ? 'Completed'
                      : 'Draft',
                  false,
                )
              }
            >
              {draft.status === 'Draft'
                ? 'Mark ready'
                : draft.status === 'Ready'
                  ? 'Complete'
                  : 'Reopen draft'}
            </DashboardButton>
            <DashboardButton type="submit">
              {draft.status === 'Draft' ? 'Save draft' : 'Save'}
            </DashboardButton>
          </footer>
        </form>
      </DashboardModal>
      {deleteOpen ? (
        <DashboardDeleteDialog
          title={`Delete ${documentTypes[draft.kind].toLowerCase()}?`}
          description={`“${draft.title}”${draft.kind === 'form' ? ' and its responses' : ''} will be removed from this dashboard.`}
          onClose={() => setDeleteOpen(false)}
          onDelete={() => {
            onDelete?.(draft.id);
            notify('success', 'Document deleted');
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
