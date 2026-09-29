import { Image as ImageIcon } from '@phosphor-icons/react';
import { insertAtom } from '../insert';
import type { EditorBlockModule } from '../types';

export const ImageModule: EditorBlockModule = { name: 'image', icon: ImageIcon, insert: insertAtom('image') };
