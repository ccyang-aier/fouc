import { Globe } from '@phosphor-icons/react';
import { insertAtom } from '../insert';
import type { EditorBlockModule } from '../types';

export const EmbedModule: EditorBlockModule = { name: 'embed', icon: Globe, insert: insertAtom('embed') };
