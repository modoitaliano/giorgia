import { expect, it } from 'vitest';
import { formatClockParts, getOverrideClockParts } from './broadcastTime.js';

// gaulatti/giorgia#74: the operator's time override. It runs from a start time the operator typed and
// the moment they pressed start; anything it cannot read falls back to the real clock (null).

const startedAt = '2026-11-17T15:00:00Z';
const at = (iso: string) => new Date(iso);

it('runs on from the start time by the seconds elapsed since it began', () => {
  expect(getOverrideClockParts({ startTime: '21:30', startedAt }, at('2026-11-17T15:02:05Z'))).toEqual({
    hours: 21,
    minutes: 32,
    seconds: 5,
  });
  expect(getOverrideClockParts({ startTime: ' 09:05 ', startedAt }, at(startedAt))).toEqual({
    hours: 9,
    minutes: 5,
    seconds: 0,
  });
});

it('rolls past midnight back to the start of the day', () => {
  expect(getOverrideClockParts({ startTime: '23:59', startedAt }, at('2026-11-17T15:01:00Z'))).toEqual({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
});

it('never runs backwards when the clock is behind the moment it started', () => {
  expect(getOverrideClockParts({ startTime: '10:00', startedAt }, at('2026-11-17T14:00:00Z'))).toEqual({
    hours: 10,
    minutes: 0,
    seconds: 0,
  });
});

it('uses the real clock for a start time or a start moment it cannot read', () => {
  for (const startTime of ['', 'noon', '24:00', '7:30', '12:60', '12:30:15']) {
    expect(getOverrideClockParts({ startTime, startedAt }, at(startedAt))).toBeNull();
  }
  expect(getOverrideClockParts({ startTime: '10:00', startedAt: 'not a date' }, at(startedAt))).toBeNull();
});

it('reads the real time when no moment is given', () => {
  const parts = getOverrideClockParts({ startTime: '10:00', startedAt: new Date(Date.now() - 1000).toISOString() });
  expect(parts).not.toBeNull();
  expect(parts!.hours).toBeGreaterThanOrEqual(10);
});

it('shows hours and minutes with two digits each', () => {
  expect(formatClockParts({ hours: 7, minutes: 4, seconds: 59 })).toBe('07:04');
  expect(formatClockParts({ hours: 23, minutes: 59, seconds: 0 })).toBe('23:59');
});
