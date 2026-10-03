import type { RelationalProvider } from '@fouc/shared'

/** DBX semantic/tokens and SQL completion lookup adapted to Fouc's native dialects. */
export type SqlToken = { kind: 'word' | 'identifier' | 'string' | 'comment' | 'punctuation' | 'operator'; text: string; from: number; to: number; depth: number; parent: number | null; quote?: string; closed?: boolean }
const wordStart = /[\p{ID_Start}_@$]/u, wordPart = /[\p{ID_Continue}_@$]/u
export function sqlTokens(text: string, provider: RelationalProvider): SqlToken[] {
  const tokens: SqlToken[] = []
  let position = 0, depth = 0
  const scopes: number[] = []
  const push = (kind: SqlToken['kind'], from: number, quote?: string, closed?: boolean) => tokens.push({ kind, text: text.slice(from, position), from, to: position, depth, parent: scopes.at(-1) ?? null, quote, closed })
  while (position < text.length) {
    const from = position, char = String.fromCodePoint(text.codePointAt(position)!), next = text[position + 1]
    if (/\s/u.test(char)) { position += char.length; continue }
    if ((char === '-' && next === '-' && (provider !== 'mysql' || position + 2 === text.length || /\s/.test(text[position + 2]))) || (provider === 'mysql' && char === '#')) {
      while (position < text.length && !/[\r\n]/.test(text[position])) position++
      push('comment', from); continue
    }
    if (char === '/' && next === '*') {
      position += 2; let nesting = 1
      while (position < text.length && nesting) {
        if (text.startsWith('*/', position)) { nesting--; position += 2 }
        else if (provider === 'postgres' && text.startsWith('/*', position)) { nesting++; position += 2 }
        else position++
      }
      push('comment', from, undefined, nesting === 0); continue
    }
    if (provider === 'postgres' && char === '$') {
      const marker = /^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/.exec(text.slice(position))?.[0]
      if (marker) {
        const end = text.indexOf(marker, position + marker.length)
        position = end < 0 ? text.length : end + marker.length
        push('string', from, marker, end >= 0); continue
      }
    }
    const identifierQuote = char === '"' && provider !== 'mysql' || char === '`' && provider !== 'postgres' || char === '[' && provider === 'sqlite'
    if (char === "'" || char === '"' || identifierQuote) {
      const closing = char === '[' ? ']' : char
      const previous = tokens.at(-1), escaped = provider === 'mysql' || provider === 'postgres' && previous?.kind === 'word' && previous.text.toLowerCase() === 'e' && previous.to === from
      position++; let closed = false
      while (position < text.length) {
        if (!identifierQuote && escaped && text[position] === '\\') { position = Math.min(text.length, position + 2); continue }
        if (text[position] === closing) {
          position++
          if (char !== '[' && text[position] === closing) { position++; continue }
          closed = true; break
        }
        position++
      }
      push(identifierQuote ? 'identifier' : 'string', from, char, closed); continue
    }
    if (wordStart.test(char)) {
      position += char.length
      while (position < text.length) { const part = String.fromCodePoint(text.codePointAt(position)!); if (!wordPart.test(part)) break; position += part.length }
      push('word', from); continue
    }
    if ('(),.;'.includes(char)) {
      if (char === ')') { depth = Math.max(0, depth - 1); scopes.pop() }
      position++; push('punctuation', from)
      if (char === '(') { depth++; scopes.push(from) }
      continue
    }
    position += char.length; push('operator', from)
  }
  return tokens
}
export function sqlIdentifier(token: SqlToken, provider?: RelationalProvider): string {
  if (token.kind !== 'identifier') return provider === 'postgres' ? token.text.toLowerCase() : token.text
  const quote = token.quote!, end = token.closed ? -1 : undefined
  return token.text.slice(1, end).replaceAll(quote + quote, quote)
}
function isIdentifier(token?: SqlToken): token is SqlToken & { kind: 'word' | 'identifier' } { return token?.kind === 'word' || token?.kind === 'identifier' }
const stopWords = new Set('where group having order limit offset union intersect except returning window on using join left right inner outer cross natural full set values from into select'.split(' '))
export type SqlTableReference = { schema: string | null; table: string; alias: string | null; parent: number | null; depth: number; from: number; virtual: boolean }
export type SqlCompletionPosition = { from: number; to: number; prefix: string; quoted: boolean; qualifier: string[]; tableContext: boolean; references: SqlTableReference[]; virtualTables: string[] }

export function sqlCompletionPosition(text: string, cursor: number, provider: RelationalProvider): SqlCompletionPosition | null {
  const tokens = sqlTokens(text, provider), position = Math.max(0, Math.min(cursor, text.length))
  const nameKey = (name: string) => provider === 'sqlite' ? name.toLowerCase() : name
  const tokenIndex = tokens.findIndex((item) => item.from < position && item.to >= position)
  const current = tokens[tokenIndex]
  if (current && (current.kind === 'comment' || current.kind === 'string')) return null
  let from = position, to = position, prefix = '', quoted = false, before = tokenIndex >= 0 ? tokenIndex - 1 : tokens.findLastIndex((item) => item.to <= position)
  if (isIdentifier(current)) {
    from = current.from; quoted = current.kind === 'identifier'; to = current.kind === 'word' || current.closed ? current.to : position
    prefix = quoted ? text.slice(from + 1, position).replaceAll(current.quote! + current.quote!, current.quote!) : text.slice(from, position)
    if (quoted && current.closed && position === current.to) prefix = sqlIdentifier(current, provider)
  } else if (current?.text === '.') before = tokenIndex
  else if (current && current.kind !== 'punctuation') return null
  const qualifier: string[] = []
  while (tokens[before]?.text === '.' && isIdentifier(tokens[before - 1])) { qualifier.unshift(sqlIdentifier(tokens[before - 1], provider)); before -= 2 }
  let start = 0, end = text.length
  for (const item of tokens) if (item.text === ';' && item.kind === 'punctuation' && item.depth === 0) {
    if (item.to <= position) start = item.to
    else { end = item.from; break }
  }
  const active = tokens.filter((item) => item.from >= start && item.from < end && item.kind !== 'comment')
  // A CTE shadows a database object with the same name; never fetch it as a real table.
  const virtual = new Map<number | null, Set<string>>()
  for (let i = 0; i < active.length; i++) {
    if (active[i].kind !== 'word' || active[i].text.toLowerCase() !== 'with') continue
    const parent = active[i].parent; let index = i + 1
    if (active[index]?.text.toLowerCase() === 'recursive') index++
    while (isIdentifier(active[index])) {
      const name = sqlIdentifier(active[index], provider); index++
      if (active[index]?.text === '(') {
        index++
        while (index < active.length && !(active[index].text === ')' && active[index].parent === parent)) index++
        index++
      }
      if (active[index]?.text.toLowerCase() !== 'as') break
      index++
      while (active[index]?.kind === 'word' && ['not', 'materialized'].includes(active[index].text.toLowerCase())) index++
      if (active[index]?.text !== '(') break
      const names = virtual.get(parent) ?? new Set<string>(); names.add(name); virtual.set(parent, names)
      index++
      while (index < active.length && !(active[index].text === ')' && active[index].parent === parent)) index++
      index++
      if (active[index]?.text !== ',') break
      index++
    }
  }
  const references: SqlTableReference[] = []
  const fromDepths = new Set<number>()
  for (let i = 0; i < active.length; i++) {
    const item = active[i], lower = item.kind === 'word' ? item.text.toLowerCase() : ''
    if (item.text === ')') for (const level of fromDepths) if (level > item.depth) fromDepths.delete(level)
    if (['where', 'group', 'having', 'order', 'limit', 'union', 'returning'].includes(lower)) fromDepths.delete(item.depth)
    const startsTable = ['from', 'join', 'update', 'into'].includes(lower) || item.text === ',' && fromDepths.has(item.depth)
    if (lower === 'from') fromDepths.add(item.depth)
    if (!startsTable) continue
    let index = i + 1
    if (active[index]?.kind === 'word' && ['only', 'lateral'].includes(active[index].text.toLowerCase())) index++
    if (!isIdentifier(active[index])) continue
    const first = active[index], parts = [sqlIdentifier(first, provider)]
    while (active[index + 1]?.text === '.' && isIdentifier(active[index + 2])) { index += 2; parts.push(sqlIdentifier(active[index], provider)) }
    if (active[index + 1]?.text === '(' || parts.length > 2) continue
    let alias: string | null = null
    if (active[index + 1]?.kind === 'word' && active[index + 1].text.toLowerCase() === 'as') index++
    const candidate = active[index + 1]
    if (isIdentifier(candidate) && (candidate.kind === 'identifier' || !stopWords.has(candidate.text.toLowerCase()))) alias = sqlIdentifier(candidate, provider)
    let ancestor: number | null = first.parent, isVirtual = false
    while (parts.length === 1) {
      if ([...virtual.get(ancestor) ?? []].some((name) => nameKey(name) === nameKey(parts[0]))) { isVirtual = true; break }
      if (ancestor === null) break
      ancestor = tokens.find((item) => item.from === ancestor)?.parent ?? null
    }
    references.push({ schema: parts.length === 2 ? parts[0] : null, table: parts.at(-1)!, alias, parent: first.parent, depth: first.depth, from: first.from, virtual: isVirtual })
  }
  const previous = tokens[before]
  const clause = tokens.slice(0, before).findLast((item) => item.parent === previous?.parent && item.kind === 'word' && ['select', 'from', 'join', 'on', 'where', 'group', 'having', 'order', 'set', 'values'].includes(item.text.toLowerCase()))
  const tableContext = Boolean(previous?.kind === 'word' && ['from', 'join', 'update', 'into'].includes(previous.text.toLowerCase()) || previous?.text === ',' && clause && ['from', 'join'].includes(clause.text.toLowerCase()))
  const scope = current?.parent ?? tokens.findLast((item) => item.to <= position)?.parent ?? null
  const visible = new Set<number | null>([null]); let parent = scope
  while (parent !== null) { visible.add(parent); parent = tokens.find((item) => item.from === parent)?.parent ?? null }
  const visibleRefs = references.filter((ref) => visible.has(ref.parent))
  const virtualTables = [...new Set([...virtual].filter(([parent]) => visible.has(parent)).flatMap(([, names]) => [...names]))]
  return { from, to, prefix, quoted, qualifier, tableContext, virtualTables, references: visibleRefs.filter((ref) => !visibleRefs.some((other) => other.depth > ref.depth && nameKey(other.alias ?? other.table) === nameKey(ref.alias ?? ref.table))) }
}
