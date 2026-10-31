import { PlugsConnected, PuzzlePiece, ChatCenteredText } from '@/components/icons';
import { SkillIcon } from '@/components/icons/skill-icon';
import type { ComposerResourceKind } from '@/features/community/composer-catalog';

export const resourceKindIcons = {
  skills: SkillIcon, mcp: PlugsConnected, plugins: PuzzlePiece, prompts: ChatCenteredText,
} satisfies Record<ComposerResourceKind, unknown>;
