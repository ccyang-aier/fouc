import { config, icon } from '@fortawesome/fontawesome-svg-core';
import { faKey } from '@fortawesome/free-solid-svg-icons/faKey';
import { faSquareRootVariable } from '@fortawesome/free-solid-svg-icons/faSquareRootVariable';
import { faTable } from '@fortawesome/free-solid-svg-icons/faTable';
import { faDatabase } from '@fortawesome/free-solid-svg-icons/faDatabase';
import { faCode } from '@fortawesome/free-solid-svg-icons/faCode';
import { faTableColumns } from '@fortawesome/free-solid-svg-icons/faTableColumns';
import { faFont } from '@fortawesome/free-solid-svg-icons/faFont';

config.autoAddCss = false;

/** CodeMirror owns its DOM outside React; it still uses the same official catalog. */
const completionGlyphs = { keyword: faKey, function: faSquareRootVariable, table: faTable, namespace: faDatabase, snippet: faCode, property: faTableColumns, text: faFont };
export type CompletionIconKind = keyof typeof completionGlyphs;

export function createCompletionIcon(kind: CompletionIconKind): Element {
  return icon(completionGlyphs[kind], { attributes: { 'aria-hidden': 'true', 'data-icon-library': 'fa7-solid' } }).node[0];
}
