import type { ReactNode } from 'react'
import type { ConnectionBatchAction, ConnectionBatchProgress, ConnectionBatchResult } from './batch'

export type ConnectionListStatus = 'untested' | 'passed' | 'failed' | 'testing'

export interface ConnectionListRow {
  id: string
  name: string
  target: string
  targetTitle: string
  account?: string
  authSource?: string
  projectIds: string[]
  tags: string[]
  favorite: boolean
  status: ConnectionListStatus
  statusTitle?: string
}

export interface DirectoryProject {
  id: string
  name: string
}

export interface ConnectionListProps {
  label: string
  targetLabel: string
  accountLabel?: string
  authSourceLabel?: string
  scopeKey: string
  rows: readonly ConnectionListRow[]
  projects: readonly DirectoryProject[]
  loading: boolean
  error: string
  pendingIds: readonly string[]
  selectedIds: readonly string[]
  batchProgress: ConnectionBatchProgress | null
  batchResult: ConnectionBatchResult | null
  headerActions: ReactNode
  onBack: () => void
  onCreate: () => void
  onRetry: () => void
  onOpen: (row: ConnectionListRow) => void
  onEdit: (row: ConnectionListRow) => void
  onRemove: (row: ConnectionListRow) => void
  onOpenProject: (projectId: string) => void
  onManageTags: (row: ConnectionListRow) => void
  onFavorite: (row: ConnectionListRow, favorite: boolean) => void
  onSelectionChange: (ids: string[]) => void
  onBatchAction: (action: ConnectionBatchAction, ids: readonly string[]) => void
  onDismissBatchResult: () => void
}
