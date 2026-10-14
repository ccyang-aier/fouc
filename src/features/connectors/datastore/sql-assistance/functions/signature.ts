import { type Locale } from '@/lib/i18n';
import { tokenizeSqlSemantic, type RelationalProvider, type SqlSemanticToken } from '@fouc/shared';
import { sqlFunctionRegistry, type SqlFunctionDefinition } from './registry';
export const MAX_SQL_ASSISTANCE_DOCUMENT_CHARS = 128000;
export const SQL_SIGNATURE_SCAN_LIMIT_CHARS = 100000;
export type SqlFunctionSignatureHelpOverload = {
  signature: string;
  parameterGroups: readonly (readonly string[])[];
  activeGroup: number;
  activeParameter: number;
};
export type SqlFunctionSignatureHelp = {
  name: string;
  signature: string;
  parameters: readonly string[];
  activeParameter: number;
  overloads: readonly SqlFunctionSignatureHelpOverload[];
  activeOverload: number;
  definition: SqlFunctionDefinition;
  openParen: number;
};
type CallFrame = {
  bracket: '(' | '[';
  token?: SqlSemanticToken;
  qualified: boolean;
  open: number;
  commas: number;
};
/** DBX's current-call/parameter model, using the native lexer for escapes and comments. */
export function getSqlFunctionSignatureHelp(
  sql: string,
  cursor: number,
  provider: RelationalProvider,
  options?: {
    truncatedPrefix?: boolean;
  },
  locale?: Locale,
): SqlFunctionSignatureHelp | null {
  if (sql.length > MAX_SQL_ASSISTANCE_DOCUMENT_CHARS) return null;
  const end = Math.max(0, Math.min(sql.length, cursor));
  const from = Math.max(0, end - SQL_SIGNATURE_SCAN_LIMIT_CHARS);
  const prefix = sql.slice(from, end);
  const tokens = tokenizeSqlSemantic(prefix, provider);
  const last = tokens.at(-1);
  if (
    last &&
    ['string', 'comment', 'quoted_identifier'].includes(last.kind) &&
    last.span.start < prefix.length &&
    last.span.end === prefix.length
  )
    return null;
  const stack: CallFrame[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (['string', 'comment', 'quoted_identifier'].includes(token.kind)) continue;
    if (token.text === ';') {
      stack.length = 0;
      continue;
    }
    if (token.text === '(' || (provider === 'postgres' && token.text === '[')) {
      let previousIndex = index - 1;
      while (previousIndex >= 0 && tokens[previousIndex].kind === 'comment') previousIndex--;
      const previous = tokens[previousIndex];
      const name = token.text === '(' && previous?.kind === 'word' ? previous : undefined;
      let beforeNameIndex = previousIndex - 1;
      while (tokens[beforeNameIndex]?.kind === 'comment') beforeNameIndex--;
      const beforeName = tokens[beforeNameIndex];
      stack.push({
        bracket: token.text,
        token: name,
        qualified: beforeName?.text === '.',
        open: from + token.span.start,
        commas: 0,
      });
    } else if (token.text === ')' || (provider === 'postgres' && token.text === ']')) {
      const expected = token.text === ')' ? '(' : '[';
      if (stack.at(-1)?.bracket === expected) stack.pop();
    } else if (token.text === ',') {
      const active = stack.at(-1);
      if (active) active.commas++;
    } else if (token.kind === 'word') {
      const active = stack.at(-1);
      const separator =
        active?.token &&
        sqlFunctionRegistry(provider, locale)
          .get(active.token.text.toUpperCase())
          ?.parameterSeparator.trim()
          .toLowerCase();
      if (separator === token.normalized && active) active.commas = 1;
    }
  }
  // Plain grouping parentheses do not change the enclosing function's argument.
  const call = stack.findLast((frame) => frame.token);
  if (
    !call?.token ||
    call.qualified ||
    ((options?.truncatedPrefix || from > 0) && call.open === from)
  )
    return null;
  const name = call.token.text.toUpperCase();
  const definition = sqlFunctionRegistry(provider, locale).get(name);
  if (!definition) return null;
  const parameters = definition.parameters;
  const activeParameter = Math.min(call.commas, Math.max(0, parameters.length - 1));
  const signature = `${name}(${parameters.join(definition.parameterSeparator)})`;
  return {
    name,
    signature,
    parameters,
    activeParameter,
    definition,
    openParen: call.open,
    overloads: [{ signature, parameterGroups: [parameters], activeGroup: 0, activeParameter }],
    activeOverload: 0,
  };
}
/** Resolve a real call under the pointer, rather than any column with a function-like name. */
export function sqlFunctionAtPosition(
  sql: string,
  position: number,
  provider: RelationalProvider,
  locale?: Locale,
): {
  definition: SqlFunctionDefinition;
  from: number;
  to: number;
} | null {
  if (sql.length > MAX_SQL_ASSISTANCE_DOCUMENT_CHARS) return null;
  const tokens = tokenizeSqlSemantic(sql, provider);
  const index = tokens.findIndex(
    (token) => token.span.start <= position && position <= token.span.end,
  );
  const token = tokens[index];
  let beforeIndex = index - 1;
  while (tokens[beforeIndex]?.kind === 'comment') beforeIndex--;
  if (token?.kind !== 'word' || tokens[beforeIndex]?.text === '.') return null;
  let nextIndex = index + 1;
  while (tokens[nextIndex]?.kind === 'comment') nextIndex++;
  if (tokens[nextIndex]?.text !== '(') return null;
  const definition = sqlFunctionRegistry(provider, locale).get(token.text.toUpperCase());
  return definition ? { definition, from: token.span.start, to: token.span.end } : null;
}
