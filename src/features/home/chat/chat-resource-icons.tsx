import { PlugsConnected, PuzzlePiece, ChatCenteredText } from '@phosphor-icons/react';
import { SkillIcon } from '@/components/icons/skill-icon';
import type { ComposerResourceKind } from '@/features/community/composer-catalog';

export const resourceKindIcons = {
  skills: SkillIcon, mcp: PlugsConnected, plugins: PuzzlePiece, prompts: ChatCenteredText,
} satisfies Record<ComposerResourceKind, unknown>;
