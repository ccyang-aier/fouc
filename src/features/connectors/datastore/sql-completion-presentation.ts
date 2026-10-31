import { createTranslator } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-completion-presentation.messages';
import type { autocompletion, Completion } from '@codemirror/autocomplete';
import { createCompletionIcon, type CompletionIconKind } from '@/components/icons/dom-icon';
function completionIconKind(completion: Completion): CompletionIconKind {
  const type = completion.type?.split(' ')[0];
  if (type === 'class' || type === 'interface') return 'table';
  if (type === 'method') return 'function';
  if (type === 'variable' || type === 'constant') return 'property';
  return ['keyword', 'function', 'table', 'namespace', 'snippet', 'property', 'text'].includes(type ?? '') ? (type as CompletionIconKind) : 'text';
}
function renderCompletionIcon(completion: Completion): HTMLElement {
  const kind = completionIconKind(completion);
  const container = document.createElement('span');
  container.className = 'fouc-sql-completion-icon';
  container.dataset.kind = kind;
  container.setAttribute('aria-hidden', 'true');
  container.append(createCompletionIcon(kind));
  return container;
}
function renderCompletionShortcut(): HTMLElement {
  const tConnector = createTranslator(connectorMessages);
  const key = document.createElement('kbd');
  key.className = 'fouc-sql-completion-key';
  key.textContent = '↵ Enter';
  key.title = tConnector('pressEnterToInsert');
  key.setAttribute('aria-hidden', 'true');
  return key;
}
export const sqlCompletionPresentation = {
  tooltipClass: () => 'fouc-sql-completion',
  icons: false,
  addToOptions: [
    { position: 20, render: renderCompletionIcon },
    { position: 90, render: renderCompletionShortcut },
  ],
} satisfies NonNullable<Parameters<typeof autocompletion>[0]>;
