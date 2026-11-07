import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODOITALIANO_ASSETS } from './assets.js';
import { slideStyles } from './components/slides/slideStyles.js';
import { LANGUAGE_ROTATION, getNextLanguageIndex, t } from './i18n.js';
import { formatClockParts, getOverrideClockParts } from './utils/broadcastTime.js';

describe('broadcast time override', () => {
  const now = new Date('2026-03-11T12:00:30.000Z');

  it('advances the configured start time by the seconds elapsed since startedAt', () => {
    const parts = getOverrideClockParts({ startTime: '10:15', startedAt: '2026-03-11T11:58:00.000Z' }, now);
    expect(parts).toEqual({ hours: 10, minutes: 17, seconds: 30 });
    expect(formatClockParts(parts!)).toBe('10:17');
  });

  it('wraps past midnight', () => {
    expect(getOverrideClockParts({ startTime: '23:59', startedAt: '2026-03-11T11:59:30.000Z' }, now)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });

  it('does not run backwards when startedAt is in the future', () => {
    expect(getOverrideClockParts({ startTime: '08:05', startedAt: '2026-03-11T13:00:00.000Z' }, now)).toEqual({ hours: 8, minutes: 5, seconds: 0 });
  });

  it('rejects malformed start times and unparseable start instants', () => {
    expect(getOverrideClockParts({ startTime: '24:00', startedAt: '2026-03-11T11:00:00.000Z' }, now)).toBeNull();
    expect(getOverrideClockParts({ startTime: 'noon', startedAt: '2026-03-11T11:00:00.000Z' }, now)).toBeNull();
    expect(getOverrideClockParts({ startTime: '10:00', startedAt: 'never' }, now)).toBeNull();
  });

  it('uses the current time by default and trims the start time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T12:00:05.000Z'));
    try {
      expect(getOverrideClockParts({ startTime: ' 01:00 ', startedAt: '2026-03-11T12:00:00.000Z' })).toEqual({ hours: 1, minutes: 0, seconds: 5 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('pads single-digit clock fields', () => {
    expect(formatClockParts({ hours: 3, minutes: 7, seconds: 59 })).toBe('03:07');
  });
});

describe('live program i18n', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the translation for a language and substitutes placeholders', () => {
    expect(t('segment.weather', 'en')).toBe('Weather');
    expect(t('segment.weather', 'it')).toBe('Meteo');
    expect(t('earthquakes.timeAgo.minutesAgo', 'es', { count: 5 })).toBe('Hace 5 minutos');
  });

  it('falls back to Spanish when the language is unsupported and to the key when unknown', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(t('segment.weather', 'fr' as never)).toBe('Clima');
    expect(t('no.such.key', 'es')).toBe('no.such.key');
    expect(warn).toHaveBeenCalledWith('Translation missing for key: no.such.key');
  });

  it('rotates through the supported languages', () => {
    expect(LANGUAGE_ROTATION).toEqual(['es']);
    expect(getNextLanguageIndex(0)).toBe(0);
  });
});

describe('static live program assets', () => {
  it('exposes relative asset paths and animation styles', () => {
    expect(MODOITALIANO_ASSETS.audio.pipes).toBe('./modoitaliano/audio/pipes.ogg');
    expect(Object.values(MODOITALIANO_ASSETS.images).every((p) => p.startsWith('./modoitaliano/images/'))).toBe(true);
    expect(slideStyles).toContain('@keyframes marqueeFlow');
  });
});
