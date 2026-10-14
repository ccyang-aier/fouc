'use client';
import { translateFixed } from '../i18n/display';

import { useTranslation } from '@/lib/i18n';
import { fixtureField } from '../i18n/display';
import { messages } from './i18n/dashboard-documents';

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DotsThree, Plus, Star, Trash } from '@phosphor-icons/react';
import styles from './dashboard-documents.module.css';
import { DashboardMenu, DashboardMenuContent } from './dashboard-menu';
import type { DashboardDocument, DashboardDocumentKind } from './dashboard-model';
import { DashboardButton, IconButton, ReferenceIcon, SegmentedControl } from './dashboard-ui';

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
  const { t, locale } = useTranslation(messages);
  const uiLabel = (value: string) => translateFixed(value, locale);

  const kinds = Object.keys(labels) as DashboardDocumentKind[];
  const visible = documents.filter((document) => document.kind === kind);
  return (
    <section className={styles.panel} aria-label={t('Documents')}>
      <header>
        <SegmentedControl
          items={kinds.map((key) => labels[key])}
          value={labels[kind]}
          onChange={(label) => onKindChange(kinds.find((key) => labels[key] === label)!)}
          label={t('Document types')}
        />
        <DashboardButton onClick={() => onCreate(kind)}>
          <Plus size={15} />
          {t('New')}
          {kind}
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
                <strong>{fixtureField(document, 'title', locale)}</strong>
                <small>
                  {document.kind === 'invoice'
                    ? document.client
                    : document.kind === 'form'
                      ? `${document.responses.length} ${document.responses.length === 1 ? t('response') : t('responses')}`
                      : document.client}
                </small>
              </span>
              <span className={styles.status} data-status={document.status}>
                {uiLabel(document.status)}
              </span>
              {document.starred ? <Star size={14} weight="fill" /> : null}
            </button>
            <DashboardMenu>
              <DropdownMenuTrigger asChild>
                <IconButton
                  label={t('{v0} options', { v0: fixtureField(document, 'title', locale) })}
                >
                  <DotsThree weight="bold" />
                </IconButton>
              </DropdownMenuTrigger>
              <DashboardMenuContent align="end">
                <DropdownMenuItem onSelect={() => onOpen(document)}>
                  {t('Open')}
                  {document.kind}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onSave({ ...document, starred: !document.starred })}
                >
                  <Star />
                  {document.starred ? t('Remove from favourites') : t('Add to favourites')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(document)}>
                  <Trash />
                  {t('Delete')}
                  {document.kind}
                </DropdownMenuItem>
              </DashboardMenuContent>
            </DashboardMenu>
          </article>
        ))}
        {!visible.length ? (
          <div className={styles.empty}>
            <ReferenceIcon name={kind} size={40} />
            <p>
              {t('No')} {labels[kind].toLowerCase()} {t('found')}
            </p>
            <DashboardButton tone="neutral" onClick={() => onCreate(kind)}>
              {t('Create')}
              {kind}
            </DashboardButton>
          </div>
        ) : null}
      </div>
    </section>
  );
}
