import type { DatabaseColumnInfo, RelationalConstraint, RelationalForeignKey, RelationalIndex, RelationalProvider, RelationalTableStructure, RelationalTrigger } from '@fouc/shared'

export type SchemaDiffInput = RelationalTableStructure | readonly RelationalTableStructure[] | null
export type SchemaDiffOperation = 'add' | 'modify' | 'remove'
export type SchemaDiffKind = 'table' | 'column' | 'index' | 'foreign' | 'constraint' | 'property' | 'trigger'
export type SchemaDiffRisk = 'low' | 'review' | 'destructive'
export type SchemaDiffValue = DatabaseColumnInfo | RelationalIndex | RelationalForeignKey | RelationalConstraint | RelationalTrigger | RelationalTableStructure | string | null
export interface SchemaDiffField { key: string; label: string; before: string; after: string }
export interface SchemaDiffChange {
  id: string
  tableId: string
  name: string
  kind: SchemaDiffKind
  operation: SchemaDiffOperation
  source: SchemaDiffValue
  target: SchemaDiffValue
  fields: SchemaDiffField[]
  risk: SchemaDiffRisk
}
export interface SchemaDiffTable {
  id: string
  name: string
  source: RelationalTableStructure | null
  target: RelationalTableStructure | null
  changes: SchemaDiffChange[]
}
export interface SchemaDiffTableMapping { sourceTable: string; sourceSchema?: string; targetTable: string; targetSchema?: string }
export interface SchemaDiffOptions {
  ignoreComments?: boolean
  compareColumnOrder?: boolean
  indexes?: boolean
  foreignKeys?: boolean
  checks?: boolean
  triggers?: boolean
  tableMappings?: readonly SchemaDiffTableMapping[]
}
export interface SchemaDiffComparison {
  provider: RelationalProvider
  tables: SchemaDiffTable[]
  changes: SchemaDiffChange[]
  options: Required<Omit<SchemaDiffOptions, 'tableMappings'>> & Pick<SchemaDiffOptions, 'tableMappings'>
  issues: SchemaDiffIssue[]
}
export interface SchemaDiffIssue { severity: 'info' | 'warning' | 'unsupported'; message: string; changeId?: string; tableId?: string }
export interface SchemaDiffStep {
  id: string
  tableId: string
  changeIds: string[]
  phase: number
  label: string
  sql: string
  risk: SchemaDiffRisk
  dependsOn: string[]
}
export interface SchemaDiffScript {
  sql: string
  steps: SchemaDiffStep[]
  issues: SchemaDiffIssue[]
  selectedCount: number
  reviewComplete: boolean
}

export const SCHEMA_DIFF_KIND_LABELS: Record<SchemaDiffKind, string> = {
  table: '表', column: '字段', index: '索引', foreign: '外键', constraint: '约束', property: '表属性', trigger: '触发器',
}
export const SCHEMA_DIFF_OPERATION_LABELS: Record<SchemaDiffOperation, string> = { add: '新增', modify: '修改', remove: '删除' }

export function schemaObjectKey(schema: string, table: string) { return JSON.stringify([schema, table]) }
export function schemaChangeId(tableId: string, kind: SchemaDiffKind, name: string) { return `${tableId}:${kind}:${JSON.stringify(name)}` }
