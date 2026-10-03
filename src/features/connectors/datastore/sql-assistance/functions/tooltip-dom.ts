import type { RelationalProvider } from '@fouc/shared'
import { FUNCTION_CATEGORY_LABELS, type SqlFunctionDefinition } from './registry'
import type { SqlFunctionSignatureHelp } from './signature'

const PROVIDER_LABELS = { mysql: 'MySQL', postgres: 'PostgreSQL', sqlite: 'SQLite' }
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag)
  result.className = className
  if (text !== undefined) result.textContent = text
  return result
}
function functionHeader(definition: SqlFunctionDefinition, provider: RelationalProvider): HTMLElement {
  const header = element('div', 'fouc-sql-function-heading')
  header.append(element('span', 'fouc-sql-function-provider', PROVIDER_LABELS[provider]),
    element('span', 'fouc-sql-function-category', `${definition.kind === 'window' ? '窗口函数' : '内置函数'} · ${FUNCTION_CATEGORY_LABELS[definition.category]}`))
  return header
}
function description(definition: SqlFunctionDefinition, provider: RelationalProvider): string {
  if (definition.name === 'LENGTH') return provider === 'mysql' ? '返回字符串的字节长度；字符数量可使用 CHAR_LENGTH。' : '返回字符串的字符数量；二进制值返回字节长度。'
  if (definition.name === 'FORMAT' && provider === 'mysql') return '按指定小数位数格式化数值，并生成包含分组符号的字符串。'
  return definition.description
}

/** DBX's parameter emphasis, rendered with plain text nodes rather than trusted HTML. */
export function createSqlSignatureTooltipDom(help: SqlFunctionSignatureHelp, provider: RelationalProvider): HTMLElement {
  const dom = element('div', 'fouc-sql-function-tooltip fouc-sql-signature')
  dom.setAttribute('role', 'tooltip'); dom.setAttribute('aria-label', 'SQL 函数参数')
  dom.append(functionHeader(help.definition, provider))
  for (const overload of help.overloads) {
    const row = element('div', 'fouc-sql-function-signature')
    row.append(element('span', 'fouc-sql-function-name', help.name), '(')
    overload.parameterGroups[0].forEach((parameter, index) => {
      if (index) row.append(help.definition.parameterSeparator)
      const active = index === overload.activeParameter
      const argument = element('span', active ? 'fouc-sql-function-parameter is-active' : 'fouc-sql-function-parameter', parameter)
      if (active) { argument.dataset.activeParameter = 'true'; argument.setAttribute('aria-current', 'true') }
      row.append(argument)
    })
    row.append(')'); dom.append(row)
  }
  dom.append(element('p', 'fouc-sql-function-description', description(help.definition, provider)))
  return dom
}

/** The same provider-scoped definition powers completion info and hover documentation. */
export function createSqlFunctionDocumentationDom(definition: SqlFunctionDefinition, provider: RelationalProvider): HTMLElement {
  const dom = element('div', 'fouc-sql-function-tooltip fouc-sql-function-documentation')
  dom.setAttribute('role', 'tooltip'); dom.setAttribute('aria-label', 'SQL 函数说明')
  dom.append(functionHeader(definition, provider), element('code', 'fouc-sql-function-signature', `${definition.name}(${definition.parameters.join(definition.parameterSeparator)})`),
    element('p', 'fouc-sql-function-description', description(definition, provider)))
  const footer = element('div', 'fouc-sql-function-footer')
  footer.append(element('span', '', definition.parameters.length ? 'Tab 切换参数字段' : '无参数'))
  const link = element('a', 'fouc-sql-function-doc-link', '参考文档 ↗')
  link.href = definition.documentation; link.target = '_blank'; link.rel = 'noopener noreferrer'
  link.setAttribute('aria-label', `${PROVIDER_LABELS[provider]} ${definition.name} 参考文档`)
  footer.append(link); dom.append(footer)
  return dom
}
