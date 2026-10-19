import { expect, test } from 'bun:test';
import { createBoardTaskInputSchema, taskScheduleSchema, updateBoardTaskInputSchema } from './index';

const schedule = { startsAt: '2026-10-19T09:00:00+08:00', endsAt: '2026-10-19T10:00:00+08:00', url: 'https://example.com/review' };

test('schedules validate both instants together and allow only safe web links', () => {
  expect(taskScheduleSchema.parse(schedule)).toEqual(schedule);
  expect(taskScheduleSchema.safeParse({ ...schedule, endsAt: schedule.startsAt }).success).toBe(false);
  expect(taskScheduleSchema.safeParse({ ...schedule, endsAt: '2026-10-19T00:00:00Z' }).success).toBe(false);
  expect(taskScheduleSchema.safeParse({ ...schedule, startsAt: '2026-10-19T09:00:00' }).success).toBe(false);
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'https://', 'example.com']) expect(taskScheduleSchema.safeParse({ ...schedule, url }).success).toBe(false);
  expect(taskScheduleSchema.parse({ startsAt: schedule.startsAt, endsAt: schedule.endsAt }).url).toBe('');
});

test('task creation has an explicit unscheduled state; patches clear schedules atomically', () => {
  const base = { columnId: crypto.randomUUID(), title: 'Review' };
  expect(createBoardTaskInputSchema.parse(base).schedule).toBeNull();
  expect(createBoardTaskInputSchema.parse({ ...base, schedule }).schedule).toEqual(schedule);
  expect(updateBoardTaskInputSchema.parse({ schedule: null })).toEqual({ schedule: null });
  expect(updateBoardTaskInputSchema.safeParse({ schedule: { startsAt: schedule.startsAt } }).success).toBe(false);
});
