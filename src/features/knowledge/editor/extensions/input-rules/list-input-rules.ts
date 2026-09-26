/**
 * `- ` / `* ` / `+ ` wrap the paragraph in a bullet list, `1. ` (any number)
 * wraps it in an ordered list carrying that start number — the TipTap
 * `wrappingInputRule` conventions, including the ordered-list join predicate
 * that only continues an existing list when the numbering matches.
 */

import { Extension, wrappingInputRule } from '@tiptap/core';

export const ListInputRules = Extension.create({
  name: 'foucListInputRules',
  addInputRules() {
    const { bulletList, orderedList } = this.editor.schema.nodes;
    const rules = [];
    if (bulletList) {
      rules.push(wrappingInputRule({ find: /^\s*([-*+])\s$/, type: bulletList }));
    }
    if (orderedList) {
      rules.push(wrappingInputRule({
        find: /^\s*(\d+)\.\s$/,
        type: orderedList,
        getAttributes: (match) => ({ start: Number(match[1]) }),
        joinPredicate: (match, node) => node.childCount + node.attrs.start === Number(match[1]),
      }));
    }
    return rules;
  },
});
