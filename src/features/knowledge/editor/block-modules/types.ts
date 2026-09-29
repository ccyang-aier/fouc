import type { ComponentType } from 'react';
import type { Editor, Extensions } from '@tiptap/core';
import type { PageScope } from '@fouc/shared/knowledge/contracts';

export type BlockInsertCommand = (editor: Editor) => boolean;
export type BlockIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

export interface BlockChoice {
  name: string;
  title: string;
  marker?: string;
  shortcut?: string;
  keywords?: readonly string[];
  insert: BlockInsertCommand;
}

/** Browser behavior owned by one shared-schema block. Protocol and persistence stay in shared/. */
export interface EditorBlockModule {
  name: string;
  icon: BlockIcon;
  insert: BlockInsertCommand;
  title?: string;
  shortcut?: string;
  choices?: readonly BlockChoice[];
  extensions?: Extensions;
  decorate?: (extensions: Extensions, context: { scope?: PageScope; origin?: string }) => Extensions;
}
