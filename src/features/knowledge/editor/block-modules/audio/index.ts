import { SpeakerHigh } from '@phosphor-icons/react';
import { insertAtom } from '../insert';
import type { EditorBlockModule } from '../types';
import { createElement } from 'react';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { withNodeView } from '../../extensions/with-node-view';
import { AudioNodeView } from './audio-node-view';

export const AudioModule: EditorBlockModule = { name: 'audio', icon: SpeakerHigh, insert: insertAtom('audio'), decorate: (extensions, context) => withNodeView(extensions, 'audio', () => ReactNodeViewRenderer((props) => createElement(AudioNodeView, { ...props, localWorkspaceId: context.localWorkspaceId, workspaceId: context.scope?.workspaceId }))) };
