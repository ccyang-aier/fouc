import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './tooltip-dom.messages';
import type { RelationalProvider } from '@fouc/shared';
import { FUNCTION_CATEGORY_LABELS, type SqlFunctionDefinition } from './registry';
import type { SqlFunctionSignatureHelp } from './signature';
const PROVIDER_LABELS = { mysql: 'MySQL', postgres: 'PostgreSQL', sqlite: 'SQLite' };
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}
function functionHeader(
  definition: SqlFunctionDefinition,
  provider: RelationalProvider,
  locale?: Locale,
): HTMLElement {
  const tConnector = createTranslator(connectorMessages, locale);
  const header = element('div', 'fouc-sql-function-heading');
  header.append(
    element('span', 'fouc-sql-function-provider', PROVIDER_LABELS[provider]),
    element(
      'span',
      'fouc-sql-function-category',
      `${definition.kind === 'window' ? tConnector('windowFunctions') : tConnector('builtInFunctions')} · ${FUNCTION_CATEGORY_LABELS(locale)[definition.category]}`,
    ),
  );
  return header;
}
function description(
  definition: SqlFunctionDefinition,
  provider: RelationalProvider,
  locale?: Locale,
): string {
  const tConnector = createTranslator(connectorMessages, locale);
  if (definition.name === 'LENGTH')
    return provider === 'mysql'
      ? tConnector('returnsTheByteLengthOfAStringUseCharLength')
      : tConnector('returnsTheCharacterCountOfAStringOrByteLength');
  if (definition.name === 'FORMAT' && provider === 'mysql')
    return tConnector('formatsANumberToTheSpecifiedDecimalPlacesWithGrouping');
  return definition.description;
}
/** DBX's parameter emphasis, rendered with plain text nodes rather than trusted HTML. */
export function createSqlSignatureTooltipDom(
  help: SqlFunctionSignatureHelp,
  provider: RelationalProvider,
  locale?: Locale,
): HTMLElement {
  const tConnector = createTranslator(connectorMessages, locale);
  const dom = element('div', 'fouc-sql-function-tooltip fouc-sql-signature');
  dom.setAttribute('role', 'tooltip');
  dom.setAttribute('aria-label', tConnector('sqlFunctionParameters'));
  dom.append(functionHeader(help.definition, provider, locale));
  for (const overload of help.overloads) {
    const row = element('div', 'fouc-sql-function-signature');
    row.append(element('span', 'fouc-sql-function-name', help.name), '(');
    overload.parameterGroups[0].forEach((parameter, index) => {
      if (index) row.append(help.definition.parameterSeparator);
      const active = index === overload.activeParameter;
      const argument = element(
        'span',
        active ? 'fouc-sql-function-parameter is-active' : 'fouc-sql-function-parameter',
        parameter,
      );
      if (active) {
        argument.dataset.activeParameter = 'true';
        argument.setAttribute('aria-current', 'true');
      }
      row.append(argument);
    });
    row.append(')');
    dom.append(row);
  }
  dom.append(
    element('p', 'fouc-sql-function-description', description(help.definition, provider, locale)),
  );
  return dom;
}
/** The same provider-scoped definition powers completion info and hover documentation. */
export function createSqlFunctionDocumentationDom(
  definition: SqlFunctionDefinition,
  provider: RelationalProvider,
  locale?: Locale,
): HTMLElement {
  const tConnector = createTranslator(connectorMessages, locale);
  const dom = element('div', 'fouc-sql-function-tooltip fouc-sql-function-documentation');
  dom.setAttribute('role', 'tooltip');
  dom.setAttribute('aria-label', tConnector('sqlFunctionHelp'));
  dom.append(
    functionHeader(definition, provider, locale),
    element(
      'code',
      'fouc-sql-function-signature',
      `${definition.name}(${definition.parameters.join(definition.parameterSeparator)})`,
    ),
    element('p', 'fouc-sql-function-description', description(definition, provider, locale)),
  );
  const footer = element('div', 'fouc-sql-function-footer');
  footer.append(
    element(
      'span',
      '',
      definition.parameters.length
        ? tConnector('tabSwitchesParameterFields')
        : tConnector('noParameters'),
    ),
  );
  const link = element('a', 'fouc-sql-function-doc-link', tConnector('documentation'));
  link.href = definition.documentation;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute(
    'aria-label',
    tConnector('documentation2648', {
      p0: String(PROVIDER_LABELS[provider]),
      p1: String(definition.name),
    }),
  );
  footer.append(link);
  dom.append(footer);
  return dom;
}
