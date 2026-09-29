import { Video } from '@phosphor-icons/react';
import { insertAtom } from '../insert';
import type { EditorBlockModule } from '../types';

export const VideoModule: EditorBlockModule = { name: 'video', icon: Video, insert: insertAtom('video') };
