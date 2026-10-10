import type { DatabaseCell, RelationalFilterOperator } from '@fouc/shared'
import type { ResultExportFormat } from '../result-export/model'
import type { ResultGridSelectionScope } from './selection-controller'
import { compareExactGridNumbers } from './exact-summary'
import { rawGridCellText } from './clipboard'

export type TableGridCommand = 'fill' | 'null' | 'generate-uuid' | 'generate-now' | 'generate-sequence' | 'clone' | 'delete'
export type TableGridCommandHandle = { execute: (command: TableGridCommand, scope: ResultGridSelectionScope) => void }
export type TableGridContextActions = {
  writable: boolean; canEdit: boolean; canNull: boolean; canClone: boolean; canDelete: boolean; queryDisabled: boolean;
  onEdit: (command: TableGridCommand, scope: ResultGridSelectionScope) => void;
  onDatabaseSort: (column: string, direction: 'asc' | 'desc') => void;
  onPageSort: (column: number, direction: 'asc' | 'desc') => void;
  onFilter: (column: string, value: DatabaseCell, operator: RelationalFilterOperator) => void;
  onColumnDetails: (column: string) => void;
  onExport: (format: ResultExportFormat, scope: ResultGridSelectionScope) => void;
  onRefresh: () => void;
}

/** Page sorting never converts exact decimal/bigint text into floating point numbers. */
export function compareGridPageCells(a: DatabaseCell, b: DatabaseCell, type: string): number {
  if (a === b) return 0
  if (a === null) return -1
  if (b === null) return 1
  if (/int|numeric|decimal|real|float|double/i.test(type) || typeof a === 'number' && typeof b === 'number') {
    const exact = compareExactGridNumbers(a, b)
    if (exact !== null) return exact
  }
  return rawGridCellText(a).localeCompare(rawGridCellText(b), 'zh-CN')
}
