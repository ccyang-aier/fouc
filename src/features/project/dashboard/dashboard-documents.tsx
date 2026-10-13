'use client';

import { DotsThree, Plus, Star, Trash } from '@phosphor-icons/react';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DashboardMenu, DashboardMenuContent } from './dashboard-menu';
import { DashboardButton, IconButton, ReferenceIcon, SegmentedControl } from './dashboard-ui';
import type { DashboardDocument, DashboardDocumentKind } from './dashboard-model';
import styles from './dashboard-documents.module.css';

const labels = {
  invoice: 'Invoices',
  proposal: 'Proposals',
  contract: 'Contracts',
  form: 'Forms',
} as const;
export function DashboardDocuments({
  documents,
  kind,
  onKindChange,
  onOpen,
  onCreate,
  onSave,
  onDelete,
}: {
  documents: DashboardDocument[];
  kind: DashboardDocumentKind;
  onKindChange: (kind: DashboardDocumentKind) => void;
  onOpen: (document: DashboardDocument) => void;
  onCreate: (kind: DashboardDocumentKind) => void;
  onSave: (document: DashboardDocument) => void;
  onDelete: (document: DashboardDocument) => void;
}) {
  const kinds = Object.keys(labels) as DashboardDocumentKind[];
  const visible = documents.filter((document) => document.kind === kind);
  return (
    <section className={styles.panel} aria-label="Documents">
      <header>
        <SegmentedControl
          items={kinds.map((key) => labels[key])}
          value={labels[kind]}
          onChange={(label) => onKindChange(kinds.find((key) => labels[key] === label)!)}
          label="Document types"
        />
        <DashboardButton onClick={() => onCreate(kind)}>
          <Plus size={15} />
          New {kind}
        </DashboardButton>
      </header>
      <div className={styles.list}>
        {visible.map((document) => (
          <article key={document.id}>
            <button
              type="button"
              className={`fouc-action ${styles.document}`}
              onClick={() => onOpen(document)}
            >
              <ReferenceIcon name={document.kind} size={36} />
              <span>
                <strong>{document.title}</strong>
                <small>
                  {document.kind === 'invoice'
                    ? document.client
                    : document.kind === 'form'
                      ? `${document.responses.length} ${document.responses.length === 1 ? 'response' : 'responses'}`
                      : document.client}
                </small>
              </span>
              <span className={styles.status} data-status={document.status}>
                {document.status}
              </span>
              {document.starred ? <Star size={14} weight="fill" /> : null}
            </button>
            <DashboardMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label={`${document.title} options`}>
                  <DotsThree weight="bold" />
                </IconButton>
              </DropdownMenuTrigger>
              <DashboardMenuContent align="end">
                <DropdownMenuItem onSelect={() => onOpen(document)}>
                  Open {document.kind}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onSave({ ...document, starred: !document.starred })}
                >
                  <Star />
                  {document.starred ? 'Remove from favourites' : 'Add to favourites'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(document)}>
                  <Trash />
                  Delete {document.kind}
                </DropdownMenuItem>
              </DashboardMenuContent>
            </DashboardMenu>
          </article>
        ))}
        {!visible.length ? (
          <div className={styles.empty}>
            <ReferenceIcon name={kind} size={40} />
            <p>No {labels[kind].toLowerCase()} found</p>
            <DashboardButton tone="neutral" onClick={() => onCreate(kind)}>
              Create {kind}
            </DashboardButton>
          </div>
        ) : null}
      </div>
    </section>
  );
}
