import { getLocale, type Locale } from '@/lib/i18n/locale';
import { translate } from '@/lib/i18n/messages';
import { initialAutomations, runRecords, type AutomationDefinition } from './automation-data';
import { messages } from './i18n/automation-data.messages';

function systemLabel(value: string, locale: Locale) {
  return Object.hasOwn(messages, value)
    ? translate(messages, value as keyof typeof messages, undefined, locale)
    : value;
}

/** Built-in presentation fields never overwrite the canonical automation or user instructions. */
export function displayAutomation(
  item: AutomationDefinition,
  locale: Locale = getLocale(),
): AutomationDefinition {
  const seed = initialAutomations.find((original) => original.id === item.id);
  return {
    ...item,
    title: seed && seed.title === item.title ? systemLabel(item.title, locale) : item.title,
    description:
      seed && seed.description === item.description
        ? systemLabel(item.description, locale)
        : item.description,
    schedule: systemLabel(item.schedule, locale),
    timezone: systemLabel(item.timezone, locale),
    lastRun: systemLabel(item.lastRun, locale),
    lastRunDetail: systemLabel(item.lastRunDetail, locale),
    notification: systemLabel(item.notification, locale),
    timeout: systemLabel(item.timeout, locale),
  };
}

export function getRunRecords(locale: Locale = getLocale()) {
  return runRecords.map((record) => ({
    ...record,
    automation: systemLabel(record.automation, locale),
    startedAt: systemLabel(record.startedAt, locale),
    duration: systemLabel(record.duration, locale),
    summary: systemLabel(record.summary, locale),
  }));
}
