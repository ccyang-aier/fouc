import { Image as ImageIcon } from '@phosphor-icons/react';
import { insertAtom } from '../insert';
import type { EditorBlockModule } from '../types';
import { createElement } from 'react';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { withNodeView } from '../../extensions/with-node-view';
import { ImageNodeView } from './image-node-view';

export const ImageModule: EditorBlockModule = { name: 'image', icon: ImageIcon, insert: insertAtom('image'), decorate: (extensions, context) => withNodeView(extensions, 'image', () => ReactNodeViewRenderer((props) => createElement(ImageNodeView, { ...props, localWorkspaceId: context.localWorkspaceId, workspaceId: context.scope?.workspaceId }))) };
