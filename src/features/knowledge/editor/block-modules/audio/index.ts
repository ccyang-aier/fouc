import { SpeakerHigh } from '@phosphor-icons/react';
import { insertAtom } from '../insert';
import type { EditorBlockModule } from '../types';

export const AudioModule: EditorBlockModule = { name: 'audio', icon: SpeakerHigh, insert: insertAtom('audio') };
