import { syntaxTree, syntaxTreeAvailable } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { RelationalProvider } from '@fouc/shared';
import { findActiveSqlStatementSpan, tokenizeSqlSemantic } from '@fouc/shared';

type SyntaxNode = ReturnType<ReturnType<typeof syntaxTree>['resolve']>;

/** DBX's incremental statement-window lookup; fallback always preserves native lexical state. */
export function resolveSqlStatementWindow(sql: string, cursor: number, state: EditorState | undefined, provider: RelationalProvider): { from: number; to: number } {
  // Lezer parses dollar bodies as nested SQL. Nested Pg block comments also need the native lexer.
  const distrustTree = provider === 'postgres' && (/\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/.test(sql) || sql.includes('/*'));
  if (!distrustTree && state?.doc.length === sql.length && syntaxTreeAvailable(state, cursor)) {
    const tree = syntaxTree(state);
    let node: SyntaxNode | null = tree.resolve(cursor, -1);
    if (node.name === 'Script') node = tree.topNode.childBefore(cursor + 1);
    if (node && !node.type.isError) {
      while (node && node.name !== 'Statement') node = node.parent;
      if (node && cursor >= node.from && (cursor <= node.to || !state.doc.sliceString(node.to, cursor).trim())) {
        const last = node.lastChild;
        return { from: node.from, to: last?.name === ';' ? last.from : node.to };
      }
    }
  }
  const range = findActiveSqlStatementSpan(sql, tokenizeSqlSemantic(sql, provider), cursor);
  return { from: range.start, to: range.end };
}
