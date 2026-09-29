import { Database } from '@phosphor-icons/react';
import { insertAtom } from '../insert';
import type { EditorBlockModule } from '../types';

export const DatabaseViewModule: EditorBlockModule = { name: 'databaseView', icon: Database, insert: insertAtom('databaseView') };
