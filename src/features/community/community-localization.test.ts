import { expect, test } from 'bun:test';
import {
  initialCommunityAgents,
  initialCommunitySkills,
  buildCommunityDetail,
} from './community-data';
import {
  communityCategoryLabel,
  communityTagLabel,
  localizeCommunityAgent,
  localizeCommunitySkill,
} from './community-localization';

test('built-in catalog text changes language without changing category IDs or source records', () => {
  const original = initialCommunityAgents[0];
  const english = localizeCommunityAgent(original, 'en-US');
  expect(english.name).toBe('Code reviewer');
  expect(english.category).toBe('研发');
  expect(english.tags).toEqual(original.tags);
  expect(original.name).toBe('代码审查官');
  expect(communityCategoryLabel(english.category, 'en-US')).toBe('Development');
  expect(communityTagLabel('代码评审', 'en-US')).toBe('Code review');
  expect(communityTagLabel('我的标签', 'en-US')).toBe('我的标签');
});

test('custom record names and edited descriptions remain user content', () => {
  const edited = {
    ...initialCommunityAgents[0],
    name: '我的审查官',
    tagline: 'Review my private project',
  };
  expect(localizeCommunityAgent(edited, 'en-US').name).toBe('我的审查官');
  expect(localizeCommunityAgent(edited, 'zh-CN').tagline).toBe('Review my private project');
  const userItem = { ...initialCommunitySkills[0], id: 'user-skill', name: '评审清单' };
  expect(localizeCommunitySkill(userItem, 'en-US')).toBe(userItem);
});

test('detail metadata uses stable IDs while translated labels and content stay consistent', () => {
  const item = localizeCommunityAgent(initialCommunityAgents[0], 'en-US');
  const detail = buildCommunityDetail('agents', item, 'en-US');
  expect(detail.stats.find((stat) => stat.id === 'updated')?.value).toBe('2 days ago');
  expect(detail.stats.find((stat) => stat.id === 'rating')?.label).toBe('Rating');
  expect(detail.permissions[0]).toContain('Read task context');
  expect(detail.about).toContain('## Use cases');
});
