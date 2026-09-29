import { Video } from '@phosphor-icons/react';
import { insertAtom } from '../insert';
import type { EditorBlockModule } from '../types';
import { createElement } from 'react';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { withNodeView } from '../../extensions/with-node-view';
import { VideoNodeView } from './video-node-view';

export const VideoModule: EditorBlockModule = { name: 'video', icon: Video, insert: insertAtom('video'), decorate: (extensions, context) => withNodeView(extensions, 'video', () => ReactNodeViewRenderer((props) => createElement(VideoNodeView, { ...props, localWorkspaceId: context.localWorkspaceId, workspaceId: context.scope?.workspaceId }))) };
