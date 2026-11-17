import { describe, expect, it } from 'vitest';
import { timeOverrideFromBroadcastSettings } from './broadcastTime.js';

// modoitaliano/giorgia#49: the program-wide override, as Alcantara's renderer builds it.
describe('timeOverrideFromBroadcastSettings', () => {
  const enabled = { timeOverrideEnabled: true, timeOverrideStartTime: '07:30', timeOverrideStartedAt: '2026-11-17T10:00:00.000Z' };

  it('is active only when enabled with both values set', () => {
    expect(timeOverrideFromBroadcastSettings(enabled)).toEqual({ startTime: '07:30', startedAt: '2026-11-17T10:00:00.000Z' });
    for (const settings of [
      undefined,
      null,
      'x',
      [],
      { ...enabled, timeOverrideEnabled: 'true' },
      { ...enabled, timeOverrideStartTime: '' },
      { ...enabled, timeOverrideStartTime: 7 },
      { ...enabled, timeOverrideStartedAt: '' },
      { ...enabled, timeOverrideStartedAt: null },
    ]) {
      expect(timeOverrideFromBroadcastSettings(settings)).toBeNull();
    }
  });
});
