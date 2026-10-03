export { sqlDiagnosticsExtensions, sqlDiagnosticsStateField, setSqlDiagnosticMetadata } from './diagnostics/extension';
export type { SqlDiagnosticsState } from './diagnostics/extension';
export { buildSqlSemanticDiagnostics, buildSqlParserErrorDiagnostic, areSqlSemanticDiagnosticsEqual, sqlSemanticDiagnosticRangesForViewport } from './diagnostics/semantic-diagnostics';
export type { SqlSemanticDiagnostic, SqlSemanticDiagnosticSchema } from './diagnostics/semantic-diagnostics';
export { sqlAliasHighlightGroups } from './diagnostics/alias-highlights';
export { sqlReferenceNavigationAt, resolveSqlSemanticNavigationTarget } from './diagnostics/references';
