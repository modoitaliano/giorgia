export interface GlobalTimeOverride {
  startTime: string;
  startedAt: string;
}

interface ClockParts {
  hours: number;
  minutes: number;
  seconds: number;
}

function parseStartTime(startTime: string): ClockParts | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(startTime.trim());
  if (!match) {
    return null;
  }

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
    seconds: 0,
  };
}

export function getOverrideClockParts(
  override: GlobalTimeOverride,
  now: Date = new Date(),
): ClockParts | null {
  const parsed = parseStartTime(override.startTime);
  if (!parsed) {
    return null;
  }

  const startedAtMillis = new Date(override.startedAt).getTime();
  if (!Number.isFinite(startedAtMillis)) {
    return null;
  }

  const startSeconds = parsed.hours * 3600 + parsed.minutes * 60;
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now.getTime() - startedAtMillis) / 1000),
  );
  const totalSeconds = (startSeconds + elapsedSeconds) % 86400;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { hours, minutes, seconds };
}

export function formatClockParts(parts: ClockParts): string {
  const hours = String(parts.hours).padStart(2, '0');
  const minutes = String(parts.minutes).padStart(2, '0');
  return `${hours}:${minutes}`;
}


/**
 * The program-wide broadcast time override from Alcantara's broadcast settings
 * (`timeOverrideEnabled`, `timeOverrideStartTime`, `timeOverrideStartedAt`), as
 * Alcantara's own renderer builds it: active only when enabled with both values
 * set. It is a program setting, not a scene field (modoitaliano/giorgia#49).
 */
export function timeOverrideFromBroadcastSettings(settings: unknown): GlobalTimeOverride | null {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return null;
  }
  const record = settings as Record<string, unknown>;
  const { timeOverrideStartTime: startTime, timeOverrideStartedAt: startedAt } = record;
  if (record.timeOverrideEnabled !== true || typeof startTime !== 'string' || !startTime || typeof startedAt !== 'string' || !startedAt) {
    return null;
  }
  return { startTime, startedAt };
}
