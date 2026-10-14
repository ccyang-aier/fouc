'use client';
import { translateFixed } from '../i18n/display';

import { getLocale, useTranslation, type Locale } from '@/lib/i18n';
import { fixtureField, registerProjectFixtures } from '../i18n/display';
import { messages } from './i18n/dashboard-charts';

import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  DotsThree,
  DownloadSimple,
  SlidersHorizontal,
} from '@phosphor-icons/react';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { useEffect, useEffectEvent, useId, useRef, useState, type CSSProperties } from 'react';
import styles from './dashboard-charts.module.css';
import { csvCell, downloadFile } from './dashboard-download';
import { DashboardMenu, DashboardMenuContent } from './dashboard-menu';
import type {
  DashboardMeeting,
  DashboardMilestonePoint,
  DashboardPeriod,
  DashboardPersonId,
  DashboardTarget,
  DashboardTask,
} from './dashboard-model';
import { AvatarGroup, IconButton, SegmentedControl } from './dashboard-ui';

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const activityPeriods: readonly DashboardPeriod[] = ['Daily', 'Weekly', 'Monthly', 'Yearly'];
const timelineCategories = ['Dashboard Design', 'Mobile App', 'Landing Page', 'Meeting'] as const;
const shortMonth = (locale: Locale) =>
  new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
const dateLabel = (locale: Locale) =>
  new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
const timeLabel = (locale: Locale) =>
  new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });

interface TimelineEvent {
  target: DashboardTarget;
  category: (typeof timelineCategories)[number];
  title: string;
  progress?: number;
  people: readonly DashboardPersonId[];
  tone: 'mint' | 'peach' | 'lavender' | 'purple';
  start: number;
  end: number;
}
interface PositionedEvent extends TimelineEvent {
  position: number;
  width: number;
  lane: number;
  compact: boolean;
}
interface TimeWindow {
  start: number;
  end: number;
}
interface TimeTick {
  label: string;
  time: number;
}

function calendarDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`);
}
function dateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timelineEvents(
  tasks: readonly DashboardTask[],
  meetings: readonly DashboardMeeting[],
  locale: Locale = getLocale(),
): TimelineEvent[] {
  const taskEvents = tasks.map((task) => {
    const start = calendarDate(task.scheduledDate).getTime() + task.startHour * hour;
    return {
      target: { kind: 'task', id: task.id } as DashboardTarget,
      category: task.timelineCategory,
      title: fixtureField(task, 'title', locale),
      progress: task.progress,
      people: task.assignees,
      tone:
        task.timelineCategory === 'Dashboard Design'
          ? 'mint'
          : task.timelineCategory === 'Mobile App'
            ? 'peach'
            : 'lavender',
      start,
      end: start + task.durationHours * hour,
    } satisfies TimelineEvent;
  });
  const meetingEvents = meetings.map((meeting) => {
    // The dashboard editor stores calendar wall times, independent of the host timezone.
    const start = new Date(`${meeting.startsAt.slice(0, 19)}Z`).getTime();
    return {
      target: { kind: 'meeting', id: meeting.id } as DashboardTarget,
      category: 'Meeting',
      title: fixtureField(meeting, 'title', locale),
      people: meeting.attendees,
      tone: 'purple',
      start,
      end: start + meeting.durationMinutes * 60 * 1000,
    } satisfies TimelineEvent;
  });
  return [...taskEvents, ...meetingEvents];
}

function timeWindow(
  date: string,
  period: DashboardPeriod,
  events: readonly TimelineEvent[],
): TimeWindow {
  const selected = calendarDate(date);
  const midnight = selected.getTime();
  const year = selected.getUTCFullYear();
  const month = selected.getUTCMonth();
  if (period === 'Weekly') {
    const start = midnight - ((selected.getUTCDay() + 6) % 7) * day;
    return { start, end: start + 7 * day };
  }
  if (period === 'Monthly')
    return { start: Date.UTC(year, month, 1), end: Date.UTC(year, month + 1, 1) };
  if (period === 'Yearly') return { start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) };
  const scheduled = events.filter((event) => event.start < midnight + day && event.end > midnight);
  const firstHour = Math.min(
    9,
    ...scheduled.map((event) => Math.max(0, (event.start - midnight) / hour)),
  );
  const lastHour = Math.max(
    16.5,
    ...scheduled.map((event) => Math.min(24, (event.end - midnight) / hour)),
  );
  return {
    start: midnight + Math.floor(firstHour) * hour,
    end: midnight + (Math.ceil(lastHour * 2) / 2) * hour,
  };
}

function timeTicks(
  window: TimeWindow,
  period: DashboardPeriod,
  locale: Locale = getLocale(),
): TimeTick[] {
  if (period === 'Daily') {
    const hours = (window.end - window.start) / hour;
    const step = hours > 14 ? 3 : hours > 9 ? 2 : 1;
    const ticks: TimeTick[] = [];
    for (let time = window.start; time <= window.end; time += step * hour)
      ticks.push({ label: timeLabel(locale).format(time), time });
    return ticks;
  }
  if (period === 'Weekly') {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, index) => {
      const time = window.start + (index + 0.5) * day;
      return { label: weekday.format(time), time };
    });
  }
  const first = new Date(window.start);
  if (period === 'Yearly') {
    return [0, 2, 4, 6, 8, 10, 11].map((month) => {
      const time = Date.UTC(first.getUTCFullYear(), month, 1);
      return { label: shortMonth(locale).format(time), time };
    });
  }
  const days = (window.end - window.start) / day;
  const step = Math.ceil((days - 1) / 7);
  const indices = Array.from({ length: Math.ceil((days - 1) / step) }, (_, index) => index * step);
  indices.push(days - 1);
  return indices.map((index) => ({
    label: `${shortMonth(locale).format(window.start)} ${index + 1}`,
    time: window.start + index * day,
  }));
}

function positionEvents(events: readonly TimelineEvent[], window: TimeWindow): PositionedEvent[] {
  const laneEnds: number[] = [];
  const span = window.end - window.start;
  return [...events]
    .sort((a, b) => a.start - b.start)
    .map((event) => {
      const actualWidth =
        ((Math.min(event.end, window.end) - Math.max(event.start, window.start)) / span) * 100;
      const width = Math.min(100, Math.max(6, actualWidth));
      const position = Math.min(
        100 - width,
        Math.max(0, ((event.start - window.start) / span) * 100),
      );
      let lane = laneEnds.findIndex((end) => end <= position);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = position + width;
      return { ...event, position, width, lane, compact: actualWidth < 12 };
    });
}

function adjacentDate(value: string, period: DashboardPeriod, direction: number) {
  const date = calendarDate(value);
  if (period === 'Yearly') date.setUTCFullYear(date.getUTCFullYear() + direction);
  else if (period === 'Monthly') {
    const selectedDay = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + direction);
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(selectedDay, lastDay));
  } else date.setUTCDate(date.getUTCDate() + direction * (period === 'Weekly' ? 7 : 1));
  return dateValue(date);
}

export function ActivityMap({
  tasks,
  meetings,
  onOpenTarget,
  referenceDate = '2027-02-08',
}: {
  tasks: readonly DashboardTask[];
  meetings: readonly DashboardMeeting[];
  onOpenTarget: (target: DashboardTarget) => void;
  referenceDate?: string;
}) {
  const { t, locale } = useTranslation(messages);

  const [period, setPeriod] = useState<DashboardPeriod>('Daily');
  const [selectedDate, setSelectedDate] = useState(referenceDate);
  const events = timelineEvents(tasks, meetings, locale);
  const window = timeWindow(selectedDate, period, events);
  const visibleEvents = events.filter(
    (event) => event.start < window.end && event.end > window.start,
  );
  const rows = timelineCategories.map((category, index) => {
    const positioned = positionEvents(
      visibleEvents.filter((event) => event.category === category),
      window,
    );
    const lanes = Math.max(1, ...positioned.map((event) => event.lane + 1));
    return {
      category,
      events: positioned,
      height: Math.max([78, 70, 70, 28][index], lanes * 32 - 4),
    };
  });
  const plotHeight = rows.reduce((sum, row) => sum + row.height, 0);
  const ticks = timeTicks(window, period, locale);
  const referenceTime = calendarDate(referenceDate).getTime() + 13 * hour;
  const referenceVisible = referenceTime >= window.start && referenceTime <= window.end;
  const rangeName =
    period === 'Daily'
      ? dateLabel(locale).format(window.start)
      : `${dateLabel(locale).format(window.start)} – ${dateLabel(locale).format(window.end - 1)}`;

  return (
    <section
      className={`${styles.panel} ${styles.activityPanel}`}
      aria-labelledby="dashboard-activity-map-title"
    >
      <header className={styles.panelHeader}>
        <div className={styles.activityHeading}>
          <h2 id="dashboard-activity-map-title">{t('Time-Based Activity Map')}</h2>
          <div className={styles.timelineDates}>
            <button
              type="button"
              className={`fouc-action ${styles.dateNavigation}`}
              aria-label={t('Previous timeline period')}
              onClick={() => setSelectedDate((value) => adjacentDate(value, period, -1))}
            >
              <CaretLeft size={12} />
            </button>
            <input
              type="date"
              aria-label={t('Timeline date')}
              value={selectedDate}
              onInput={(event) => {
                const value = event.currentTarget.value;
                if (value) setSelectedDate(value);
              }}
            />
            <button
              type="button"
              className={`fouc-action ${styles.dateNavigation}`}
              aria-label={t('Next timeline period')}
              onClick={() => setSelectedDate((value) => adjacentDate(value, period, 1))}
            >
              <CaretRight size={12} />
            </button>
          </div>
        </div>
        <SegmentedControl
          items={activityPeriods}
          value={period}
          onChange={setPeriod}
          label={t('Activity timeline period')}
        />
      </header>
      <div
        className={styles.timeline}
        style={{ '--timeline-height': `${plotHeight}px` } as CSSProperties}
        role="group"
        aria-label={t('{v0} schedule: {v1}', { v0: translateFixed(period, locale), v1: rangeName })}
      >
        <div
          className={styles.timelineRows}
          style={{ gridTemplateRows: rows.map((row) => `${row.height}px`).join(' ') }}
        >
          {rows.map((row) => (
            <div className={styles.timelineRow} key={row.category}>
              <span className={styles.rowLabel}>{translateFixed(row.category, locale)}</span>
              <div className={styles.rowTrack}>
                {row.events.map((event) => (
                  <Tooltip key={`${event.target.kind}:${event.target.id}`}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={`fouc-action ${styles.timelineTask} ${styles[event.tone]}`}
                        style={
                          {
                            '--task-start': `${event.position}%`,
                            '--task-width': `${event.width}%`,
                            '--task-top': `${event.lane * 32}px`,
                          } as CSSProperties
                        }
                        data-compact={event.compact}
                        onClick={() => onOpenTarget(event.target)}
                        aria-label={t('{v0}, {v1}, {v2} to {v3}{v4}. Open details', {
                          v0: fixtureField(event, 'title', locale),
                          v1: dateLabel(locale).format(event.start),
                          v2: timeLabel(locale).format(event.start),
                          v3: timeLabel(locale).format(event.end),
                          v4:
                            event.progress === undefined
                              ? ''
                              : t(', {count}% complete', { count: event.progress }),
                        })}
                      >
                        <AvatarGroup
                          ids={event.compact ? event.people.slice(0, 1) : event.people}
                          size={16}
                        />
                        <span className={styles.timelineTaskTitle}>
                          {fixtureField(event, 'title', locale)}
                        </span>
                        {event.progress === undefined ? null : <strong>{event.progress}%</strong>}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className={styles.scheduleTooltip}>
                      <strong>{fixtureField(event, 'title', locale)}</strong>
                      <span>
                        {dateLabel(locale).format(event.start)} ·{' '}
                        {timeLabel(locale).format(event.start)} –{' '}
                        {timeLabel(locale).format(event.end)}
                      </span>
                      {event.progress === undefined ? null : (
                        <span>
                          {event.progress}
                          {t('% complete')}
                        </span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          ))}
        </div>
        {referenceVisible ? (
          <div
            className={styles.currentTime}
            style={
              {
                '--reference-position':
                  (referenceTime - window.start) / (window.end - window.start),
              } as CSSProperties
            }
            aria-label={t('Reference time: {v0}, {v1}', {
              v0: dateLabel(locale).format(referenceTime),
              v1: timeLabel(locale).format(referenceTime),
            })}
          />
        ) : null}
        {!visibleEvents.length ? (
          <p className={styles.timelineEmpty}>
            {t('No scheduled tasks or meetings in this period.')}
          </p>
        ) : null}
        <div className={styles.timeAxis} aria-hidden="true">
          {ticks.map((tick, index) => (
            <span
              key={tick.time}
              style={
                {
                  '--tick-position': `${((tick.time - window.start) / (window.end - window.start)) * 100}%`,
                } as CSSProperties
              }
              data-first={index === 0}
              data-current={period === 'Daily' && referenceVisible && tick.time === referenceTime}
            >
              {fixtureField(tick, 'label', locale)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

type MilestonePeriod = '1 Month' | '3 Months' | '6 Months' | '1 Year';
const milestonePeriods: readonly MilestonePeriod[] = ['1 Month', '3 Months', '6 Months', '1 Year'];
const rangeLength: Record<MilestonePeriod, number> = {
  '1 Month': 1,
  '3 Months': 3,
  '6 Months': 6,
  '1 Year': 12,
};

function monthDate(value: string) {
  return calendarDate(`${value}-01`);
}
function milestoneDateLabel(value: string, locale: Locale = getLocale()) {
  const date = monthDate(value);
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
function milestoneRange(
  points: readonly DashboardMilestonePoint[],
  period: MilestonePeriod,
  startMonth: string | undefined,
): DashboardMilestonePoint[] {
  if (!points.length || !startMonth) return [];
  const first = monthDate(startMonth);
  const byMonth = new Map(points.map((point) => [point.month, point]));
  return Array.from({ length: rangeLength[period] }, (_, index) => {
    const date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + index, 1));
    const month = dateValue(date).slice(0, 7);
    return byMonth.get(month) ?? { month, target: 0, actual: 0 };
  });
}
function milestoneYMax(points: readonly DashboardMilestonePoint[]) {
  return Math.max(
    10,
    Math.ceil(
      (Math.max(0, ...points.flatMap((point) => [point.target, point.actual])) * 1.5) / 10,
    ) * 10,
  );
}

let chartLibrary: Promise<typeof import('echarts/core')> | undefined;
function loadChartLibrary() {
  return (chartLibrary ??= Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
  ])
    .then(([core, charts, components, renderers]) => {
      core.use([charts.BarChart, components.GridComponent, renderers.CanvasRenderer]);
      return core;
    })
    .catch((error: unknown) => {
      chartLibrary = undefined;
      throw error;
    }));
}

function milestoneChartOption(
  points: readonly DashboardMilestonePoint[],
  fontFamily: string,
  locale: Locale = getLocale(),
): EChartsCoreOption {
  return {
    animation: false,
    grid: { left: -12, right: -12, top: 16, bottom: 42 },
    xAxis: {
      type: 'category',
      data: points.map((point) => shortMonth(locale).format(monthDate(point.month))),
      axisLine: { show: false },
      axisTick: { show: false, alignWithLabel: true },
      axisLabel: { color: '#55555f', fontFamily, fontSize: 12, margin: 26, interval: 0 },
      splitLine: {
        show: true,
        alignWithLabel: true,
        lineStyle: { color: '#e7e7e9', width: 1.5, type: [3, 3] },
      },
    },
    yAxis: { type: 'value', max: milestoneYMax(points), show: false },
    series: [
      {
        name: translateFixed('Target', locale),
        type: 'bar',
        data: points.map((point) => point.target),
        barWidth: points.length > 6 ? 8 : 12,
        barGap: '35%',
        itemStyle: { color: '#56877e', borderRadius: 4 },
        silent: true,
      },
      {
        name: translateFixed('Actual', locale),
        type: 'bar',
        data: points.map((point) => point.actual),
        barWidth: points.length > 6 ? 8 : 12,
        itemStyle: { color: '#f36e16', borderRadius: 4 },
        silent: true,
      },
    ],
  };
}

function exportMilestones(points: readonly DashboardMilestonePoint[]) {
  const locale = getLocale();
  const rows = [
    ['Month', 'Target', 'Actual'].map((key) => translateFixed(key, locale)),
    ...points.map((point) => [milestoneDateLabel(point.month, locale), point.target, point.actual]),
  ];
  downloadFile(
    'milestone-tracker.csv',
    '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n'),
    'text/csv;charset=utf-8',
  );
}

export function MilestoneTracker({
  points,
  onEdit,
}: {
  points: readonly DashboardMilestonePoint[];
  onEdit: () => void;
}) {
  const { t, locale } = useTranslation(messages);

  const [period, setPeriod] = useState<MilestonePeriod>('6 Months');
  const [startMonth, setStartMonth] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const canvas = useRef<HTMLDivElement>(null);
  const instance = useRef<ECharts | null>(null);
  const controls = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const firstMonth = points.map((point) => point.month).sort()[0];
  const windowStart = startMonth ?? firstMonth;
  const visiblePoints = milestoneRange(points, period, windowStart);
  const activeIndex = visiblePoints.findIndex((point) => point.month === activeMonth);
  const activePoint = visiblePoints[activeIndex];
  const hasPoints = points.length > 0;
  const draw = useEffectEvent(() => {
    if (instance.current && canvas.current) {
      instance.current.setOption(
        milestoneChartOption(visiblePoints, getComputedStyle(canvas.current).fontFamily, locale),
        { notMerge: true },
      );
    }
  });

  useEffect(() => {
    const element = canvas.current;
    if (!element || !hasPoints) return;
    let disposed = false;
    let core: typeof import('echarts/core') | undefined;
    function initialize() {
      if (
        disposed ||
        !core ||
        !element ||
        instance.current ||
        !element.clientWidth ||
        !element.clientHeight
      )
        return;
      instance.current = core.init(element, undefined, { renderer: 'canvas' });
      draw();
      setStatus('ready');
    }
    const resize = new ResizeObserver(() => {
      initialize();
      instance.current?.resize();
    });
    resize.observe(element);
    void loadChartLibrary()
      .then((loaded) => {
        if (!disposed) {
          core = loaded;
          initialize();
        }
      })
      .catch(() => {
        if (!disposed) setStatus('error');
      });
    return () => {
      disposed = true;
      resize.disconnect();
      instance.current?.dispose();
      instance.current = null;
    };
  }, [retry, hasPoints]);

  useEffect(() => {
    draw();
  }, [points, period, windowStart, locale]);

  function changePeriod(value: MilestonePeriod) {
    setPeriod(value);
    setActiveMonth(null);
  }
  function navigatePeriod(direction: number) {
    if (!windowStart) return;
    const first = monthDate(windowStart);
    const next = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + direction * rangeLength[period], 1),
    );
    setStartMonth(dateValue(next).slice(0, 7));
    setActiveMonth(null);
  }
  function resetView() {
    changePeriod('6 Months');
    setStartMonth(null);
  }
  function focusPoint(index: number) {
    controls.current?.querySelectorAll<HTMLButtonElement>('button')[index]?.focus();
  }

  return (
    <section
      className={`${styles.panel} ${styles.milestonePanel}`}
      aria-labelledby="dashboard-milestone-title"
    >
      <header className={styles.panelHeader}>
        <h2 id="dashboard-milestone-title">{t('Milestone Tracker')}</h2>
        <div className={styles.milestoneActions}>
          <SegmentedControl
            items={milestonePeriods}
            value={period}
            onChange={changePeriod}
            label={t('Milestone date range')}
          />
          <DashboardMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label={t('Milestone options')}>
                <DotsThree size={18} weight="bold" />
              </IconButton>
            </DropdownMenuTrigger>
            <DashboardMenuContent align="end" density="compact">
              {hasPoints ? (
                <DropdownMenuLabel>
                  {milestoneDateLabel(visiblePoints[0].month, locale)} –{' '}
                  {milestoneDateLabel(visiblePoints.at(-1)!.month, locale)}
                </DropdownMenuLabel>
              ) : null}
              <DropdownMenuItem disabled={!hasPoints} onSelect={() => navigatePeriod(-1)}>
                <CaretLeft />
                {t('Previous period')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!hasPoints} onSelect={() => navigatePeriod(1)}>
                <CaretRight />
                {t('Next period')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onEdit}>
                <SlidersHorizontal />
                {t('Manage targets and values')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasPoints}
                onSelect={() => exportMilestones(visiblePoints)}
              >
                <DownloadSimple />
                {t('Export CSV')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={resetView}>
                <ArrowClockwise />
                {t('Reset view')}
              </DropdownMenuItem>
            </DashboardMenuContent>
          </DashboardMenu>
        </div>
      </header>
      <div className={styles.chartWrap}>
        <div className={styles.chartCanvas} ref={canvas} aria-hidden="true" />
        {hasPoints && status === 'ready' ? (
          <div
            className={styles.chartControls}
            ref={controls}
            role="group"
            aria-label={t('{v0} milestone target and actual tasks, {v1} to {v2}', {
              v0: translateFixed(period, locale),
              v1: milestoneDateLabel(visiblePoints[0].month, locale),
              v2: milestoneDateLabel(visiblePoints.at(-1)!.month, locale),
            })}
            onMouseLeave={() => {
              if (!controls.current?.contains(document.activeElement)) setActiveMonth(null);
            }}
          >
            {visiblePoints.map((point, index) => (
              <button
                type="button"
                key={point.month}
                className={styles.chartPoint}
                data-active={point.month === activeMonth}
                aria-label={t('{v0}: target {v1} tasks, actual {v2} tasks', {
                  v0: milestoneDateLabel(point.month, locale),
                  v1: point.target,
                  v2: point.actual,
                })}
                aria-describedby={point.month === activeMonth ? tooltipId : undefined}
                onMouseEnter={() => setActiveMonth(point.month)}
                onFocus={() => setActiveMonth(point.month)}
                onBlur={() => setActiveMonth(null)}
                onClick={() => setActiveMonth(point.month)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setActiveMonth(null);
                  if (event.key === 'Home' || event.key === 'End') {
                    event.preventDefault();
                    focusPoint(event.key === 'Home' ? 0 : visiblePoints.length - 1);
                  }
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault();
                    focusPoint(
                      (index + (event.key === 'ArrowRight' ? 1 : -1) + visiblePoints.length) %
                        visiblePoints.length,
                    );
                  }
                }}
              />
            ))}
          </div>
        ) : null}
        {hasPoints && activePoint ? (
          <div
            className={styles.chartTooltip}
            id={tooltipId}
            role="tooltip"
            style={
              {
                '--tooltip-x': `calc(${((activeIndex + 0.5) / visiblePoints.length) * 100}% + ${((activeIndex + 0.5) / visiblePoints.length) * 24 - 12}px)`,
                '--tooltip-y': `${Math.max(-8, 16 + (1 - Math.max(activePoint.target, activePoint.actual) / milestoneYMax(visiblePoints)) * 162 - 88)}px`,
              } as CSSProperties
            }
          >
            <div className={styles.tooltipDate}>
              {milestoneDateLabel(activePoint.month, locale)}
            </div>
            <div className={styles.tooltipRow}>
              <span className={styles.targetDot} />
              {t('Target')}
              <span>
                {activePoint.target} {t('Tasks')}
              </span>
            </div>
            <div className={styles.tooltipRow}>
              <span className={styles.actualDot} />
              {t('Actual')}
              <span>
                {activePoint.actual} {t('Tasks')}
              </span>
            </div>
          </div>
        ) : null}
        {!hasPoints ? (
          <div className={styles.chartStatus}>
            <span>{t('No milestone data yet.')}</span>
            <button type="button" className="fouc-action" onClick={onEdit}>
              {t('Add targets')}
            </button>
          </div>
        ) : status === 'loading' ? (
          <span
            className={styles.chartStatus}
            role="status"
            aria-label={t('Loading milestone chart')}
          >
            <span className={styles.loadingDots}>
              <i />
              <i />
              <i />
            </span>
          </span>
        ) : status === 'error' ? (
          <div className={styles.chartStatus} role="alert">
            <span>{t('Couldn’t load the chart.')}</span>
            <button
              type="button"
              className="fouc-action"
              onClick={() => {
                setStatus('loading');
                setRetry((value) => value + 1);
              }}
            >
              {t('Try again')}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

registerProjectFixtures([activityPeriods, milestonePeriods, rangeLength]);
