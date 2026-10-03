import { snippet, type Completion, type CompletionSource } from '@codemirror/autocomplete'
import { DEFAULT_SQL_SNIPPETS, type RelationalProvider, type SqlFormatterCase, type SqlSnippet } from '@fouc/shared'
import { sqlCompletionPosition } from './sql-completion-context'

const BUILTIN_FIELDS = /\b(idx_name|left_column|right_column|columns|values|condition|column|default|value|name|type|table)\b/g
const builtins = new Map(DEFAULT_SQL_SNIPPETS.map((entry) => [entry.id, entry]))

/** DBX templates become CodeMirror fields only while their built-in body is unchanged. */
export function sqlSnippetTemplate(entry: SqlSnippet, keywordCase: SqlFormatterCase = 'preserve'): string {
  if (builtins.get(entry.id)?.body !== entry.body) return entry.body
  const body = entry.body.replace(BUILTIN_FIELDS, (field) => `\${${field}}`)
  // Preserve field names: casing preferences apply to generated SQL, never user content.
  return keywordCase === 'lower' ? body.split(/(\$\{[^}]*\})/g).map((part) => part.startsWith('${') ? part : part.toLowerCase()).join('') : body
}

export function sqlSnippetItems(prefix: string, entries: readonly SqlSnippet[], keywordCase: SqlFormatterCase = 'preserve'): Completion[] {
  if (!prefix) return []
  const typed = prefix.toLowerCase()
  return entries.flatMap((entry) => {
    if (!entry.enabled) return []
    const trigger = entry.prefix.toLowerCase(), title = entry.label.toLowerCase()
    const matchesTrigger = trigger.startsWith(typed)
    const matchesTitle = typed.length > trigger.length && title.startsWith(typed)
    if (!matchesTrigger && !matchesTitle) return []
    const exactCustom = !builtins.has(entry.id) && trigger === typed
    const template = sqlSnippetTemplate(entry, keywordCase)
    return [{ label: matchesTrigger ? entry.prefix : entry.label, displayLabel: entry.label, type: 'snippet',
      detail: `${entry.prefix} · SQL 片段`, info: template, apply: snippet(template), boost: exactCustom ? 99 : matchesTrigger ? 30 : -40 }]
  })
}

/** Each call reads current connection settings through the editor callback bridge. */
export function sqlSnippetCompletion(provider: RelationalProvider, current: () => { snippets?: readonly SqlSnippet[]; keywordCase?: SqlFormatterCase }): CompletionSource {
  return (context) => {
    const position = sqlCompletionPosition(context.state.doc.toString(), context.pos, provider, context.state)
    if (!position || position.quoted || position.qualifier.length || !position.prefix) return null
    const trigger = context.matchBefore(/[\p{L}\p{N}_$-]+/u)
    const settings = current(), options = sqlSnippetItems(trigger?.text ?? position.prefix, settings.snippets ?? DEFAULT_SQL_SNIPPETS, settings.keywordCase)
    // Re-evaluate on every edit: typing past "sel" must reveal "select *" beside SELECT.
    return options.length ? { from: trigger?.from ?? position.from, to: position.to, options } : null
  }
}
