import { getLocale, type Locale } from '@/lib/i18n/locale';
import { translate } from '@/lib/i18n/messages';
import {
  initialCommunityAgents,
  initialCommunitySkills,
  type CommunityAgent,
  type CommunitySkill,
} from './community-data';
import { messages } from './i18n/community-data.messages';
import { communityLabels } from './i18n/community-labels.messages';

/** Only fields owned by these built-in catalog records are translated. */
function seedField(value: string, original: string | undefined, locale: Locale) {
  return value === original && Object.hasOwn(messages, value)
    ? translate(messages, value as keyof typeof messages, undefined, locale)
    : value;
}

export function localizeCommunityAgent(
  item: CommunityAgent,
  locale: Locale = getLocale(),
): CommunityAgent {
  const original = initialCommunityAgents.find((seed) => seed.id === item.id);
  if (!original) return item;
  return {
    ...item,
    name: seedField(item.name, original.name, locale),
    glyph: seedField(item.glyph, original.glyph, locale),
    tagline: seedField(item.tagline, original.tagline, locale),
    author: seedField(item.author, original.author, locale),
    highlights: item.highlights.map((text, index) =>
      seedField(text, original.highlights[index], locale),
    ),
  };
}

export function localizeCommunitySkill(
  item: CommunitySkill,
  locale: Locale = getLocale(),
): CommunitySkill {
  const original = initialCommunitySkills.find((seed) => seed.id === item.id);
  if (!original) return item;
  return {
    ...item,
    name: seedField(item.name, original.name, locale),
    summary: seedField(item.summary, original.summary, locale),
    author: seedField(item.author, original.author, locale),
  };
}

const tags = new Set(initialCommunityAgents.flatMap((item) => item.tags));
const officialIds = new Set(
  [...initialCommunityAgents, ...initialCommunitySkills]
    .filter((item) => item.author === 'Fouc 官方')
    .map((item) => item.id),
);
export function isOfficialCommunityResource(id: string) {
  return officialIds.has(id);
}
export function communityTagLabel(tag: string, locale: Locale) {
  return tags.has(tag) ? seedField(tag, tag, locale) : tag;
}
export function communityUpdatedLabel(value: string, locale: Locale) {
  const owned = [...initialCommunityAgents, ...initialCommunitySkills].some(
    (item) => item.updated === value,
  );
  return owned ? seedField(value, value, locale) : value;
}

export function communityCategoryLabel(category: string, locale: Locale) {
  return Object.hasOwn(communityLabels, category)
    ? translate(communityLabels, category as keyof typeof communityLabels, undefined, locale)
    : category;
}

export function communityTypeLabel(
  kind: 'all' | 'agents' | 'skills' | 'plugins' | 'prompts',
  locale: Locale,
) {
  return translate(communityLabels, kind, undefined, locale);
}
