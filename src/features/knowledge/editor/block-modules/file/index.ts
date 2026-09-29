import { Article } from '@phosphor-icons/react';
import { insertAtom } from '../insert';
import type { EditorBlockModule } from '../types';

export const FileModule: EditorBlockModule = { name: 'file', icon: Article, insert: insertAtom('file') };
