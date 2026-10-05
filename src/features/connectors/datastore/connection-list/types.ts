import type { ReactNode } from 'react'

export type ConnectionListStatus = 'untested' | 'passed' | 'failed' | 'testing'

export interface ConnectionListRow {
  id: string
  name: string
  target: string
  targetTitle: string
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
  scopeKey: string
  rows: readonly ConnectionListRow[]
  projects: readonly DirectoryProject[]
  loading: boolean
  error: string
  pendingIds: readonly string[]
  headerActions: ReactNode
  onBack: () => void
  onCreate: () => void
  onRetry: () => void
  onOpen: (row: ConnectionListRow) => void
  onEdit: (row: ConnectionListRow) => void
  onCopy: (row: ConnectionListRow) => void
  onRemove: (row: ConnectionListRow) => void
  onManageProjects: (row: ConnectionListRow) => void
  onManageTags: (row: ConnectionListRow) => void
  onFavorite: (row: ConnectionListRow, favorite: boolean) => void
  onSelectionChange: (ids: string[]) => void
}
