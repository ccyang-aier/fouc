/**
 * The E04 block editing extension set: Markdown shortcut input rules plus
 * the Notion/GDocs keyboard behaviors, all resolved against the shared E01
 * registry schema. Assembly point (one line in the editor surface):
 *
 * ```ts
 * extensions: [...createKnowledgeExtensions(), ...createBlockEditingExtensions(), …]
 * ```
 */

import type { Extensions } from '@tiptap/core';
import { BlockquoteInputRule } from './input-rules/blockquote-input-rule';
import { CodeBlockInputRule } from './input-rules/code-block-input-rule';
import { DividerInputRule } from './input-rules/divider-input-rule';
import { HeadingInputRule } from './input-rules/heading-input-rule';
import { ListInputRules } from './input-rules/list-input-rules';
import { MarkInputRules } from './input-rules/mark-input-rules';
import { TaskListInputRule } from './input-rules/task-list-input-rule';
import { BlockBackspaceKey } from './keyboard/block-backspace';
import { BlockEnterKey } from './keyboard/block-enter';
import { BlockMoveKey } from './keyboard/block-move';
import { ListIndentKey } from './keyboard/list-indent';

export { BlockquoteInputRule, CodeBlockInputRule, DividerInputRule, HeadingInputRule, ListInputRules, MarkInputRules, TaskListInputRule };
export { BlockBackspaceKey, BlockEnterKey, BlockMoveKey, ListIndentKey };
export { moveBlock } from './keyboard/block-move';
export { currentBlockFormat, insertMathBlock, setBlockFormat } from './format/block-format';
export type { BlockFormat, ListKind } from './format/block-format';
export { nearestAncestor, nearestListItem } from './prose-context';

/** All E04 behaviors as one extension list (input rules, keyboard editing). */
export function createBlockEditingExtensions(): Extensions {
  return [
    HeadingInputRule,
    ListInputRules,
    TaskListInputRule,
    BlockquoteInputRule,
    CodeBlockInputRule,
    DividerInputRule,
    MarkInputRules,
    BlockEnterKey,
    BlockBackspaceKey,
    ListIndentKey,
    BlockMoveKey,
  ];
}
