import { Sparkle } from '@phosphor-icons/react';
import { insertBuiltNodes } from '../insert';
import type { EditorBlockModule } from '../types';

export const AiBlockModule: EditorBlockModule = {
  name: 'aiBlock', icon: Sparkle,
  insert: insertBuiltNodes((nodes) => [nodes.aiBlock.create(null, [nodes.paragraph.create()])]),
};
