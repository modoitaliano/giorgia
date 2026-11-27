// The time since a quake, in words: the day and days arms of the relative time, which the feed's own
// 24-hour window never reaches through the slide, so they are checked on the formatter directly.
import { describe, expect, it } from 'vitest';
import { formatTimeAgo } from './EarthquakeSegment.js';
import { t } from '../i18n.js';

const HOUR = 60 * 60 * 1000;

describe('formatTimeAgo', () => {
  it('reads a quake a day old as one day ago', () => {
    expect(formatTimeAgo(Date.now() - 25 * HOUR, 'es')).toBe(t('earthquakes.timeAgo.dayAgo', 'es'));
  });

  it('reads a quake several days old as that many days ago', () => {
    expect(formatTimeAgo(Date.now() - 3 * 24 * HOUR, 'es')).toBe(t('earthquakes.timeAgo.daysAgo', 'es', { count: 3 }));
  });

  it('reads a quake hours old in hours, and a quake minutes old in minutes', () => {
    expect(formatTimeAgo(Date.now() - 2 * HOUR, 'es')).toBe(t('earthquakes.timeAgo.hoursAgo', 'es', { count: 2 }));
    expect(formatTimeAgo(Date.now() - 1 * HOUR, 'es')).toBe(t('earthquakes.timeAgo.hourAgo', 'es'));
  });
});
