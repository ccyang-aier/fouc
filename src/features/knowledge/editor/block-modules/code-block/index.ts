import { Code } from '@phosphor-icons/react';
import { setBlockFormat } from '../../extensions/format/block-format';
import type { EditorBlockModule } from '../types';
import { CodeBlockInputRule } from './input-rule';

export const CodeBlockModule: EditorBlockModule = {
  name: 'codeBlock',
  icon: Code,
  extensions: [CodeBlockInputRule],
  insert: (editor) => editor.chain().command(setBlockFormat({ kind: 'codeBlock' })).run(),
};
