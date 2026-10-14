'use client';

import { uiText, type UiMessage, uiFailure, createUiMessages } from '../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './structure-edit-action.messages';
import { useEffect, useRef, useState } from 'react';
import { PencilSimple, SpinnerGap } from '@phosphor-icons/react';
import type { RelationalTableStructure } from '@fouc/shared';
import type {
  StructureEditCommitResult,
  StructureEditInput,
  StructureEditPreview,
} from '@fouc/shared/relational-structure-edit';
import { backendFetch, BackendRequestError } from '@/lib/backend';
import { SqlDialog } from './sql-library-dialog';
import { TableStructureEditorPanel } from './structure-edit';
import styles from './structure-edit-action.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export function StructureEditAction({
  base,
  schema,
  table,
  disabled,
  onApplied,
}: {
  base: string;
  schema: string;
  table: string;
  disabled: boolean;
  onApplied: () => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [target, setTarget] = useState<{
    schema: string;
    table: string;
  } | null>(null);
  return (
    <>
      <button
        type="button"
        className="fouc-action"
        data-surface="subtle"
        title={tConnector('editTableStructure')}
        disabled={disabled}
        onClick={() => setTarget({ schema, table })}
      >
        <PencilSimple size={14} />
        {tConnector('editTableStructure')}
      </button>
      {target && (
        <StructureEditDialog
          base={base}
          {...target}
          onApplied={onApplied}
          onClose={() => setTarget(null)}
        />
      )}
    </>
  );
}
function StructureEditDialog({
  base,
  schema,
  table,
  onApplied,
  onClose,
}: {
  base: string;
  schema: string;
  table: string;
  onApplied: () => void;
  onClose: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [structure, setStructure] = useState<RelationalTableStructure | null>(null),
    [errorStored, setError] = useState<UiMessage>(''),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false);
  const error = uiText(errorStored, locale);
  const live = useRef(true),
    request = useRef<AbortController | null>(null),
    plan = useRef<{
      id: string;
      review: StructureEditPreview;
    } | null>(null);
  const plansBase = `${base}/structure-edit/plans`;
  const discard = (id: string) =>
    backendFetch(`${plansBase}/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(
      () => undefined,
    );
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      request.current?.abort();
      const current = plan.current;
      plan.current = null;
      if (current)
        void backendFetch(`${plansBase}/${encodeURIComponent(current.id)}`, {
          method: 'DELETE',
        }).catch(() => undefined);
    };
  }, [plansBase]);
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<RelationalTableStructure>(
      `${base}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/structure`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setStructure(value);
          setError('');
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? uiFailure(reason) : String(reason));
      });
    return () => controller.abort();
  }, [base, schema, table, revision]);
  async function preview(input: StructureEditInput) {
    const old = plan.current;
    plan.current = null;
    if (old) await discard(old.id);
    const controller = new AbortController();
    request.current = controller;
    const value = await backendFetch<{
      planId: string;
      review: StructureEditPreview;
    }>(plansBase, {
      method: 'POST',
      body: JSON.stringify({ schema, table, ...input }),
      signal: controller.signal,
    });
    if (!live.current || controller.signal.aborted) {
      await discard(value.planId);
      throw connectorUiMessages.error('structurePreviewClosed');
    }
    plan.current = { id: value.planId, review: value.review };
    return value.review;
  }
  async function commit(review: StructureEditPreview) {
    const current = plan.current;
    if (!current || current.review !== review)
      throw connectorUiMessages.error('structurePlanChangedGenerateANewPreview');
    plan.current = null;
    setBusy(true);
    try {
      const result = await backendFetch<StructureEditCommitResult>(
        `${plansBase}/${encodeURIComponent(current.id)}/commit`,
        { method: 'POST', body: JSON.stringify({ confirm: true }) },
      );
      if (['committed', 'partial', 'unknown'].includes(result.outcome)) onApplied();
      return result;
    } catch (reason) {
      if (reason instanceof BackendRequestError && reason.status >= 400 && reason.status < 500)
        throw reason;
      throw connectorUiMessages.error(
        'structureCommitOutcomeUnconfirmedReadTheStructureAgainAndVerify',
        { p0: uiFailure(reason) },
      );
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return (
    <SqlDialog
      title={tConnector('editTableStructure')}
      busy={busy}
      className={styles.dialog}
      onClose={onClose}
    >
      <div className={styles.body}>
        {structure ? (
          <TableStructureEditorPanel structure={structure} onPreview={preview} onCommit={commit} />
        ) : error ? (
          <div className={styles.state}>
            <p role="alert">{error}</p>
            <button type="button" onClick={() => setRevision((value) => value + 1)}>
              {tConnector('readStructureAgain')}
            </button>
          </div>
        ) : (
          <div className={styles.state} role="status">
            <SpinnerGap size={18} className="mw-spin" />
            {tConnector('readingTheCurrentTableSActualStructure')}
          </div>
        )}
      </div>
    </SqlDialog>
  );
}
