import { TextHOne } from '@phosphor-icons/react';
import { setBlockFormat } from '../../extensions/format/block-format';
import type { EditorBlockModule } from '../types';
import { HeadingInputRule } from './input-rule';

const heading = (level: 1 | 2 | 3 | 4) => (editor: Parameters<EditorBlockModule['insert']>[0]) =>
  editor.chain().command(setBlockFormat({ kind: 'heading', level })).run();

export const HeadingModule: EditorBlockModule = {
  name: 'heading',
  icon: TextHOne,
  insert: heading(2),
  extensions: [HeadingInputRule],
  choices: ([1, 2, 3, 4] as const).map((level) => ({
    name: level === 2 ? 'heading' : `heading${level}`,
    title: ['主标题', '次标题', '小标题', '附加小标题'][level - 1],
    marker: `H${level}`,
    shortcut: `⌃ ⇧ ${level}`,
    keywords: [`h${level}`],
    insert: heading(level),
  })),
};
