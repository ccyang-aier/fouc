import { type Locale, createTranslator } from '@/lib/i18n';
import { messages as connectorMessages } from './items.messages';
import type { Completion } from '@codemirror/autocomplete';
import type { RelationalProvider, SqlFormatterCase } from '@fouc/shared';
import {
  sameSqlJoinIdentifier,
  sameSqlJoinTable,
  sqlJoinRelatedTable,
  type SqlJoinRelationship,
  type SqlJoinTable,
} from '@fouc/shared/sql-join';
import { quoteCompletionIdentifier } from '../../sql-metadata-completion';
import type { SqlTableReference } from '../../sql-completion-context';
import type { SqlJoinContext } from './context';
import { sqlJoinInformation } from './tooltip';
export interface SqlJoinBoundReference extends SqlJoinTable {
  alias: string | null;
  reference: SqlTableReference;
}
export type SqlJoinCompletionItem = Completion & { sqlJoinTableTarget: boolean };
function identifier(name: string, provider: RelationalProvider): string {
  return quoteCompletionIdentifier(name, provider, true);
}
function qualifier(
  table: SqlJoinTable & {
    alias?: string | null;
  },
  provider: RelationalProvider,
): string {
  return table.alias
    ? identifier(table.alias, provider)
    : `${identifier(table.schema, provider)}.${identifier(table.table, provider)}`;
}
function keyword(word: string, settings: SqlFormatterCase): string {
  return settings === 'lower' ? word.toLowerCase() : word;
}
/** Quoted aliases and identifiers are preserved even when they contain spaces, dots or keywords. */
export function sqlJoinCondition(
  relation: SqlJoinRelationship,
  owner: SqlJoinTable & {
    alias?: string | null;
  },
  referenced: SqlJoinTable & {
    alias?: string | null;
  },
  provider: RelationalProvider,
  casing: SqlFormatterCase = 'upper',
): string {
  return relation.pairs
    .map(
      (pair) =>
        `${qualifier(owner, provider)}.${identifier(pair.owner, provider)} = ${qualifier(referenced, provider)}.${identifier(pair.referenced, provider)}`,
    )
    .join(` ${keyword('AND', casing)} `);
}
function aliasFor(
  table: string,
  references: readonly SqlJoinBoundReference[],
  provider: RelationalProvider,
): string {
  const words = table.split(/[^\p{L}\p{N}_]+|_+/u).filter(Boolean);
  const seed =
    words
      .map((word) => Array.from(word)[0])
      .join('')
      .slice(0, 12)
      .replace(/^[0-9]+/, '') || 'j';
  let alias = seed,
    suffix = 2;
  while (references.some((ref) => sameSqlJoinIdentifier(ref.alias ?? ref.table, alias, provider)))
    alias = seed + suffix++;
  return alias;
}
export function sqlJoinItems(
  context: SqlJoinContext,
  references: readonly SqlJoinBoundReference[],
  relationships: readonly SqlJoinRelationship[],
  provider: RelationalProvider,
  casing: SqlFormatterCase,
  coverage: string,
  locale?: Locale,
): SqlJoinCompletionItem[] {
  const tConnector = createTranslator(connectorMessages, locale);
  const items: SqlJoinCompletionItem[] = [];
  const emitted = new Set<string>();
  const add = (
    label: string,
    apply: string,
    relation: SqlJoinRelationship,
    detail: string,
    locale?: Locale,
  ) => {
    if (emitted.has(apply)) return;
    emitted.add(apply);
    items.push({
      label,
      apply,
      type: 'snippet',
      detail,
      boost: 80,
      sqlJoinTableTarget: context.mode === 'table' || context.mode === 'join',
      info: () => sqlJoinInformation(relation, apply, provider, coverage, locale),
    });
  };
  if (context.mode === 'on' || context.mode === 'using') {
    const latest = references.at(-1);
    if (!latest) return [];
    for (const previous of references.slice(0, -1))
      for (const relation of relationships) {
        const forward =
          sameSqlJoinTable(relation.owner, previous, provider) &&
          sameSqlJoinTable(relation.referenced, latest, provider);
        const reverse =
          sameSqlJoinTable(relation.owner, latest, provider) &&
          sameSqlJoinTable(relation.referenced, previous, provider);
        if (!forward && !reverse) continue;
        const owner = forward ? previous : latest,
          referenced = forward ? latest : previous;
        let condition = sqlJoinCondition(relation, owner, referenced, provider, casing);
        if (context.mode === 'using') {
          // USING can express only identically named pairs; it must not silently change join semantics.
          if (
            relation.pairs.some(
              (pair) => !sameSqlJoinIdentifier(pair.owner, pair.referenced, provider),
            )
          )
            continue;
          const names = relation.pairs.map((pair) => identifier(pair.owner, provider)).join(', ');
          add(
            names,
            context.usingParentheses ? names : `(${names})`,
            relation,
            tConnector('nativeForeignKeyUsingMatchingColumns'),
            locale,
          );
        } else {
          const matches = (value: string) =>
            value
              .replace(/["`]/g, '')
              .toLowerCase()
              .startsWith(context.prefix.replace(/["`]/g, '').toLowerCase());
          if (context.prefix && !matches(condition)) {
            const reversed = relation.pairs
              .map(
                (pair) =>
                  `${qualifier(referenced, provider)}.${identifier(pair.referenced, provider)} = ${qualifier(owner, provider)}.${identifier(pair.owner, provider)}`,
              )
              .join(` ${keyword('AND', casing)} `);
            if (!matches(reversed)) continue;
            condition = reversed;
          }
          add(
            condition,
            condition,
            relation,
            relation.pairs.length > 1
              ? tConnector('compositeForeignKeyOnCondition')
              : tConnector('nativeForeignKeyOnCondition'),
            locale,
          );
        }
      }
    return items;
  }
  for (const existing of references)
    for (const relation of relationships) {
      const related = sqlJoinRelatedTable(relation, existing, provider);
      if (!related) continue;
      if (
        context.mode === 'table' &&
        context.prefix &&
        !related.table.toLowerCase().startsWith(context.prefix.toLowerCase())
      )
        continue;
      if (
        context.position.qualifier.length &&
        !sameSqlJoinIdentifier(related.schema, context.position.qualifier[0], provider)
      )
        continue;
      if (
        references.some((ref) => sameSqlJoinTable(ref, related, provider)) &&
        !sameSqlJoinTable(existing, related, provider)
      )
        continue;
      const alias = aliasFor(related.table, references, provider);
      const joined = { ...related, alias };
      const forward = sameSqlJoinTable(relation.owner, existing, provider);
      const condition = sqlJoinCondition(
        relation,
        forward ? existing : joined,
        forward ? joined : existing,
        provider,
        casing,
      );
      const table = context.position.qualifier.length
        ? identifier(related.table, provider)
        : `${identifier(related.schema, provider)}.${identifier(related.table, provider)}`;
      const apply = `${context.mode === 'join' ? keyword('JOIN', casing) + ' ' : ''}${table} ${keyword('AS', casing)} ${identifier(alias, provider)} ${keyword('ON', casing)} ${condition}`;
      const direction = forward ? tConnector('referencedTarget') : tConnector('referencedTable');
      add(
        context.mode === 'join'
          ? `${keyword('JOIN', casing)} ${related.schema}.${related.table}`
          : related.table,
        apply,
        relation,
        `${direction} · ${relation.pairs.length > 1 ? tConnector('compositeForeignKey') : tConnector('actualForeignKey')}`,
        locale,
      );
    }
  return items;
}
