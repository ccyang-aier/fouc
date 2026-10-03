/** DBX pending snapshots: each batch is one undo frame; successful save resets both stacks. */
import { GRID_EDIT_LIMITS, type GridEditDraft } from './model'

type HistoryFrame = { drafts: GridEditDraft[]; label: string }
export type GridDraftHistoryState = { drafts: GridEditDraft[]; past: HistoryFrame[]; future: HistoryFrame[]; revision: number }
export type GridDraftHistoryAction = { type: 'apply'; drafts: readonly GridEditDraft[]; label: string } | { type: 'undo' | 'redo' } | { type: 'reset'; drafts?: readonly GridEditDraft[] }
function snapshot(drafts: readonly GridEditDraft[]): GridEditDraft[] { return structuredClone([...drafts]) }
export function initialGridDraftHistory(drafts: readonly GridEditDraft[] = []): GridDraftHistoryState { return { drafts: snapshot(drafts), past: [], future: [], revision: 0 } }
export function reduceGridDraftHistory(state: GridDraftHistoryState, action: GridDraftHistoryAction): GridDraftHistoryState {
  if (action.type === 'reset') return { ...initialGridDraftHistory(action.drafts), revision: state.revision + 1 }
  if (action.type === 'apply') {
    if (JSON.stringify(action.drafts) === JSON.stringify(state.drafts)) return state
    return { drafts: snapshot(action.drafts), past: [...state.past.slice(-(GRID_EDIT_LIMITS.history - 1)), { drafts: state.drafts, label: action.label }], future: [], revision: state.revision + 1 }
  }
  if (action.type === 'undo') {
    const previous = state.past.at(-1)
    return previous ? { drafts: previous.drafts, past: state.past.slice(0, -1), future: [...state.future, { drafts: state.drafts, label: previous.label }], revision: state.revision + 1 } : state
  }
  const next = state.future.at(-1)
  return next ? { drafts: next.drafts, past: [...state.past, { drafts: state.drafts, label: next.label }], future: state.future.slice(0, -1), revision: state.revision + 1 } : state
}
