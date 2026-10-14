import { createTranslator, type Locale } from '@/lib/i18n';
import { messages } from './sql-editor-language.messages';

const phraseKeys = {
  Find: 'find',
  Replace: 'replace',
  next: 'next',
  previous: 'previous',
  all: 'all',
  'match case': 'matchCase',
  regexp: 'regexp',
  'by word': 'byWord',
  replace: 'replaceAction',
  'replace all': 'replaceAll',
  close: 'close',
  'Go to line': 'goToLine',
  go: 'go',
  'replaced match on line $': 'replacedLine',
  'replaced $ matches': 'replacedMatches',
  'current match': 'currentMatch',
  'on line': 'onLine',
  'Folded lines': 'foldedLines',
  'Unfolded lines': 'unfoldedLines',
  to: 'to',
  'folded code': 'foldedCode',
  unfold: 'unfold',
  'Fold line': 'foldLine',
  'Unfold line': 'unfoldLine',
  Completions: 'completions',
  'Control character': 'controlCharacter',
} satisfies Record<string, keyof typeof messages>;

/** CodeMirror's supported phrase facet; editor documents and SQL remain untouched. */
export function sqlEditorPhrases(locale: Locale) {
  const t = createTranslator(messages, locale);
  return Object.fromEntries(Object.entries(phraseKeys).map(([phrase, key]) => [phrase, t(key)]));
}
