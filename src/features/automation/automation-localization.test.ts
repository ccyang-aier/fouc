import { expect, test } from 'bun:test';
import { initialAutomations } from './automation-data';
import { displayAutomation, getRunRecords } from './automation-localization';

test('automation presentation changes without rewriting the execution definition', () => {
  const original = initialAutomations[0];
  expect(displayAutomation(original, 'en-US').title).toBe('Daily work briefing');
  expect(displayAutomation(original, 'en-US').schedule).toBe('Daily at 08:30');
  expect(original.schedule).toBe('每天 08:30');
  expect(displayAutomation(original, 'en-US').status).toBe(original.status);
  expect(displayAutomation(original, 'en-US').agent).toBe(original.agent);
  const created = {
    ...original,
    id: 'AUTO-005',
    title: '每日工作简报',
    description: 'My instructions',
  };
  expect(displayAutomation(created, 'en-US').title).toBe('每日工作简报');
  expect(displayAutomation(created, 'zh-CN').description).toBe('My instructions');
});

test('run metadata is localized while result IDs remain stable for status styling', () => {
  const record = getRunRecords('en-US')[0];
  expect(record.automation).toBe('Project risk review');
  expect(record.startedAt).toBe('Today 10:24');
  expect(record.duration).toBe('1m 26s');
  expect(record.result).toBe('运行中');
});
