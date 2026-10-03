import type { DatabaseColumnInfo, DatabaseObjectKind } from './database';
import type { RelationalProvider } from './relational';

/** DBX structure metadata; unknown catalog facts remain null, never inferred as supported. */
export interface RelationalIndexPart {
  position: number;
  column: string | null;
  expression: string | null;
  role: 'key' | 'include' | 'auxiliary';
  descending: boolean | null;
  nulls: 'first' | 'last' | null;
  prefixLength: number | null;
  collation: string | null;
}
export interface RelationalIndex {
  name: string;
  method: string;
  unique: boolean;
  primary: boolean;
  valid: boolean | null;
  visible: boolean | null;
  constraintBacked: boolean;
  parts: RelationalIndexPart[];
  predicate: string | null;
  definition: string | null;
  comment: string | null;
}
export interface RelationalForeignKey {
  name: string;
  nameSource: 'catalog' | 'synthetic';
  columns: string[];
  referencedSchema: string;
  referencedTable: string;
  referencedColumns: string[];
  onUpdate: string;
  onDelete: string;
  match: string;
  deferrable: boolean | null;
  initiallyDeferred: boolean | null;
  validated: boolean | null;
  definition: string | null;
}
export interface RelationalConstraint {
  name: string;
  kind: 'primary' | 'unique' | 'foreign' | 'check' | 'exclusion' | 'not-null';
  columns: string[];
  definition: string | null;
  validated: boolean | null;
  deferrable: boolean | null;
  initiallyDeferred: boolean | null;
}
export interface RelationalTrigger {
  name: string;
  timing: string;
  events: string[];
  orientation: string;
  enabled: string | null;
  definition: string;
}
export interface RelationalTableStructure {
  connectionId: string;
  provider: RelationalProvider;
  schema: string;
  table: string;
  kind: DatabaseObjectKind;
  columns: DatabaseColumnInfo[];
  indexes: RelationalIndex[];
  foreignKeys: RelationalForeignKey[];
  constraints: RelationalConstraint[];
  triggers: RelationalTrigger[];
  properties: Record<string, string | null>;
  definition: {
    sql: string;
    origin: 'native' | 'reconstructed';
    warnings: string[];
  };
}
