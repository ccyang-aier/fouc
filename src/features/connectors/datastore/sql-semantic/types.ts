import type { EditorState } from "@codemirror/state";
import type { RelationalProvider } from "@fouc/shared";

export type { SqlSemanticSpan, SqlSemanticToken, SqlSemanticTokenKind } from "@fouc/shared";
import type { SqlSemanticSpan, SqlSemanticToken } from "@fouc/shared";

export type SqlSemanticConfidence = "high" | "medium" | "low";

export type SqlSemanticStatementKind = "select" | "insert" | "update" | "delete" | "call" | "unknown";



export interface SqlSemanticIdentifierPart {
  raw: string;
  name: string;
  span: SqlSemanticSpan;
  quote?: string;
}

export interface SqlSemanticQualifiedName {
  parts: SqlSemanticIdentifierPart[];
  span: SqlSemanticSpan;
}

export type SqlSemanticRowSourceKind = "table" | "cte" | "subquery" | "table_function" | "mutation_target" | "unknown";

export interface SqlSemanticProjection {
  name: string;
  span: SqlSemanticSpan;
  alias?: string;
  aliasSpan?: SqlSemanticSpan;
}

/**
 * Traceable origin of a CTE output column that is a plain column reference
 * (`col` or `q.col`) in the CTE body. Computed outputs carry no origin.
 */
export interface SqlSemanticCteColumnOrigin {
  /** Qualifier chain before the column, e.g. `t` for `t.id`; empty for a bare `id`. */
  qualifierParts: string[];
  /** Referenced column name inside the CTE body. */
  column: string;
}

/** A named column produced by a CTE (`WITH c(a,b)` list item or SELECT projection). */
export interface SqlSemanticCteOutputColumn {
  /** Output column name as seen by the outer query. */
  name: string;
  /** Editor span to select when navigating to this output column inside the CTE body. */
  jumpSpan: SqlSemanticSpan;
  /** Present only when the body projection is a traceable plain column reference. */
  origin?: SqlSemanticCteColumnOrigin;
}

/** A star projection (`*` or `q.*`) inside a CTE body. */
export interface SqlSemanticCteStar {
  /** Span of the `*` token itself (navigation target). */
  starSpan: SqlSemanticSpan;
  /** Qualifier chain for `q.*`; empty for a bare `*`. */
  qualifierParts: string[];
}

export interface SqlSemanticRowSource {
  id: string;
  kind: SqlSemanticRowSourceKind;
  name: string;
  qualifierParts: string[];
  alias?: string;
  sourceSpan: SqlSemanticSpan;
  columns?: string[];
  columnAliases?: string[];
  /** CTE name token span — only populated on `cte:` definition row sources. */
  nameSpan?: SqlSemanticSpan;
  /** Parentheses enclosing a CTE or derived-table body. */
  bodySpan?: SqlSemanticSpan;
  definitionScope?: SqlSemanticSpan;
  recursive?: boolean;
  definitionId?: string;
  /**
   * Original body projection shapes on CTE definitions and enriched derived tables.
   * Positional output aliases are applied by the resolver after star expansion.
   */
  cteOutputs?: SqlSemanticCteOutputColumn[];
  /** Star projections of the body (CTE definitions and enriched derived tables). */
  cteStars?: SqlSemanticCteStar[];
  /** Row sources visible inside the body (physical tables + upstream CTEs) — same two owners. */
  bodySources?: SqlSemanticRowSource[];
}

export type SqlSemanticCursorKind = "table" | "schema" | "catalog" | "routine" | "column" | "alias_column" | "insert_column" | "update_column" | "delete_target" | "join_condition" | "star" | "keyword" | "suppressed";

export interface SqlSemanticCursorIntent {
  kind: SqlSemanticCursorKind;
  prefix: string;
  replacementRange: SqlSemanticSpan;
  qualifierParts: string[];
  targetSourceId?: string;
  expectedObjectKinds: Array<"database" | "schema" | "table" | "view" | "routine" | "procedure" | "function" | "column">;
  confidence: SqlSemanticConfidence;
  fallbackReason?: string;
}

export interface SqlSemanticStatement {
  kind: SqlSemanticStatementKind;
  span: SqlSemanticSpan;
}

export interface SqlSemanticModel {
  provider: RelationalProvider;
  cursor: number;
  tokens: SqlSemanticToken[];
  rowSources: SqlSemanticRowSource[];
  projections: SqlSemanticProjection[];
  cursorIntent: SqlSemanticCursorIntent;
}

export interface SqlSemanticBuildOptions {
  provider?: RelationalProvider;
  /**
   * Live CodeMirror state for the document being edited, when the caller has one (i.e. this is a
   * real editor completion request, not a pure-string test/utility call). When present and its
   * doc length matches the `sql` string being scanned, boundary-sensitive lookups prefer resolving
   * against its incrementally parsed syntax tree. The native lexer is the fallback for absent
   * trees and PostgreSQL dollar bodies/nested comments, preserving statement boundaries.
   */
  editorState?: EditorState;
}
