import { Function as FunctionIcon } from '@phosphor-icons/react';
import { insertMathBlock } from '../../extensions/format/block-format';
import type { EditorBlockModule } from '../types';

export const MathModule: EditorBlockModule = {
  name: 'math',
  icon: FunctionIcon,
  insert: (editor) => editor.chain().command(insertMathBlock).run(),
};
