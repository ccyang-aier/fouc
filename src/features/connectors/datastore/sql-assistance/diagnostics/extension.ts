import { EditorSelection, StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView, hoverTooltip, keymap, type DecorationSet } from '@codemirror/view';
import type { RelationalProvider } from '@fouc/shared';
import type { SqlSemanticSpan } from '../../sql-semantic/types';
import { sqlAliasHighlightGroups, type SqlAliasHighlightGroup } from './alias-highlights';
import { containsPosition, MAX_SQL_ASSISTANCE_LENGTH } from './model-context';
import { sqlReferenceNavigationAt } from './references';
import { buildSqlSemanticDiagnostics, type SqlSemanticDiagnostic, type SqlSemanticDiagnosticSchema } from './semantic-diagnostics';

export type SqlDiagnosticsState = {
  sql: string;
  diagnostics: SqlSemanticDiagnostic[];
  aliases: SqlAliasHighlightGroup[];
  decorations: DecorationSet;
  metadata?: SqlSemanticDiagnosticSchema;
};

/** Apply a metadata snapshot to this editor only; stale SQL snapshots are ignored by diagnostics. */
export const setSqlDiagnosticMetadata = StateEffect.define<SqlSemanticDiagnosticSchema | undefined>();

function decorate(state: EditorState, diagnostics: readonly SqlSemanticDiagnostic[], aliases: readonly SqlAliasHighlightGroup[]): DecorationSet {
  const marks: Array<{ span: SqlSemanticSpan; mark: Decoration }> = diagnostics.map((diagnostic) => ({
    span: diagnostic.span,
    mark: Decoration.mark({ class: `cm-sql-diagnostic-${diagnostic.severity}`, attributes: { 'data-sql-diagnostic': diagnostic.message } }),
  }));
  const selection = state.selection.main;
  if (selection.empty) {
    const group = aliases.find((candidate) => containsPosition(candidate.declaration, selection.head) || candidate.references.some((span) => containsPosition(span, selection.head)));
    if (group) {
      marks.push({ span: group.declaration, mark: Decoration.mark({ class: 'cm-sql-alias-declaration' }) });
      for (const span of group.qualifiers) marks.push({ span, mark: Decoration.mark({ class: 'cm-sql-alias-reference' }) });
    }
  }
  return Decoration.set(marks.filter(({ span }) => span.start >= 0 && span.end > span.start && span.end <= state.doc.length).map(({ span, mark }) => mark.range(span.start, span.end)), true);
}

/** A document-owned state field makes retyping and tab switches discard old diagnostics immediately. */
export function sqlDiagnosticsStateField(provider: RelationalProvider): StateField<SqlDiagnosticsState> {
  const build = (state: EditorState, metadata?: SqlSemanticDiagnosticSchema): SqlDiagnosticsState => {
    if (state.doc.length > MAX_SQL_ASSISTANCE_LENGTH) return { sql: '', diagnostics: [], aliases: [], decorations: Decoration.none };
    const sql = state.doc.toString();
    const diagnostics = buildSqlSemanticDiagnostics(sql, provider, metadata);
    const aliases = sqlAliasHighlightGroups(sql, provider);
    return { sql, diagnostics, aliases, metadata, decorations: decorate(state, diagnostics, aliases) };
  };
  return StateField.define<SqlDiagnosticsState>({
    create: (state) => build(state),
    update(value, transaction) {
      let metadata = value.metadata;
      let changedMetadata = false;
      for (const effect of transaction.effects) if (effect.is(setSqlDiagnosticMetadata)) { metadata = effect.value; changedMetadata = true; }
      if (transaction.docChanged || changedMetadata) return build(transaction.state, metadata);
      if (transaction.selection) return { ...value, decorations: decorate(transaction.state, value.diagnostics, value.aliases) };
      return value;
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
  });
}

function jump(view: EditorView, sql: string, target: SqlSemanticSpan | undefined): boolean {
  if (!target || view.state.doc.toString() !== sql || target.start < 0 || target.end > view.state.doc.length) return false;
  view.dispatch({ selection: EditorSelection.single(target.start, target.end), scrollIntoView: true });
  view.focus();
  return true;
}

const assistanceTheme = EditorView.baseTheme({
  '.cm-sql-diagnostic-warning': { textDecorationLine: 'underline', textDecorationStyle: 'wavy', textDecorationColor: 'var(--warn-ink)', textUnderlineOffset: '4px' },
  '.cm-sql-diagnostic-error': { textDecorationLine: 'underline', textDecorationStyle: 'wavy', textDecorationColor: 'var(--err-ink)', textUnderlineOffset: '4px' },
  '.cm-sql-alias-declaration': { backgroundColor: 'color-mix(in srgb, var(--accent-ink) 15%, transparent)', borderBottom: '1px solid var(--accent-ink)', borderRadius: '2px' },
  '.cm-sql-alias-reference': { backgroundColor: 'color-mix(in srgb, var(--accent-ink) 9%, transparent)', borderRadius: '2px' },
  '.cm-sql-assistance-tooltip': { boxSizing: 'border-box', padding: '12px 14px', maxWidth: 'min(440px, calc(100vw - 32px))', color: 'var(--ink)', backgroundColor: 'var(--panel)', border: '1px solid var(--line-strong)', borderRadius: '8px', boxShadow: 'var(--floating-shadow)', fontFamily: 'var(--font-sans)', fontSize: '12px', lineHeight: '1.6' },
  '.cm-sql-assistance-tooltip strong': { display: 'block', fontSize: '13px', fontWeight: '600', lineHeight: '1.5', overflowWrap: 'anywhere' },
  '.cm-sql-assistance-description': { marginTop: '4px', color: 'var(--ink-soft)', overflowWrap: 'anywhere' },
  '.cm-sql-assistance-action': { marginTop: '9px', padding: '3px 7px', color: 'var(--accent-ink)', backgroundColor: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent-ink) 20%, transparent)', borderRadius: '4px', font: 'inherit', cursor: 'pointer' },
  '.cm-sql-assistance-action:focus-visible': { outline: '2px solid var(--accent-ink)', outlineOffset: '2px' },
  '.cm-sql-assistance-shortcut': { display: 'inline-block', marginLeft: '8px', color: 'var(--muted-strong)', fontSize: '10px' },
});

/** Actual editor integration for DBX static diagnostics, alias groups and CTE output lineage. */
export function sqlDiagnosticsExtensions(provider: RelationalProvider): Extension[] {
  const field = sqlDiagnosticsStateField(provider);
  const hover = hoverTooltip((view, position) => {
    const value = view.state.field(field);
    if (value.sql.length > MAX_SQL_ASSISTANCE_LENGTH) return null;
    const diagnostic = value.diagnostics.find((candidate) => containsPosition(candidate.span, position));
    const navigation = diagnostic ? null : sqlReferenceNavigationAt(value.sql, position, provider);
    const span = diagnostic?.span ?? navigation?.span;
    if (!span) return null;
    return {
      pos: span.start, end: span.end, above: true,
      create() {
        const dom = document.createElement('div');
        dom.className = 'cm-sql-assistance-tooltip';
        const title = document.createElement('strong');
        title.textContent = diagnostic ? (diagnostic.severity === 'error' ? 'SQL 语法问题' : 'SQL 提示') : navigation!.title;
        dom.append(title);
        const description = document.createElement('div');
        description.className = 'cm-sql-assistance-description';
        description.textContent = diagnostic?.message ?? navigation!.description;
        dom.append(description);
        if (navigation?.target) {
          const action = document.createElement('button');
          action.type = 'button';
          action.className = 'cm-sql-assistance-action';
          action.textContent = '查看定义';
          action.onclick = () => jump(view, value.sql, navigation.target);
          const shortcut = document.createElement('span');
          shortcut.className = 'cm-sql-assistance-shortcut';
          shortcut.textContent = 'Ctrl / ⌘ 单击 · F12';
          dom.append(action, shortcut);
        }
        return { dom };
      },
    };
  }, { hoverTime: 350, hideOn: (transaction) => transaction.docChanged || !!transaction.selection });
  const gotoDefinition = (view: EditorView): boolean => {
    const value = view.state.field(field);
    if (value.sql.length > MAX_SQL_ASSISTANCE_LENGTH) return false;
    const navigation = sqlReferenceNavigationAt(value.sql, view.state.selection.main.head, provider);
    return jump(view, value.sql, navigation?.target);
  };
  return [
    field, assistanceTheme, hover,
    keymap.of([{ key: 'F12', run: gotoDefinition }]),
    EditorView.domEventHandlers({
      click(event, view) {
        if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false;
        const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
        const value = view.state.field(field);
        if (position === null || value.sql.length > MAX_SQL_ASSISTANCE_LENGTH) return false;
        const navigation = sqlReferenceNavigationAt(value.sql, position, provider);
        if (!jump(view, value.sql, navigation?.target)) return false;
        event.preventDefault();
        return true;
      },
    }),
  ];
}
