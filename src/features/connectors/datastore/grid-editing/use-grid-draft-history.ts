'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './use-grid-draft-history.messages';
import { useReducer } from 'react';
import { initialGridDraftHistory, reduceGridDraftHistory } from './history';
import type { GridEditDraft } from './model';
export type GridDraftHistory = {
  drafts: GridEditDraft[];
  revision: number;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string;
  redoLabel: string;
  apply: (drafts: readonly GridEditDraft[], label?: string) => void;
  undo: () => void;
  redo: () => void;
  reset: (drafts?: readonly GridEditDraft[]) => void;
};
export function useGridDraftHistory(initial: readonly GridEditDraft[] = []): GridDraftHistory {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [state, dispatch] = useReducer(reduceGridDraftHistory, initial, initialGridDraftHistory);
  return {
    drafts: state.drafts,
    revision: state.revision,
    canUndo: !!state.past.length,
    canRedo: !!state.future.length,
    undoLabel: state.past.at(-1)?.label ?? '',
    redoLabel: state.future.at(-1)?.label ?? '',
    apply: (drafts, label = tConnector('editPendingChanges')) =>
      dispatch({ type: 'apply', drafts, label }),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    reset: (drafts) => dispatch({ type: 'reset', drafts }),
  };
}
