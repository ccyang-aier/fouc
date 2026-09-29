import { Link } from '@phosphor-icons/react';
import { insertAtom } from '../insert';
import type { EditorBlockModule } from '../types';
import { applyBlockReferenceView } from './block-reference';

export const BlockReferenceModule: EditorBlockModule = {
  name: 'blockReference', icon: Link,
  insert: insertAtom('blockReference'),
  decorate: (extensions, context) => context.scope
    ? applyBlockReferenceView(extensions, { scope: context.scope, origin: context.origin ?? '' })
    : extensions,
};
