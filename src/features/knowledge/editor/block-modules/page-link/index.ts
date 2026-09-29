import { Article } from '@phosphor-icons/react';
import { insertAtom } from '../insert';
import type { EditorBlockModule } from '../types';

export const PageLinkModule: EditorBlockModule = { name: 'pageLink', icon: Article, insert: insertAtom('pageLink') };
