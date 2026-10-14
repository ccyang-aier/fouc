import type { EditorState } from '@codemirror/state';
import type { RelationalProvider } from '@fouc/shared';
import { buildSqlSemanticModel } from './sql-semantic/model';
import { visibleCteDefinitions, visibleSqlSources } from './sql-semantic/sources';
import type { SqlSemanticModel, SqlSemanticRowSource } from './sql-semantic/types';

export type SqlTableReference = {
  schema: string | null;
  table: string;
  alias: string | null;
  parent: number | null;
  depth: number;
  from: number;
  virtual: boolean;
  source: SqlSemanticRowSource;
};
export type SqlCompletionPosition = {
  from: number;
  to: number;
  prefix: string;
  quoted: boolean;
  qualifier: string[];
  tableContext: boolean;
  references: SqlTableReference[];
  virtualTables: string[];
  model: SqlSemanticModel;
};

/** One semantic model owns keyword suppression, source scope and native field completion. */
export function sqlCompletionPosition(
  text: string,
  cursor: number,
  provider: RelationalProvider,
  editorState?: EditorState,
): SqlCompletionPosition | null {
  const model = buildSqlSemanticModel(text, cursor, { provider, editorState });
  if (model.cursorIntent.kind === 'suppressed') return null;
  const intent = model.cursorIntent;
  const token = model.tokens.find((item) => item.span.start < cursor && cursor <= item.span.end);
  const sources = visibleSqlSources(model);
  return {
    from: intent.replacementRange.start,
    to:
      token?.kind === 'word' || (token?.kind === 'quoted_identifier' && token.closed)
        ? token.span.end
        : intent.replacementRange.end,
    prefix: intent.prefix,
    quoted: token?.kind === 'quoted_identifier',
    qualifier: intent.qualifierParts,
    tableContext: ['table', 'schema', 'catalog', 'delete_target'].includes(intent.kind),
    virtualTables: visibleCteDefinitions(model).map((source) => source.name),
    references: sources.map((source) => {
      const token = model.tokens.find((item) => item.span.start === source.sourceSpan.start);
      return {
        schema: source.qualifierParts.at(-1) ?? null,
        table: source.name,
        alias: source.alias ?? null,
        parent: token?.parent ?? null,
        depth: token?.depth ?? 0,
        from: source.sourceSpan.start,
        virtual: source.kind !== 'table' && source.kind !== 'mutation_target',
        source,
      };
    }),
    model,
  };
}
